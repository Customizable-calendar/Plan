import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// 새로 머지된 코드(OTA 업데이트)를 바로 쓰게 해요.
// expo-updates 기본은 켤 때 받기만 하고 "다음에 켤 때" 적용해서, APK를 새로 깔거나 앱을 오래 안 끈 사람은
// 예전 버전을 계속 봐요. 그래서
// - 앱을 켤 때: 새 업데이트가 있으면 받아서 바로 다시 불러요(켜자마자라 쓰던 내용이 없어요).
// - 앱으로 돌아올 때: 받아만 두고 다음에 켤 때 적용해요(녹음·글쓰기 중에 갑자기 다시 불러오지 않게).
// 개발 서버(Expo Go, __DEV__)와 웹에서는 아무것도 안 해요.

async function fetchNew(): Promise<boolean> {
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return false;
  const fetched = await Updates.fetchUpdateAsync();
  return fetched.isNew;
}

/** 루트 레이아웃에서 한 번 불러요. */
export function useLatestUpdate(): void {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    if (Updates.isEmergencyLaunch) {
      // 받은 업데이트가 켜지다 죽어서 APK에 들어 있던 버전으로 켜진 경우예요.
      console.warn(
        '[updates] 업데이트로 켜지 못해 기본 버전으로 켰어요.',
        Updates.emergencyLaunchReason,
      );
    }

    let busy = false;
    const run = async (applyNow: boolean) => {
      if (busy) return;
      busy = true;
      try {
        if ((await fetchNew()) && applyNow) await Updates.reloadAsync();
      } catch (e) {
        console.warn('[updates] 새 버전을 확인하지 못했어요.', e);
      } finally {
        busy = false;
      }
    };

    void run(true);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run(false);
    });
    return () => sub.remove();
  }, []);
}
