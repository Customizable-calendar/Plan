import { palette } from '@noteapp/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

export type ToolbarAction = 'reminder' | 'collaborator' | 'checklist' | 'hashtag' | 'voice';

interface Tool {
  action: ToolbarAction;
  label: string;
  icon: SymbolViewProps['name'];
}

// 구글 킵처럼 입력창 아래에 놓는 도구 5개
const TOOLS: Tool[] = [
  {
    action: 'reminder',
    label: '리마인드',
    icon: { ios: 'bell', android: 'notifications', web: 'notifications' },
  },
  {
    action: 'collaborator',
    label: '공동 작업자',
    icon: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  },
  {
    action: 'checklist',
    label: '체크리스트',
    icon: { ios: 'checkmark.square', android: 'check_box', web: 'check_box' },
  },
  { action: 'hashtag', label: '해시태그', icon: { ios: 'number', android: 'tag', web: 'tag' } },
  { action: 'voice', label: '음성 입력', icon: { ios: 'mic', android: 'mic', web: 'mic' } },
];

interface Props {
  onPress: (action: ToolbarAction) => void;
  /** 켜져 있는 도구는 강조색으로 보여줘요. */
  active: Partial<Record<ToolbarAction, boolean>>;
  onSave: () => void;
  canSave: boolean;
  saveLabel: string;
}

export function NoteToolbar({ onPress, active, onSave, canSave, saveLabel }: Props) {
  return (
    <View className="flex-row items-center gap-1 border-t border-border pt-2">
      {TOOLS.map((t) => (
        <Pressable
          key={t.action}
          accessibilityRole="button"
          accessibilityLabel={t.label}
          accessibilityState={{ selected: !!active[t.action] }}
          onPress={() => onPress(t.action)}
          hitSlop={4}
          className={`h-9 w-9 items-center justify-center rounded-full active:bg-muted ${
            active[t.action] ? 'bg-primary-soft' : ''
          }`}
        >
          <SymbolView
            name={t.icon}
            size={20}
            tintColor={active[t.action] ? palette.primary : palette.mutedForeground}
          />
        </Pressable>
      ))}
      <View className="flex-1" />
      <Pressable
        onPress={onSave}
        disabled={!canSave}
        accessibilityRole="button"
        className={`h-9 justify-center rounded-md bg-primary px-4 ${canSave ? '' : 'opacity-40'}`}
      >
        <Text className="text-sm font-semibold text-primary-foreground">{saveLabel}</Text>
      </Pressable>
    </View>
  );
}
