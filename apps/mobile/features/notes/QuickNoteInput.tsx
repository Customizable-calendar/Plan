import type { Note, NoteReminder } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { saveNote } from './data';
import {
  checklistToPlain,
  checklistToText,
  formatReminder,
  textToChecklist,
  type ChecklistItem,
} from './format';
import { NoteToolbar, type ToolbarAction } from './NoteToolbar';
import { Avatar, CollaboratorSheet, HashtagSheet, ReminderSheet, VoiceSheet } from './ToolSheets';

type Sheet = Exclude<ToolbarAction, 'checklist'>;

interface Props {
  /** 저장한 뒤 할 일. 글을 돌려주면 입력창 아래에 안내로 보여줘요. */
  onSaved?: (note: Note) => Promise<string | void> | void;
  saveLabel?: string;
  autoFocus?: boolean;
}

/** 구글 킵처럼 바로 쓰는 메모 입력창 + 아래 도구 막대 */
export function QuickNoteInput({ onSaved, saveLabel = '저장', autoFocus }: Props) {
  const [text, setText] = useState('');
  // 체크리스트 모드면 items를, 아니면 text를 써요.
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [reminder, setReminder] = useState<NoteReminder>();
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const body = items ? checklistToText(items) : text;
  const canSave = body.trim().length > 0;

  const onTool = (action: ToolbarAction) => {
    if (action !== 'checklist') return setSheet(action);
    // 체크리스트 켜기/끄기: 줄바꿈마다 항목 하나
    if (items) {
      setText(checklistToPlain(items));
      setItems(null);
    } else {
      setItems(textToChecklist(text));
    }
  };

  // 태그를 글 끝(체크리스트면 마지막 항목 끝)에 붙여요.
  const insertTag = (tag: string) => {
    const join = (s: string) => (s && !/\s$/.test(s) ? `${s} ${tag}` : `${s}${tag}`);
    if (!items) return setText(join(text));
    setItems(items.map((it, i) => (i === items.length - 1 ? { ...it, text: join(it.text) } : it)));
  };

  const updateItem = (index: number, patch: Partial<ChecklistItem>) =>
    setItems((prev) => prev?.map((it, i) => (i === index ? { ...it, ...patch } : it)) ?? null);

  const addItemAfter = (index: number) =>
    setItems(
      (prev) =>
        prev && [
          ...prev.slice(0, index + 1),
          { text: '', checked: false },
          ...prev.slice(index + 1),
        ],
    );

  const submit = async () => {
    try {
      const note = await saveNote({ text: body, reminder, collaborators });
      setText('');
      setItems(null);
      setReminder(undefined);
      setCollaborators([]);
      setError(null);
      setMessage((await onSaved?.(note)) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="gap-2 rounded-lg border border-border bg-card p-4 pb-2">
      {items ? (
        items.map((it, i) => (
          <View key={i} className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: it.checked }}
              onPress={() => updateItem(i, { checked: !it.checked })}
              hitSlop={6}
              className={`h-5 w-5 items-center justify-center rounded-sm border-2 ${
                it.checked ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}
            >
              {it.checked ? (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={12}
                  tintColor={palette.primaryForeground}
                />
              ) : null}
            </Pressable>
            <TextInput
              value={it.text}
              onChangeText={(t) => updateItem(i, { text: t })}
              // 엔터를 누르면 아래에 새 항목을 만들어요.
              onSubmitEditing={() => addItemAfter(i)}
              submitBehavior="submit"
              placeholder="항목"
              placeholderTextColor={palette.mutedForeground}
              className={`min-h-8 flex-1 text-base ${
                it.checked ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
            />
          </View>
        ))
      ) : (
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoFocus={autoFocus}
          placeholder="생각나는 대로 적어 보세요"
          placeholderTextColor={palette.mutedForeground}
          accessibilityLabel="메모 입력"
          textAlignVertical="top"
          className="min-h-24 text-base leading-6 text-foreground"
        />
      )}

      {/* 툴바에서 정한 값이 있으면 입력창 아래에 작게 보여줘요. */}
      {reminder || collaborators.length ? (
        <View className="flex-row flex-wrap items-center gap-1">
          {reminder ? (
            <Pressable onPress={() => setSheet('reminder')}>
              <ReminderBadge reminder={reminder} />
            </Pressable>
          ) : null}
          {collaborators.map((e) => (
            <Avatar key={e} email={e} size="sm" />
          ))}
        </View>
      ) : null}
      {(error ?? message) ? (
        <Text className={`text-[13px] ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
          {error ?? message}
        </Text>
      ) : null}

      <NoteToolbar
        onPress={onTool}
        active={{
          reminder: !!reminder,
          collaborator: collaborators.length > 0,
          checklist: !!items,
        }}
        onSave={submit}
        canSave={canSave}
        saveLabel={saveLabel}
      />

      <ReminderSheet
        visible={sheet === 'reminder'}
        current={reminder}
        onPick={setReminder}
        onClose={() => setSheet(null)}
      />
      <CollaboratorSheet
        visible={sheet === 'collaborator'}
        emails={collaborators}
        onChange={setCollaborators}
        onClose={() => setSheet(null)}
      />
      <HashtagSheet
        visible={sheet === 'hashtag'}
        onPick={insertTag}
        onClose={() => setSheet(null)}
      />
      <VoiceSheet visible={sheet === 'voice'} onClose={() => setSheet(null)} />
    </View>
  );
}

/** 종 아이콘 + 알림 시각 배지 (입력창과 메모 카드가 같이 써요) */
export function ReminderBadge({ reminder }: { reminder: NoteReminder }) {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-muted px-2 py-0.5">
      <SymbolView
        name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
        size={11}
        tintColor={palette.mutedForeground}
      />
      <Text className="text-[11px] text-foreground" numberOfLines={1}>
        {formatReminder(reminder)}
      </Text>
    </View>
  );
}
