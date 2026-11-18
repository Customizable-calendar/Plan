import type { Card, SttTransform } from '@noteapp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Share, Text, TextInput, View } from 'react-native';

import { canUseAi, organizeTranscript, runTransform } from './ai';
import { SmallButton } from './SmallButton';
import {
  autoTransformId,
  createTransform,
  isStarter,
  listTransforms,
  removeTransform,
  setAutoTransformId,
} from './transforms';

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * 받아쓴 글을 팀 AI로 다루는 칸이에요. 소리는 안 보내고 받아쓴 글만 보내요.
 * - 요약하고 카드 다시 찾기: 규칙으로 찾은 카드(확인 안 한 것)는 AI가 찾은 카드로 바뀌어요.
 * - 지시문: "회의록으로 정리" 같은 지시문을 받아쓴 글에 적용해요. 하나는 받아쓰기가 끝나면 자동으로 돌릴 수 있어요.
 */
export function TranscriptAi({
  text,
  replaced,
  onCards,
}: {
  text: string;
  replaced: string[];
  onCards: (cards: Card[]) => void;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    canUseAi().then(setAllowed, () => setAllowed(false));
  }, []);

  if (allowed === null) return null;
  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <Text className="text-[15px] font-bold text-foreground">AI로 정리하기 (팀 AI)</Text>
      <Text className="text-[13px] leading-5 text-muted-foreground">
        받아쓴 글만 팀 AI(Claude)로 보내요. 소리는 안 보내요. 회의 참석자에게 미리 알려 주세요.
      </Text>
      {allowed ? (
        <>
          <Organize text={text} replaced={replaced} onCards={onCards} />
          <Transforms text={text} />
        </>
      ) : (
        <Text className="text-[13px] leading-5 text-muted-foreground">
          팀 AI는 로그인한 팀원만 써요. 설정의 계정 칸에서 로그인해 주세요.
        </Text>
      )}
    </View>
  );
}

type Run =
  { kind: 'running' } | { kind: 'done'; text: string } | { kind: 'error'; message: string };

function Organize({
  text,
  replaced,
  onCards,
}: {
  text: string;
  replaced: string[];
  onCards: (cards: Card[]) => void;
}) {
  const [run, setRun] = useState<Run | null>(null);

  const start = async () => {
    setRun({ kind: 'running' });
    try {
      const result = await organizeTranscript(text, replaced);
      onCards(result.cards);
      setRun({ kind: 'done', text: result.summary });
    } catch (e) {
      setRun({ kind: 'error', message: messageOf(e) });
    }
  };

  if (run?.kind === 'running') return <Busy label="요약하는 중이에요" />;
  if (run?.kind === 'done')
    return <Result title="요약" text={run.text || '요약할 내용이 없었어요.'} />;
  return (
    <View className="gap-2">
      {run?.kind === 'error' ? <ErrorText message={run.message} /> : null}
      <SmallButton
        label={run?.kind === 'error' ? '다시 해 보기' : '요약하고 카드 다시 찾기'}
        primary
        onPress={() => void start()}
      />
    </View>
  );
}

/** 지시문 고르기, 돌리기, 자동으로 돌리기, 내 지시문 만들기·지우기 */
function Transforms({ text }: { text: string }) {
  const [list, setList] = useState<SttTransform[]>([]);
  const [auto, setAuto] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [adding, setAdding] = useState(false);
  const autoRan = useRef(false);

  const apply = useCallback(
    async (transform: SttTransform) => {
      setPicked(transform.id);
      setRuns((r) => ({ ...r, [transform.id]: { kind: 'running' } }));
      try {
        const answer = await runTransform(transform, text);
        setRuns((r) => ({ ...r, [transform.id]: { kind: 'done', text: answer } }));
      } catch (e) {
        setRuns((r) => ({ ...r, [transform.id]: { kind: 'error', message: messageOf(e) } }));
      }
    },
    [text],
  );

  // 처음 열 때 목록을 불러오고, 자동으로 돌릴 지시문이 있으면 한 번 돌려요.
  useEffect(() => {
    void (async () => {
      const [all, autoId] = await Promise.all([listTransforms(), autoTransformId()]);
      setList(all);
      setAuto(autoId);
      const target = all.find((t) => t.id === autoId);
      if (target && !autoRan.current) {
        autoRan.current = true;
        void apply(target);
      }
    })().catch(() => {});
  }, [apply]);

  const current = list.find((t) => t.id === picked);
  const run = picked ? runs[picked] : undefined;

  const toggleAuto = async (id: string) => {
    const next = auto === id ? null : id;
    await setAutoTransformId(next);
    setAuto(next);
  };

  const remove = async (id: string) => {
    await removeTransform(id);
    setList(await listTransforms());
    if (auto === id) setAuto(null);
    setPicked(null);
  };

  return (
    <View className="gap-3 border-t border-border pt-3">
      <Text className="text-[13px] font-bold text-muted-foreground">지시문으로 바꾸기</Text>
      <View className="flex-row flex-wrap gap-2">
        {list.map((t) => (
          <SmallButton
            key={t.id}
            label={auto === t.id ? `${t.title} · 자동` : t.title}
            primary={t.id === picked}
            disabled={runs[t.id]?.kind === 'running'}
            onPress={() => void apply(t)}
          />
        ))}
        <SmallButton label="+ 내 지시문" onPress={() => setAdding((a) => !a)} />
      </View>

      {adding ? (
        <NewTransform
          onSaved={async (t) => {
            setAdding(false);
            setList(await listTransforms());
            void apply(t);
          }}
        />
      ) : null}

      {current && run ? (
        <View className="gap-2">
          {run.kind === 'running' ? (
            <Busy label={`${current.title} 하는 중이에요`} />
          ) : run.kind === 'error' ? (
            <ErrorText message={run.message} />
          ) : (
            <Result title={current.title} text={run.text} />
          )}
          <View className="flex-row flex-wrap gap-2">
            <SmallButton
              label={auto === current.id ? '자동으로 돌리기 끄기' : '받아쓰기 끝나면 자동으로'}
              onPress={() => void toggleAuto(current.id)}
            />
            {!isStarter(current) ? (
              <SmallButton label="지시문 지우기" onPress={() => void remove(current.id)} />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function NewTransform({ onSaved }: { onSaved: (t: SttTransform) => void | Promise<void> }) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      await onSaved(await createTransform({ title, instructions }));
    } catch (e) {
      setError(messageOf(e));
    }
  };

  return (
    <View className="gap-2">
      <TextInput
        className="rounded-md border border-border bg-background px-3 py-2 text-[15px] text-foreground"
        value={title}
        onChangeText={setTitle}
        placeholder="이름 (예: 발표 대본으로)"
        maxLength={40}
        accessibilityLabel="지시문 이름"
      />
      <TextInput
        className="min-h-[96px] rounded-md border border-border bg-background px-3 py-2 text-[15px] text-foreground"
        value={instructions}
        onChangeText={setInstructions}
        placeholder="AI에게 할 말 (예: 받아쓴 글을 3분 발표 대본으로 바꿔 줘)"
        multiline
        textAlignVertical="top"
        maxLength={4000}
        accessibilityLabel="지시문"
      />
      {error ? <ErrorText message={error} /> : null}
      <SmallButton label="저장하고 돌리기" primary onPress={() => void save()} />
    </View>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <ActivityIndicator />
      <Text className="text-[14px] text-muted-foreground">{label}</Text>
    </View>
  );
}

function ErrorText({ message }: { message: string }) {
  return <Text className="text-[14px] leading-5 text-destructive">{message}</Text>;
}

function Result({ title, text }: { title: string; text: string }) {
  return (
    <View className="gap-2">
      <Text className="text-[13px] font-bold text-muted-foreground">{title}</Text>
      <Text selectable className="text-[15px] leading-6 text-foreground">
        {text}
      </Text>
      <SmallButton label="공유" onPress={() => Share.share({ message: text })} />
    </View>
  );
}
