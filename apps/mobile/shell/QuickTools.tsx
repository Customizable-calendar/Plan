import { cn, Icon, Scrim, Text } from '@noteapp/ui';
import { router } from 'expo-router';
import { MicIcon, SparklesIcon, XIcon, ZapIcon, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

// 홈 오른쪽 아래 빠른 도구(SpeedDial 모양). 평소엔 버튼 하나만 떠 있고, 누르면 녹음과 AI 초안 버튼이 펼쳐져요.
function Tool({
  icon,
  label,
  ai = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  ai?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-2.5"
    >
      <View className="rounded-full bg-foreground px-3 py-1.5 shadow-lg shadow-black/20">
        <Text className="text-[13px] font-bold text-background">{label}</Text>
      </View>
      <View
        className={cn(
          'h-12 w-12 items-center justify-center rounded-full shadow-lg shadow-black/20',
          ai ? 'bg-ai' : 'border border-border bg-background',
        )}
      >
        <Icon as={icon} size={20} className={ai ? 'text-ai-foreground' : 'text-foreground'} />
      </View>
    </Pressable>
  );
}

export function QuickTools() {
  const [open, setOpen] = useState(false);

  const go = (href: '/stt' | '/draft') => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {open ? (
        <Pressable
          className="absolute inset-0"
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="빠른 도구 닫기"
        >
          <Scrim />
        </Pressable>
      ) : null}
      <View className="absolute bottom-6 right-5 items-end gap-3" pointerEvents="box-none">
        {open ? (
          <>
            <Tool icon={MicIcon} label="녹음" onPress={() => go('/stt')} />
            <Tool icon={SparklesIcon} label="AI 초안" ai onPress={() => go('/draft')} />
          </>
        ) : null}
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={open ? '빠른 도구 닫기' : '빠른 도구 열기'}
          accessibilityState={{ expanded: open }}
          className={cn(
            'h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-black/20',
            open ? 'border border-border bg-background' : 'bg-primary',
          )}
        >
          <Icon
            as={open ? XIcon : ZapIcon}
            size={24}
            className={open ? 'text-foreground' : 'text-primary-foreground'}
          />
        </Pressable>
      </View>
    </>
  );
}
