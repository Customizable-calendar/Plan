import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getSession } from '@/lib/auth';
import { dataSource } from '@/lib/data-source';

// 왼쪽 메뉴 맨 위 회원 정보. 누르면 설정으로 가요.
// 예시 데이터로 돌 때(fixtures)는 「로그인 필요」로 보여요.
interface Who {
  name: string;
  detail: string;
}

const guest: Who = { name: '로그인 필요', detail: '설정에서 로그인해요' };

export function Profile({ onNavigate }: { onNavigate: (href: string) => void }) {
  const [who, setWho] = useState<Who>(guest);

  useEffect(() => {
    if (dataSource !== 'supabase') return;
    getSession()
      .then((session) => {
        const email = session?.user.email;
        if (email) setWho({ name: email.split('@')[0], detail: email });
      })
      .catch(() => setWho(guest));
  }, []);

  return (
    <Pressable
      onPress={() => onNavigate('/settings')}
      accessibilityRole="button"
      accessibilityLabel={`회원 정보 ${who.name}, 설정 열기`}
      className="flex-row items-center gap-3 px-5 pb-3 pt-4 active:bg-muted"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
        {who === guest ? (
          <SymbolView
            name={{ ios: 'person.fill', android: 'person', web: 'person' }}
            size={20}
            tintColor={palette.primary}
          />
        ) : (
          <Text className="font-bold text-primary-soft-foreground">{who.name.slice(0, 1)}</Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-bold text-foreground">{who.name}</Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {who.detail}
        </Text>
      </View>
    </Pressable>
  );
}
