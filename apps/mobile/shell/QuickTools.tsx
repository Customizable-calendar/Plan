import { palette } from '@noteapp/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

// 홈 오른쪽 아래 빠른 도구. 평소엔 버튼 하나만 떠 있고, 누르면 녹음과 AI 버튼이 위로 펼쳐져요.
// 홈 화면에서만 그려서 다른 탭으로 가면 안 보여요.
// TODO(P1): 녹음 화면, AI 채팅 화면이 생기면 router.push로 바꿔요.
function soon(name: string) {
  Alert.alert(name, '아직 준비 중이에요.');
}

function Tool({
  icon,
  label,
  onPress,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3"
    >
      <Text className="overflow-hidden rounded-md bg-card px-2.5 py-1 text-sm font-semibold text-foreground shadow-sm">
        {label}
      </Text>
      <View className="h-12 w-12 items-center justify-center rounded-full border border-primary bg-card shadow">
        <SymbolView name={icon} size={22} tintColor={palette.primary} />
      </View>
    </Pressable>
  );
}

export function QuickTools() {
  const [open, setOpen] = useState(false);

  const pick = (name: string) => {
    setOpen(false);
    soon(name);
  };

  return (
    <>
      {/* 펼쳤을 때 바깥을 누르면 접혀요 */}
      {open ? (
        <Pressable
          className="absolute inset-0 bg-black/20"
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="빠른 도구 닫기"
        />
      ) : null}
      <View className="absolute bottom-6 right-5 items-end gap-3" pointerEvents="box-none">
        {open ? (
          <>
            <Tool
              icon={{ ios: 'mic', android: 'mic', web: 'mic' }}
              label="녹음"
              onPress={() => pick('녹음')}
            />
            <Tool
              icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              label="AI에게 묻기"
              onPress={() => pick('AI에게 묻기')}
            />
          </>
        ) : null}
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={open ? '빠른 도구 닫기' : '빠른 도구 열기'}
          accessibilityState={{ expanded: open }}
          className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
        >
          <SymbolView
            name={
              open
                ? { ios: 'xmark', android: 'close', web: 'close' }
                : { ios: 'bolt.fill', android: 'bolt', web: 'bolt' }
            }
            size={24}
            tintColor={palette.primaryForeground}
          />
        </Pressable>
      </View>
    </>
  );
}
