import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, FileMode, Paths } from 'expo-file-system';

import { decodeToWav } from '@/modules/stt-native';

import { BYTES_PER_SECOND, SAMPLE_RATE } from './chunker';

// 녹음 원본 남기기(선택, SpokenLog·Whispering 참고). (담당: B)
// 켜 두면 녹음하는 소리를 그대로 WAV(16kHz 모노 16비트)로 이 기기에 남겨요. 1시간에 약 115MB예요.
//   Documents/stt/recordings/<시작ms>.wav
// 나중에 다시 듣거나, 더 좋은 모델로 다시 받아쓸 수 있어요. 기기 밖으로는 안 나가요. 기본은 꺼져 있어요.

export const WAV_HEADER_BYTES = 44;

export interface Recording {
  /** 시작 시각(ms) 그대로. 파일 이름이에요. */
  id: string;
  file: File;
  startedAt: Date;
  seconds: number;
}

function dir(): Directory {
  const d = new Directory(Paths.document, 'stt', 'recordings');
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

/** 16kHz 모노 16비트 PCM WAV 머리(44바이트). dataBytes: 소리 길이(바이트) */
export function wavHeader(dataBytes: number): Uint8Array {
  const header = new Uint8Array(WAV_HEADER_BYTES);
  const view = new DataView(header.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) header[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt 길이
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 모노
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, BYTES_PER_SECOND, true);
  view.setUint16(32, 2, true); // 한 샘플 바이트
  view.setUint16(34, 16, true); // 비트
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  return header;
}

/** 녹음하면서 WAV에 이어 써요. 끝낼 때 머리에 길이를 적어요. */
export interface RecordingWriter {
  id: string;
  write(bytes: Uint8Array): void;
  finish(): void;
  discard(): void;
}

export function startRecordingFile(startedAt: number): RecordingWriter {
  const file = new File(dir(), `${startedAt}.wav`);
  if (file.exists) file.delete();
  file.create();
  const handle = file.open(FileMode.ReadWrite);
  handle.writeBytesSync(wavHeader(0));
  let total = 0;
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    handle.close();
  };
  return {
    id: String(startedAt),
    write(bytes) {
      if (!open) return;
      handle.writeBytesSync(bytes);
      total += bytes.length;
    },
    finish() {
      if (!open) return;
      handle.offset = 0;
      handle.writeBytesSync(wavHeader(total));
      close();
    },
    discard() {
      close();
      if (file.exists) file.delete();
    },
  };
}

/** 남긴 녹음, 최근 것부터. 앱이 꺼져서 머리에 길이를 못 적은 파일은 여기서 고쳐요. */
export function listRecordings(): Recording[] {
  const out: Recording[] = [];
  for (const entry of dir().list()) {
    if (!(entry instanceof File) || !entry.name.endsWith('.wav')) continue;
    const id = entry.name.slice(0, -'.wav'.length);
    const startedAt = Number(id);
    const dataBytes = Math.max(0, entry.size - WAV_HEADER_BYTES);
    if (!Number.isFinite(startedAt) || dataBytes < BYTES_PER_SECOND / 2) continue;
    fixHeader(entry, dataBytes);
    out.push({
      id,
      file: entry,
      startedAt: new Date(startedAt),
      seconds: Math.round(dataBytes / BYTES_PER_SECOND),
    });
  }
  return out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

function fixHeader(file: File, dataBytes: number) {
  try {
    const handle = file.open(FileMode.ReadWrite);
    try {
      handle.offset = 40;
      const stored = new DataView(handle.readBytesSync(4).buffer).getUint32(0, true);
      if (stored !== dataBytes) {
        handle.offset = 0;
        handle.writeBytesSync(wavHeader(dataBytes));
      }
    } finally {
      handle.close();
    }
  } catch {
    // 못 고쳐도 소리는 그대로 있어요.
  }
}

/**
 * 음성·동영상 파일을 골라서 남긴 녹음으로 가져와요(SpokenLog 참고). 고르지 않으면 null이에요.
 * OS 디코더로 16kHz 모노 WAV로 바꿔서 recordings 폴더에 둬요. 원래 파일은 그대로예요.
 * Android 새 APK부터 돼요(modules/stt-native).
 */
export async function importAudioFile(): Promise<Recording | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['audio/*', 'video/*'] });
  if (picked.canceled) return null;
  const id = String(Date.now());
  const out = new File(dir(), `${id}.wav`);
  try {
    await decodeToWav(picked.result.uri, out.uri);
  } catch (e) {
    if (out.exists) out.delete();
    throw new Error(e instanceof Error && e.message ? e.message : '이 파일은 가져오지 못했어요.');
  }
  const recording = listRecordings().find((r) => r.id === id);
  if (!recording) {
    if (out.exists) out.delete();
    throw new Error('파일에 소리가 거의 없어요.');
  }
  return recording;
}

export function removeRecording(id: string): void {
  const file = new File(dir(), `${id}.wav`);
  if (file.exists) file.delete();
}

/** 남긴 녹음이 차지하는 크기(바이트) */
export function recordingsBytes(): number {
  return listRecordings().reduce((sum, r) => sum + r.file.size, 0);
}

const KEEP_KEY = 'stt.keepAudio';

/** 녹음 원본을 남길지(이 기기 설정). 기본은 안 남겨요. */
export async function keepAudioEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEEP_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setKeepAudio(on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.setItem(KEEP_KEY, '1');
    else await AsyncStorage.removeItem(KEEP_KEY);
  } catch {
    // 기억 못 하면 다음에 다시 켜면 돼요.
  }
}
