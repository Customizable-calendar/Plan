import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

// 받아쓴 글·자막·녹음 원본을 파일로 내보내요(expo-sharing). (담당: B)
// 파일 공유가 안 되는 곳(웹 등)에서는 글은 글로 공유하고, 녹음은 못 내보낸다고 알려요.

/** 글을 파일(예: 회의록.srt)로 만들어 공유해요. 파일 공유가 안 되면 글로 공유해요. */
export async function shareTextFile(name: string, content: string, mimeType: string) {
  if (!(await Sharing.isAvailableAsync().catch(() => false))) {
    await Share.share({ message: content });
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

/** 기기에 있는 파일(녹음 원본 WAV 등)을 공유해요. */
export async function shareFile(file: File, mimeType: string) {
  if (!(await Sharing.isAvailableAsync().catch(() => false)))
    throw new Error('이 기기에서는 파일을 내보낼 수 없어요.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: file.name });
}

/** 파일 이름에 쓸 날짜: 2026-11-18 09-30 */
export function stamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}`;
}
