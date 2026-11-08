import type { Note } from '@noteapp/shared';
import { Text, View } from 'react-native';

import { formatTime, parseChecklist } from './format';
import { ReminderBadge } from './QuickNoteInput';
import { Avatar } from './ToolSheets';

/**
 * 구글 킵처럼 두 칸으로 쌓는 메모 목록이에요.
 * Masonry(벽돌 쌓기): 카드 높이가 달라도, 더 짧은 칸에 다음 카드를 넣어서 빈틈을 줄여요.
 */
export function NoteGrid({ notes }: { notes: Note[] }) {
  const columns: [Note[], Note[]] = [[], []];
  const heights = [0, 0];
  for (const note of notes) {
    const col = heights[0] <= heights[1] ? 0 : 1;
    columns[col].push(note);
    heights[col] += estimateHeight(note);
  }

  return (
    <View className="flex-row items-start gap-2">
      {columns.map((col, i) => (
        <View key={i} className="flex-1 gap-2">
          {col.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** 실제로 그리기 전이라 글자 수와 줄 수로 높이를 대충 어림해요. */
function estimateHeight(note: Note): number {
  const lines = note.text.split('\n').reduce((sum, l) => sum + Math.ceil((l.length || 1) / 14), 0);
  const extra = note.reminder || note.collaborators?.length ? 1 : 0;
  return lines + extra + 1;
}

function NoteCard({ note }: { note: Note }) {
  const checklist = parseChecklist(note.text);
  const people = note.collaborators ?? [];

  return (
    <View className="gap-2 rounded-lg border border-border bg-card p-3">
      {checklist ? (
        checklist.map((it, i) => (
          <View key={i} className="flex-row items-start gap-1.5">
            <View
              className={`mt-1 h-3.5 w-3.5 rounded-sm border-2 ${
                it.checked ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}
            />
            <Text
              className={`flex-1 text-[15px] leading-5 ${
                it.checked ? 'text-muted-foreground line-through' : 'text-card-foreground'
              }`}
            >
              {it.text}
            </Text>
          </View>
        ))
      ) : (
        <Text className="text-[15px] leading-5 text-card-foreground" numberOfLines={10}>
          {note.text}
        </Text>
      )}

      {note.reminder || people.length ? (
        <View className="flex-row flex-wrap items-center gap-1">
          {note.reminder ? <ReminderBadge reminder={note.reminder} /> : null}
          {people.length ? (
            <View className="flex-row" accessibilityLabel={`공동 작업자 ${people.length}명`}>
              {people.slice(0, 3).map((e, i) => (
                <View key={e} className={i > 0 ? '-ml-1.5' : ''}>
                  <Avatar email={e} size="sm" />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <Text className="text-[11px] text-muted-foreground">{formatTime(note.createdAt)}</Text>
    </View>
  );
}
