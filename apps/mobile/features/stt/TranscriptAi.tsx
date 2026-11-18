import type { Card, SttTransform } from '@noteapp/shared';
import {
  AiNotice,
  Badge,
  Input,
  NextActionRow,
  SummaryHeader,
  SummaryLine,
  SummarySection,
  Text,
  Textarea,
} from '@noteapp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';

import { cardDetail, saveCard } from '@/features/cards';

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

// 녹음 노트의 "요약" 탭(디자인 시스템 녹음 노트: 요약). 팀 AI로 받아쓴 글을 정리해요.
// 소리는 안 보내고 받아쓴 글만 보내요. 로그인한 팀원만 써요.
// - 요약: 요약하고 카드를 다시 찾아요. 규칙으로 찾은 카드(확인 안 한 것)는 AI가 찾은 카드로 바뀌어요.
// - 다음 할 일: 받아쓴 글에서 찾은 일정·할 일 카드 후보예요. 확인해야 저장돼요.
// - 지시문: "회의록으로 정리" 같은 지시문을 적용해요. 하나는 받아쓰기가 끝나면 자동으로 돌릴 수 있어요.

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Run =
  { kind: 'running' } | { kind: 'done'; text: string } | { kind: 'error'; message: string };

/** 받아쓴 글에서 카드를 찾는 상태 */
export type Found =
  | { kind: 'finding' }
  | { kind: 'found'; cards: Card[]; byAi?: boolean }
  | { kind: 'error'; message: string };

/** AI 답 글을 요약 줄로. 앞의 "- ", "* "는 빼요. */
const linesOf = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);

export function SummaryTab({
  text,
  found,
  onCards,
}: {
  text: string;
  found: Found | null;
  onCards: (cards: Card[], byAi?: boolean) => void;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    canUseAi().then(setAllowed, () => setAllowed(false));
  }, []);
  const [template, setTemplate] = useState('요약');

  const replaced = found?.kind === 'found' ? found.cards.map((c) => c.id) : [];
  return (
    <View className="pb-6">
      <View className="pb-3">
        <SummaryHeader template={template} />
      </View>
      {allowed === false ? (
        <Text className="pb-3 text-[13px] leading-5 text-muted-foreground">
          AI 정리는 팀 AI로 해요. 로그인한 팀원만 써요. 설정의 계정 칸에서 로그인해 주세요.
        </Text>
      ) : null}
      {allowed ? (
        <Organize text={text} replaced={replaced} onCards={(c) => onCards(c, true)} />
      ) : null}
      <NextActions found={found} onCards={onCards} />
      {allowed ? (
        <Transforms text={text} onPicked={(t) => setTemplate(t?.title ?? '요약')} />
      ) : null}
      <View className="border-t border-border py-3">
        <AiNotice />
      </View>
    </View>
  );
}

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

  return (
    <SummarySection title="요약">
      {run?.kind === 'running' ? (
        <Busy label="요약하는 중이에요" />
      ) : run?.kind === 'done' ? (
        <ResultLines text={run.text || '요약할 내용이 없었어요.'} />
      ) : (
        <>
          {run?.kind === 'error' ? <ErrorText message={run.message} /> : null}
          <Text className="text-[13px] leading-5 text-muted-foreground">
            받아쓴 글만 팀 AI로 보내서 요약하고 일정, 할 일을 다시 찾아요. 회의 참석자에게 미리 알려
            주세요.
          </Text>
          <SmallButton
            label={run?.kind === 'error' ? '다시 해 보기' : '요약하고 카드 다시 찾기'}
            primary
            onPress={() => void start()}
          />
        </>
      )}
    </SummarySection>
  );
}

/** 다음 할 일: 찾은 카드 후보. 확인을 누르면 확인한 카드로 저장해요. */
function NextActions({
  found,
  onCards,
}: {
  found: Found | null;
  onCards: (cards: Card[], byAi?: boolean) => void;
}) {
  if (!found) return null;
  const cards = found.kind === 'found' ? found.cards : [];
  const confirm = async (card: Card) => {
    const confirmed: Card = { ...card, status: 'confirmed' };
    await saveCard(confirmed);
    onCards(
      cards.map((c) => (c.id === card.id ? confirmed : c)),
      found.kind === 'found' ? found.byAi : undefined,
    );
  };
  return (
    <SummarySection title={`다음 할 일 ${cards.length}`}>
      {found.kind === 'finding' ? (
        <Busy label="일정, 약속, 할 일을 찾는 중이에요" />
      ) : found.kind === 'error' ? (
        <ErrorText message={found.message} />
      ) : cards.length === 0 ? (
        <Text className="text-[15px] text-muted-foreground">
          등록할 만한 일정이나 할 일은 못 찾았어요.
        </Text>
      ) : (
        <View className="gap-2">
          {found.byAi ? (
            <Badge variant="secondary" className="self-start">
              <Text>AI가 찾았어요</Text>
            </Badge>
          ) : null}
          {cards.map((c) => (
            <NextActionRow
              key={c.id}
              action={{
                type: c.type,
                title: c.title,
                meta: cardDetail(c) || undefined,
                state: c.status === 'confirmed' ? 'confirmed' : 'suggested',
              }}
              onConfirm={c.status === 'confirmed' ? undefined : () => void confirm(c)}
            />
          ))}
        </View>
      )}
    </SummarySection>
  );
}

/** 지시문 고르기, 돌리기, 자동으로 돌리기, 내 지시문 만들기와 지우기 */
function Transforms({
  text,
  onPicked,
}: {
  text: string;
  onPicked: (transform: SttTransform | undefined) => void;
}) {
  const [list, setList] = useState<SttTransform[]>([]);
  const [auto, setAuto] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [adding, setAdding] = useState(false);
  const autoRan = useRef(false);

  const apply = useCallback(
    async (transform: SttTransform) => {
      setPicked(transform.id);
      onPicked(transform);
      setRuns((r) => ({ ...r, [transform.id]: { kind: 'running' } }));
      try {
        const answer = await runTransform(transform, text);
        setRuns((r) => ({ ...r, [transform.id]: { kind: 'done', text: answer } }));
      } catch (e) {
        setRuns((r) => ({ ...r, [transform.id]: { kind: 'error', message: messageOf(e) } }));
      }
    },
    [text, onPicked],
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
    // 처음 한 번만 돌려요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    onPicked(undefined);
  };

  return (
    <SummarySection title={current ? current.title : '양식으로 정리'}>
      <View className="flex-row flex-wrap gap-2">
        {list.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => void apply(t)}
            disabled={runs[t.id]?.kind === 'running'}
            accessibilityRole="button"
          >
            <Badge variant={t.id === picked ? 'default' : 'outline'} className="h-8 px-3">
              <Text>{auto === t.id ? `${t.title}, 자동` : t.title}</Text>
            </Badge>
          </Pressable>
        ))}
        <Pressable onPress={() => setAdding((a) => !a)} accessibilityRole="button">
          <Badge variant="outline" className="h-8 px-3">
            <Text>내 양식 만들기</Text>
          </Badge>
        </Pressable>
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
        <View className="gap-3 pt-2">
          {run.kind === 'running' ? (
            <Busy label={`${current.title} 하는 중이에요`} />
          ) : run.kind === 'error' ? (
            <ErrorText message={run.message} />
          ) : (
            <ResultLines text={run.text} />
          )}
          <View className="flex-row flex-wrap gap-2">
            {run.kind === 'done' ? (
              <SmallButton label="공유" onPress={() => void Share.share({ message: run.text })} />
            ) : null}
            <SmallButton
              label={auto === current.id ? '자동으로 돌리기 끄기' : '받아쓰기 끝나면 자동으로'}
              onPress={() => void toggleAuto(current.id)}
            />
            {!isStarter(current) ? (
              <SmallButton label="양식 지우기" onPress={() => void remove(current.id)} />
            ) : null}
          </View>
        </View>
      ) : null}
    </SummarySection>
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
    <View className="gap-2 pt-2">
      <Input
        value={title}
        onChangeText={setTitle}
        placeholder="이름 (예: 발표 대본으로)"
        maxLength={40}
        accessibilityLabel="양식 이름"
      />
      <Textarea
        value={instructions}
        onChangeText={setInstructions}
        placeholder="AI에게 할 말 (예: 받아쓴 글을 3분 발표 대본으로 바꿔 줘)"
        maxLength={4000}
        accessibilityLabel="양식 지시문"
      />
      {error ? <ErrorText message={error} /> : null}
      <SmallButton label="저장하고 돌리기" primary onPress={() => void save()} />
    </View>
  );
}

function ResultLines({ text }: { text: string }) {
  return (
    <View className="gap-2">
      {linesOf(text).map((line, i) => (
        <SummaryLine key={i}>{line}</SummaryLine>
      ))}
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
