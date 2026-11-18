import { Platform, TurboModuleRegistry } from 'react-native';

// sherpa-onnx(@siteed/sherpa-onnx.rn, MIT) 불러오기. Qwen3 받아쓰기와 화자 구분이 써요. (담당: B)
// 라이브러리는 불러오는 순간 네이티브 모듈을 찾아서, 없는 빌드(예전 APK·Expo Go)에서는 던져요.
// 그래서 있는지 먼저 보고(hasSherpa), 쓸 때 불러와요. 웹은 sherpa.web.ts가 대신해요.

/** 이 앱 빌드에 sherpa-onnx가 들어 있는지 */
export function hasSherpa(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return TurboModuleRegistry.get('SherpaOnnx') != null;
  } catch {
    return false;
  }
}

/** 라이브러리 전체(ASR, Diarization 등). hasSherpa()가 false면 던져요. */
export function sherpa(): unknown {
  if (!hasSherpa())
    throw new Error('이 앱 버전에는 Qwen3와 화자 구분이 없어요. 새 APK를 깔아 주세요.');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@siteed/sherpa-onnx.rn');
}
