import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

// 홈에 쓰는 컴포넌트예요. 구조는 docs/benchmark/README.md 의 "홈" 항목을 따라요.

/** 오늘 브리핑. 상자 없이 큰 글자 한 줄과 작은 글자 한 줄로만 말해요. 지금 가장 먼저 알아야 할 것 하나 */
export function Briefing({
  lead,
  title,
  detail,
  onPress,
}: {
  /** 남은 시간이나 때 */
  lead: string;
  title: string;
  detail?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="gap-0.5">
      <Text className="text-[13px] font-bold text-primary">{lead}</Text>
      <Text className="text-[26px] font-bold leading-8 tracking-tight text-foreground">
        {title}
      </Text>
      {detail ? <Text className="text-[15px] text-muted-foreground">{detail}</Text> : null}
    </Pressable>
  );
}

/** 일정 한 줄. 왼쪽 색 막대, 시간 두 줄(시작, 끝), 제목과 설명, 오른쪽에 그 일정으로 바로 하는 동작 하나 */
export function AgendaRow({
  start,
  end,
  title,
  meta,
  tone = 'cal-1',
  past = false,
  action,
}: {
  start: string;
  end?: string;
  title: string;
  meta?: string;
  /** 어느 캘린더의 일정인지. ai 는 아직 저장 안 된 후보 */
  tone?: 'cal-1' | 'cal-2' | 'ai';
  past?: boolean;
  action?: { icon: LucideIcon; label: string; onPress?: () => void };
}) {
  const bar = tone === 'cal-1' ? 'bg-cal-1' : tone === 'cal-2' ? 'bg-cal-2' : 'bg-ai';
  return (
    <View className={cn('min-h-[56px] flex-row items-center gap-3 py-2', past && 'opacity-50')}>
      <View className={cn('w-1 self-stretch rounded-full', bar)} />
      <View className="w-11">
        <Text className="text-[13px] font-bold text-foreground">{start}</Text>
        {end ? <Text className="text-[11px] text-muted-foreground">{end}</Text> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-foreground">{title}</Text>
        {meta ? <Text className="text-[13px] text-muted-foreground">{meta}</Text> : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityLabel={action.label}
          className="h-11 w-11 items-center justify-center"
        >
          <Icon as={action.icon} size={20} className="text-foreground" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 문서나 녹음 한 줄. 종류 아이콘, 제목, 상태나 요약 미리보기, 오른쪽에 새 것 표시나 배지 */
export function NoteRow({
  icon,
  title,
  status,
  preview,
  when,
  isNew = false,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  /** 받아쓰는 중, 요약 대기 같은 진행 상태. 있으면 미리보기 대신 보여 줘요 */
  status?: string;
  preview?: string;
  when: string;
  isNew?: boolean;
  badge?: string;
}) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Icon as={icon} size={20} className="text-muted-foreground" />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="shrink text-[15px] font-semibold text-foreground">
            {title}
          </Text>
          {isNew ? <View className="h-1.5 w-1.5 rounded-full bg-secondary" /> : null}
        </View>
        {status ? (
          <Text className="text-xs font-bold text-primary">{status}</Text>
        ) : preview ? (
          <Text numberOfLines={1} className="text-xs text-muted-foreground">
            {preview}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1">
        <Text className="text-[11px] text-muted-foreground">{when}</Text>
        {badge ? <Text className="text-[11px] font-bold text-primary">{badge}</Text> : null}
      </View>
    </View>
  );
}
