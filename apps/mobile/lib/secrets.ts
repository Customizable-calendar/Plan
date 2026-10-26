import type { AiProviderName } from '@noteapp/ai-client';
import * as SecureStore from 'expo-secure-store';

// 사용자 AI 키는 기기의 보안 저장소에만 둬요. 서버·DB·로그로 보내지 않아요.
// (docs/decisions/0002-ai-key-on-device.md)

const keyName = (provider: AiProviderName) => `ai-key-${provider}`;

export function getAiKey(provider: AiProviderName) {
  return SecureStore.getItemAsync(keyName(provider));
}

export function setAiKey(provider: AiProviderName, value: string) {
  return SecureStore.setItemAsync(keyName(provider), value);
}

export function deleteAiKey(provider: AiProviderName) {
  return SecureStore.deleteItemAsync(keyName(provider));
}
