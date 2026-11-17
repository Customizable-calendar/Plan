import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { loginRequired, signOut, useSession } from '@/lib/auth';

/** 설정 맨 위 계정 칸: 로그인 전에는 로그인 버튼, 로그인하면 이메일과 로그아웃. 예시 데이터만 쓰면 안 보여요. */
export function AccountSection() {
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  if (!loginRequired || session === undefined) return null;

  if (!session) {
    return (
      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-[13px] text-muted-foreground">계정</Text>
        <Text className="text-[14px] leading-5 text-muted-foreground">
          지금은 메모·일정·카드가 이 기기에만 저장돼요. 로그인하면 계정에도 저장돼서 다른 기기에서도
          볼 수 있어요. 이 기기에 쓴 것도 같이 올라가요.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/login')}
          className="self-start rounded-lg bg-primary px-4 py-2"
        >
          <Text className="text-[14px] font-bold text-primary-foreground">로그인</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <Text className="text-[13px] text-muted-foreground">계정</Text>
      <Text className="text-[16px] font-bold text-foreground">{session.user.email}</Text>
      {error ? <Text className="text-[13px] text-destructive">{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          void signOut().catch((e: unknown) =>
            setError(`로그아웃하지 못했어요. (${e instanceof Error ? e.message : String(e)})`),
          )
        }
        className="self-start rounded-lg bg-muted px-4 py-2"
      >
        <Text className="text-[14px] font-bold text-foreground">로그아웃</Text>
      </Pressable>
    </View>
  );
}
