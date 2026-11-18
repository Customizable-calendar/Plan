// 웹에는 llama.rn을 넣지 않아요(받아쓰기는 폰 앱에서만 돼요). llama.ts 참고.
import type { SherpaContext } from './sensevoice';

export const hasLlama = (): boolean => false;

export const canAccelerate = async (): Promise<boolean> => false;

export function openLlamaQwen3(): Promise<SherpaContext> {
  return Promise.reject(new Error('웹에서는 Qwen3 1.7B를 못 써요.'));
}
