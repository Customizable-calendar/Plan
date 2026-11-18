import { requireOptionalNativeModule } from 'expo';

// 받아쓰기(B) 네이티브 도우미. Android만 있어요(android/…/SttNativeModule.kt).
// 예전 APK·iOS·웹·Expo Go에는 없어서, 없으면 아무것도 안 하고 has*()가 false예요.

interface SttNativeModule {
  startKeepAlive(title: string, text: string): void;
  updateKeepAlive(title: string, text: string): void;
  stopKeepAlive(): void;
  decodeToWav(input: string, output: string): Promise<number>;
}

const native = requireOptionalNativeModule<SttNativeModule>('SttNative');

/** 화면이 꺼져도 녹음을 이어 갈 수 있는지(Android 포그라운드 서비스) */
export const hasKeepAlive = () => native != null;

/** 음성·동영상 파일을 받아쓸 수 있게 바꿀 수 있는지 */
export const hasDecoder = () => native != null;

/** 녹음하는 동안 알림을 띄워서 화면이 꺼지거나 앱을 나가도 녹음을 이어 가요. */
export function startKeepAlive(title: string, text: string): void {
  try {
    native?.startKeepAlive(title, text);
  } catch {
    // 못 띄우면 예전처럼 화면을 켜 두고 녹음해요.
  }
}

export function updateKeepAlive(title: string, text: string): void {
  try {
    native?.updateKeepAlive(title, text);
  } catch {
    // 알림 글만 못 바꿔요.
  }
}

export function stopKeepAlive(): void {
  try {
    native?.stopKeepAlive();
  } catch {
    // 이미 꺼졌어요.
  }
}

/**
 * 음성·동영상 파일(m4a, mp3, aac, ogg, mp4 등)을 16kHz 모노 16비트 WAV로 바꿔요(OS 디코더).
 * input: content:// 또는 file:// 주소, output: file:// 주소. 소리 길이(ms)를 돌려줘요.
 */
export async function decodeToWav(input: string, output: string): Promise<number> {
  if (!native) throw new Error('이 앱 버전에서는 파일을 가져올 수 없어요. 새 APK를 깔아 주세요.');
  return native.decodeToWav(input, output);
}
