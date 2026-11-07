import type { AiProvider } from '@noteapp/ai-client';

import { dataSource } from '@/lib/data-source';

import { fakeProvider } from './fake';

// 초안을 만들 AI를 여기서만 골라요. 화면은 getProvider()만 불러요.
// TODO(B, M3): 설정의 AI 회사 + getAiKey()로 createProvider(name, key)를 돌려줘요.
export async function getProvider(): Promise<AiProvider> {
  if (dataSource === 'fixtures') return fakeProvider;
  throw new Error('ai-draft: 실제 AI 연결은 M3에서 만들어요.');
}
