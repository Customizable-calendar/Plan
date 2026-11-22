import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { REVIEW_DAYS } from './widgets';

/** 복습할 일지 하나. 그날 쓴 같은 양식 문서예요. */
export interface ReviewTarget {
  id: string;
  title: string;
}

interface Props {
  /** 날마다(1, 3, 7일 전) 그날 쓴 일지와 날짜 글. 일지가 없으면 doc은 null */
  targets: Record<number, { doc: ReviewTarget | null; dateLabel: string }>;
  done: Record<number, boolean>;
  onToggle: (days: number) => void;
  onOpen: (id: string) => void;
}

/**
 * 오늘 복습: 1일, 3일, 7일 전 학습일지를 자동으로 찾아 보여줘요.
 * 일지를 눌러 열고, 내용을 가린 채 답해 봤으면 체크해요(간격 반복 복습).
 */
export function ReviewList({ targets, done, onToggle, onOpen }: Props) {
  return (
    <View className="overflow-hidden rounded-lg border border-border">
      {REVIEW_DAYS.map((d, i) => {
        const target = targets[d];
        const checked = !!done[d];
        const doc = target?.doc;
        return (
          <View
            key={d}
            className={`flex-row items-center gap-3 px-3 py-2 ${i > 0 ? 'border-t border-border' : ''}`}
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={`${d}일 전 일지 가리고 답하기`}
              hitSlop={8}
              onPress={() => onToggle(d)}
            >
              <SymbolView
                name={
                  checked
                    ? { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' }
                    : {
                        ios: 'square',
                        android: 'check_box_outline_blank',
                        web: 'check_box_outline_blank',
                      }
                }
                size={22}
                tintColor={checked ? palette.primary : palette.mutedForeground}
              />
            </Pressable>
            <View className="w-14">
              <Text className="text-sm font-semibold text-foreground">{d}일 전</Text>
              <Text className="text-[11px] text-muted-foreground">{target?.dateLabel}</Text>
            </View>
            {doc ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${doc.title} 열기`}
                onPress={() => onOpen(doc.id)}
                className="flex-1 flex-row items-center gap-1 active:opacity-70"
              >
                <Text className="flex-1 text-sm text-primary" numberOfLines={1}>
                  {doc.title}
                </Text>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={15}
                  tintColor={palette.primary}
                />
              </Pressable>
            ) : (
              <Text className="flex-1 text-sm text-muted-foreground">그날 쓴 일지가 없어요</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
