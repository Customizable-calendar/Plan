import type { Card, SttNote } from '@noteapp/shared';
import {
  BottomSheet,
  Button,
  cn,
  Icon,
  Input,
  Progress,
  RecordMiniBar,
  RecordPanel,
  Scrim,
  Text,
} from '@noteapp/ui';
import { CheckIcon, MicIcon, Trash2Icon } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { findCardsFromTranscript } from '@/features/cards';
import { listTagCategories } from '@/lib/tag-categories';
import { hasKeepAlive } from '@/modules/stt-native';

import { ImportAudio, KeepAudioToggle, LevelBar, MicCheck, RecordingList } from './AudioTools';
import {
  discardLeftover,
  leftoverSeconds,
  MAX_SECONDS,
  prewarmStt,
  type SttResult,
  type SttSegment,
} from './engine';
import type { SttModel, SttModelId } from './models';
import { type Mark, NoteView } from './NoteView';
import { listSttNotes, noteFromResult, removeSttNote, resultOfNote, saveSttNote } from './notes';
import { keepAudioEnabled, setKeepAudio } from './recordings';
import { SmallButton } from './SmallButton';
import type { Found } from './TranscriptAi';
import { useDictation } from './useDictation';
import { type ModelRow, useModels } from './useModels';

// 받아쓰기 화면. 디자인 시스템(note-app-design-system)의 녹음 시트, 녹음 노트를 따라요(클로바노트 참고).
// 1) 고르기: 모델, 마이크 확인, 파일 가져오기, 원본 남기기, 남긴 녹음
// 2) 녹음: 아래 녹음 시트(RecordPanel). 누르면 작은 막대(RecordMiniBar)로 줄어요. 북마크, 메모, 잠시 멈춤
// 3) 다 받아쓰면 녹음 노트(NoteView): 받아쓴 글, 요약, 메모 탭과 재생 막대

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** 받아쓰기 확인 화면: 모델 받기, 말하기, 받아쓴 글로 카드 찾기 */
export function SttScreen() {
  // 웹(아이폰 stage 링크)에는 기기 안 음성 인식도, 모델 파일 저장도 없어요.
  if (Platform.OS === 'web')
    return (
      <View className="flex-1 gap-2 bg-background p-5">
        <Text className="text-[22px] font-bold text-foreground">받아쓰기</Text>
        <Text className="text-[14px] leading-5 text-muted-foreground">
          받아쓰기는 폰 안에서 음성 인식을 돌려서 앱(Android stage APK)에서만 돼요. 웹에서는 못
          써요.
        </Text>
      </View>
    );
  return <SttMain />;
}

function SttMain() {
  const { rows, error, download, stop, remove, available } = useModels();
  const [picked, setPicked] = useState<SttModelId | null>(null);

  const model = useMemo(() => {
    const ready = rows.filter((r) => r.downloaded);
    return (ready.find((r) => r.model.id === picked) ?? ready[0])?.model;
  }, [rows, picked]);

  const models = (
    <View>
      <Text className="pb-2 text-[13px] font-bold text-muted-foreground">음성 인식 모델</Text>
      {rows.map((row) => (
        <ModelItem
          key={row.model.id}
          row={row}
          selected={row.model.id === model?.id}
          onSelect={() => setPicked(row.model.id)}
          onDownload={() => download(row.model)}
          onStop={() => stop(row.model)}
          onRemove={() => remove(row.model)}
        />
      ))}
      {error ? <Text className="pt-2 text-[14px] text-destructive">{error}</Text> : null}
    </View>
  );

  if (available && model) return <Recorder key={model.id} model={model} models={models} />;
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-5 pb-12">
      <Intro />
      {!available ? (
        <View className="gap-1 border-t border-border pt-3">
          <Text className="text-[15px] font-bold text-foreground">개발 빌드에서만 돼요</Text>
          <Text className="text-[14px] leading-5 text-muted-foreground">
            음성 인식은 네이티브 모듈이라 Expo Go에는 없어요. EAS 개발 빌드로 설치한 앱에서 열어
            주세요.
          </Text>
        </View>
      ) : null}
      {models}
    </ScrollView>
  );
}

function Intro() {
  return (
    <View className="gap-1">
      <Text className="text-[22px] font-bold text-foreground">받아쓰기</Text>
      <Text className="text-[14px] leading-5 text-muted-foreground">
        말한 내용을 이 기기 안에서 글로 바꿔요. 소리는 밖으로 보내지 않아요.
      </Text>
    </View>
  );
}

function ModelItem({
  row,
  selected,
  onSelect,
  onDownload,
  onStop,
  onRemove,
}: {
  row: ModelRow;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onStop: () => void;
  onRemove: () => void;
}) {
  const { model, downloaded, progress, partial } = row;
  return (
    <Pressable
      onPress={downloaded ? onSelect : undefined}
      accessibilityRole={downloaded ? 'radio' : undefined}
      accessibilityState={{ selected }}
      className="min-h-16 flex-row items-center gap-3 border-t border-border py-3"
    >
      <View className="w-5 items-center">
        {selected ? <Icon as={CheckIcon} size={18} className="text-primary" /> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={cn('text-[15px] text-foreground', selected && 'font-bold text-primary')}>
          {model.label}
        </Text>
        <Text className="text-[13px] text-muted-foreground">
          {progress !== undefined
            ? `받는 중 ${Math.round(progress * 100)}%`
            : partial !== null
              ? `${model.note}, ${Math.round(partial * 100)}% 받다 멈춤`
              : model.note}
        </Text>
        {progress !== undefined ? (
          <Progress value={Math.round(progress * 100)} className="mt-1 h-1" />
        ) : null}
      </View>
      {progress !== undefined ? (
        <SmallButton label="멈추기" onPress={onStop} />
      ) : downloaded ? (
        <SmallButton label="지우기" onPress={onRemove} />
      ) : (
        <SmallButton label={partial !== null ? '이어 받기' : '받기'} onPress={onDownload} primary />
      )}
    </Pressable>
  );
}

function Recorder({ model, models }: { model: SttModel; models: ReactNode }) {
  const [found, setFound] = useState<Found | null>(null);
  // 앱이 꺼져서 다 못 받아쓴 녹음(초). 없으면 null
  const [left, setLeft] = useState(() => leftoverSeconds());

  // 받아쓰기가 끝나면 바로 회의록에서 일정·약속·할 일을 찾아 확인 기다리는 카드로 넣어요.
  const findCards = useCallback(async (result: SttResult) => {
    const text = result.text;
    if (!text.trim()) return;
    setFound({ kind: 'finding' });
    try {
      setFound({ kind: 'found', cards: await findCardsFromTranscript(text) });
    } catch (e) {
      setFound({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  // 내 해시태그 카테고리 이름과 태그를 받아쓰기 예시로 줘서 내가 쓰는 말을 더 맞게 받아써요.
  const [words, setWords] = useState<string[]>([]);
  useEffect(() => {
    listTagCategories()
      .then((categories) => setWords(categories.flatMap((c) => [c.name, ...c.tags])))
      .catch(() => {});
  }, []);

  // 고른 모델을 미리 띄워 둬요. 녹음 버튼을 누르면 바로 받아써요(안 쓰면 몇 분 뒤 닫아요).
  // Qwen3는 내 단어를 열 때 넣어서 단어를 불러온 뒤에 띄워요.
  useEffect(() => {
    prewarmStt(model, words);
  }, [model, words]);

  // 녹음 원본 남기기(이 기기 설정). 기본은 꺼져 있어요.
  const [keepAudio, setKeepAudioState] = useState(false);
  useEffect(() => {
    keepAudioEnabled().then(setKeepAudioState, () => {});
  }, []);
  const toggleKeepAudio = (on: boolean) => {
    setKeepAudioState(on);
    void setKeepAudio(on);
  };

  const { state, start, finish, resume, again, togglePause, cancel, reset } = useDictation(
    model,
    findCards,
    { words, keepAudio },
  );

  // 녹음 중 북마크와 메모(녹음 시작부터 ms). 새로 녹음하면 비워요.
  const [marks, setMarks] = useState<Mark[]>([]);
  // 화자를 나누면 받아쓴 덩어리에 화자가 붙어요. 결과가 바뀌면(key) 처음 받아쓴 걸로 돌아가요.
  const resultKey =
    state.phase === 'done' ? `${state.result.durationMs}:${state.result.text.length}` : '';
  const [labeled, setLabeled] = useState<{ key: string; segments: SttSegment[] } | null>(null);

  const segmentsNow =
    state.phase === 'done'
      ? labeled?.key === resultKey
        ? labeled.segments
        : state.result.segments
      : null;
  // 받아쓰기가 끝나면 기록(stt_notes)으로 남겨요. 같은 결과면 같은 기록을 고쳐 써요.
  const noteRef = useRef<{ key: string; id: string; createdAt: string } | null>(null);
  const doneResult = state.phase === 'done' ? state.result : null;
  useEffect(() => {
    if (!doneResult || !segmentsNow || !doneResult.text.trim()) return;
    if (noteRef.current?.key !== resultKey) {
      const now = new Date();
      noteRef.current = {
        key: resultKey,
        id: `stt-note-${now.getTime()}`,
        createdAt: now.toISOString(),
      };
    }
    const { id, createdAt } = noteRef.current;
    void saveSttNote(
      noteFromResult({
        id,
        createdAt,
        result: doneResult,
        segments: segmentsNow,
        marks,
        modelId: model.id,
      }),
    ).catch(() => {});
  }, [doneResult, segmentsNow, marks, resultKey, model.id]);

  // 지난 받아쓰기를 다시 열었을 때
  const [opened, setOpened] = useState<SttNote | null>(null);

  const begin = (run: () => void) => {
    setFound(null);
    setLeft(null); // 새로 받아쓰면 남은 녹음은 지워져요.
    setMarks([]);
    run();
  };

  if (opened)
    return (
      <NoteView
        key={opened.id}
        result={resultOfNote(opened)}
        segments={opened.segments}
        marks={opened.marks}
        found={null}
        onCards={() => {}}
        onSegments={(next) => {
          const updated = { ...opened, segments: next };
          setOpened(updated);
          void saveSttNote(updated).catch(() => {});
        }}
        onNew={() => setOpened(null)}
      />
    );

  if (state.phase === 'done')
    return (
      <NoteView
        key={resultKey}
        result={state.result}
        segments={labeled?.key === resultKey ? labeled.segments : state.result.segments}
        marks={marks}
        found={found}
        onCards={(cards: Card[], byAi?: boolean) => setFound({ kind: 'found', cards, byAi })}
        onSegments={(next) => setLabeled({ key: resultKey, segments: next })}
        onNew={() => {
          setFound(null);
          setMarks([]);
          reset();
        }}
      />
    );

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 p-5 pb-40">
        <Intro />

        {left !== null && state.phase !== 'recording' && state.phase !== 'transcribing' ? (
          <View className="gap-2 border-t border-border pt-3">
            <Text className="text-[15px] leading-6 text-foreground">
              다 못 받아쓴 녹음이 있어요({clock(left)}). 앱이 꺼졌을 때 남은 거예요.
            </Text>
            <View className="flex-row gap-2">
              <SmallButton
                label="이어서 받아쓰기"
                primary
                onPress={() => begin(() => void resume())}
              />
              <SmallButton
                label="버리기"
                onPress={() => {
                  discardLeftover();
                  setLeft(null);
                }}
              />
            </View>
          </View>
        ) : null}

        {state.phase === 'transcribing' ? (
          <View className="gap-2">
            <Text className="text-[15px] font-bold text-foreground">
              남은 부분 받아쓰는 중 {Math.round(state.ratio * 100)}%
            </Text>
            <Progress value={Math.round(state.ratio * 100)} className="h-1" />
          </View>
        ) : state.phase === 'recording' ? (
          <LiveText partial={state.partial} preview={state.preview} backlog={state.backlog} />
        ) : (
          <>
            <Button size="lg" onPress={() => begin(() => void start())}>
              <Icon as={MicIcon} size={18} className="text-primary-foreground" />
              <Text>말하기 시작</Text>
            </Button>
            {state.phase === 'error' ? (
              <View className="gap-2">
                <Text className="text-[14px] text-destructive">{state.message}</Text>
                <SmallButton label="다시" onPress={reset} />
              </View>
            ) : null}
            <View>
              <MicCheck />
              <ImportAudio onImported={(recording) => begin(() => void again(recording))} />
              <KeepAudioToggle on={keepAudio} onChange={toggleKeepAudio} />
              <RecordingList
                refreshKey={`${state.phase}:${keepAudio}`}
                onAgain={(recording) => begin(() => void again(recording))}
              />
            </View>
            <NoteList refreshKey={state.phase} onOpen={setOpened} />
            {models}
          </>
        )}
      </ScrollView>

      {state.phase === 'recording' ? (
        <RecordSheet
          seconds={state.seconds}
          paused={state.paused}
          level={state.level}
          preview={tail(state.partial, state.preview)}
          bookmarks={marks.filter((m) => !m.text).length}
          keepAudio={keepAudio}
          onPause={togglePause}
          onBookmark={() => setMarks((m) => [...m, { ms: state.seconds * 1000 }])}
          onMemo={(text) => setMarks((m) => [...m, { ms: state.seconds * 1000, text }])}
          onCancel={() => void cancel()}
          onFinish={() => void finish()}
        />
      ) : null}
    </View>
  );
}

/** 녹음 시트에 보여 줄 끝부분. 확정된 글 끝과 회색(미리 받아쓴) 글 */
function tail(partial: string, preview: string): { done: string; pending?: string } {
  const done = partial.replace(/\s+/g, ' ').trim();
  return {
    done: done.length > 80 ? `${done.slice(-80).replace(/^\S*\s/, '')}` : done,
    pending: preview || undefined,
  };
}

/** 녹음하는 동안 위쪽에 받아쓴 글을 계속 보여 줘요. 회색은 미리 받아쓴 글이에요. */
function LiveText({
  partial,
  preview,
  backlog,
}: {
  partial: string;
  preview: string;
  backlog: number;
}) {
  return (
    <View className="gap-2">
      <Text className="text-[13px] font-bold text-muted-foreground">
        {backlog > 0 ? `받아쓰는 중, 밀린 조각 ${backlog}개` : '받아쓰는 중'}
      </Text>
      {partial || preview ? (
        <Text className="text-base leading-7 text-foreground">
          {partial}
          {partial && preview ? ' ' : ''}
          <Text className="text-base text-muted-foreground">{preview}</Text>
        </Text>
      ) : (
        <Text className="text-base leading-7 text-muted-foreground">
          말하면 몇 초 뒤에 글이 나와요. 회색 글은 미리 받아쓴 거라 조금 바뀔 수 있어요.
        </Text>
      )}
    </View>
  );
}

/** 녹음 시트(디자인 시스템 RecordPanel). 시트를 누르면 작은 막대로 줄고, 막대를 누르면 다시 열려요. */
function RecordSheet({
  seconds,
  paused,
  level,
  preview,
  bookmarks,
  keepAudio,
  onPause,
  onBookmark,
  onMemo,
  onCancel,
  onFinish,
}: {
  seconds: number;
  paused: boolean;
  level: number;
  preview: { done: string; pending?: string };
  bookmarks: number;
  keepAudio: boolean;
  onPause: () => void;
  onBookmark: () => void;
  onMemo: (text: string) => void;
  onCancel: () => void;
  onFinish: () => void;
}) {
  const [mini, setMini] = useState(false);
  const [memo, setMemo] = useState<string | null>(null);
  const time = clock(seconds);

  if (mini)
    return (
      <View className="absolute bottom-6 left-4 right-4">
        <RecordMiniBar
          time={time}
          paused={paused}
          onOpen={() => setMini(false)}
          onBookmark={onBookmark}
          onFinish={onFinish}
        />
      </View>
    );

  return (
    <>
      <Scrim />
      <View className="absolute bottom-0 left-0 right-0">
        <Pressable onPress={() => setMini(true)} accessibilityLabel="녹음 시트 줄이기">
          <BottomSheet>
            <RecordPanel
              time={time}
              paused={paused}
              bookmarks={bookmarks}
              preview={preview.done || preview.pending ? preview : undefined}
              onPause={onPause}
              onBookmark={onBookmark}
              onMemo={() => setMemo('')}
              onCancel={onCancel}
              onFinish={onFinish}
            />
            <LevelBar level={level} />
            {memo !== null ? (
              <View className="flex-row items-center gap-2">
                <Input
                  className="flex-1"
                  value={memo}
                  onChangeText={setMemo}
                  placeholder={`${time} 메모`}
                  autoFocus
                  accessibilityLabel="녹음 중 메모"
                />
                <SmallButton
                  label="남기기"
                  primary
                  onPress={() => {
                    if (memo.trim()) onMemo(memo.trim());
                    setMemo(null);
                  }}
                />
              </View>
            ) : null}
            <Text className="text-center text-xs leading-5 text-muted-foreground">
              {`최대 ${MAX_SECONDS / 3600}시간까지 받아써요. `}
              {hasKeepAlive()
                ? '화면이 꺼지거나 앱을 나가도 녹음을 이어 가요.'
                : '화면을 켜 두고 앱을 나가지 마세요.'}
              {keepAudio ? ' 녹음 원본도 이 기기에 남겨요.' : ''}
            </Text>
          </BottomSheet>
        </Pressable>
      </View>
    </>
  );
}

const minutes = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
};

/** 지난 받아쓰기(stt_notes). 누르면 녹음 노트로 다시 열어요. */
function NoteList({ refreshKey, onOpen }: { refreshKey: string; onOpen: (note: SttNote) => void }) {
  const [notes, setNotes] = useState<SttNote[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    listSttNotes()
      .then((list) => {
        if (alive) setNotes(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refreshKey, version]);

  if (notes.length === 0) return null;
  return (
    <View>
      <Text className="pb-2 text-[13px] font-bold text-muted-foreground">지난 받아쓰기</Text>
      {notes.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => onOpen(n)}
          accessibilityRole="button"
          className="min-h-16 flex-row items-center gap-2 border-t border-border py-2.5"
        >
          <View className="flex-1 gap-0.5">
            <Text className="text-[15px] text-foreground">{n.title}</Text>
            <Text numberOfLines={1} className="text-[13px] text-muted-foreground">
              {minutes(n.durationMs)}, {n.text.split('\n')[0]}
            </Text>
          </View>
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel="기록 지우기"
            onPress={() => {
              void removeSttNote(n.id).then(() => setVersion((v) => v + 1));
            }}
          >
            <Icon as={Trash2Icon} size={18} className="text-foreground" />
          </Button>
        </Pressable>
      ))}
    </View>
  );
}
