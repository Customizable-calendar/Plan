// 웹에는 sherpa-onnx를 넣지 않아요(받아쓰기는 폰 앱에서만 돼요). sherpa.ts 참고.

export const hasSherpa = (): boolean => false;

export function sherpa(): unknown {
  throw new Error('웹에서는 Qwen3와 화자 구분을 못 써요.');
}
