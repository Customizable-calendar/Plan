import { timedLines, toSpeakerText, toSrt, toTimedText } from '@noteapp/extractor';
import type { Card } from '@noteapp/shared';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { cardDetail, findCardsFromTranscript, typeLabel } from '@/features/cards';
import { listTagCategories } from '@/lib/tag-categories';
import { hasKeepAlive } from '@/modules/stt-native';

import {
  discardLeftover,
  leftoverSeconds,
  MAX_SECONDS,
  prewarmStt,
  type SttResult,
  type SttSegment,
} from './engine';
import type { SttModel, SttModelId } from './models';
import { ImportAudio, KeepAudioToggle, LevelBar, MicCheck, RecordingList } from './AudioTools';
import { shareTextFile, stamp } from './share';
import { SpeakerSplit } from './SpeakerSplit';
import { keepAudioEnabled, setKeepAudio } from './recordings';
import { SmallButton } from './SmallButton';
import { TranscriptAi } from './TranscriptAi';
import { useDictation } from './useDictation';
import { type ModelRow, useModels } from './useModels';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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

  // 고른 모델을 미리 띄워 둬요. 녹음 버튼을 누르면 바로 받아써요(안 쓰면 몇 분 뒤 닫아요).
  useEffect(() => {
    if (model) prewarmStt(model);
  }, [model]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-5 pb-12">
      <View className="gap-1">
        <Text className="text-[22px] font-bold text-foreground">받아쓰기</Text>
        <Text className="text-[14px] leading-5 text-muted-foreground">
          말한 내용을 이 기기 안에서 글로 바꿔요. 소리는 밖으로 보내지 않아요.
        </Text>
      </View>

      {!available ? (
        <View className="gap-1 rounded-xl bg-muted p-4">
          <Text className="text-[15px] font-bold text-foreground">개발 빌드에서만 돼요</Text>
          <Text className="text-[14px] leading-5 text-muted-foreground">
            음성 인식은 네이티브 모듈이라 Expo Go에는 없어요. EAS 개발 빌드로 설치한 앱에서 열어
            주세요.
          </Text>
        </View>
      ) : null}

      <View className="gap-3">
        <Text className="text-[13px] font-bold text-muted-foreground">음성 인식 모델</Text>
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
        {error ? <Text className="text-[14px] text-destructive">{error}</Text> : null}
      </View>

      {available && model ? <Recorder key={model.id} model={model} /> : null}
    </ScrollView>
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
      className={`flex-row items-center gap-3 rounded-xl border p-4 ${
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-card'
      }`}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-bold text-foreground">{model.label}</Text>
        <Text className="text-[13px] text-muted-foreground">
          {progress !== undefined
            ? `받는 중 ${Math.round(progress * 100)}%`
            : partial !== null
              ? `${model.note} · ${Math.round(partial * 100)}% 받다 멈춤`
              : model.note}
        </Text>
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

/** 받아쓴 글에서 카드를 찾는 상태: 찾는 중, 찾은 카드, 실패 */
type Found =
  | { kind: 'finding' }
  | { kind: 'found'; cards: Card[]; byAi?: boolean }
  | { kind: 'error'; message: string };

function Recorder({ model }: { model: SttModel }) {
  const [found, setFound] = useState<Found | null>(null);
  // 앱이 꺼져서 다 못 받아쓴 녹음(초). 없으면 null
  const [left, setLeft] = useState(() => leftoverSeconds());

  // 받아쓰기가 끝나면 바로 회의록에서 일정·약속·할 일을 찾아 확인 기다리는 카드로 넣어요.
  const findCards = useCallback(async (result: SttResult) => {
    // 엔진이 문장마다 줄을 나눠 둔 글이에요(punctuateSpoken).
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

  // 녹음 원본 남기기(이 기기 설정). 기본은 꺼져 있어요.
  const [keepAudio, setKeepAudioState] = useState(false);
  useEffect(() => {
    keepAudioEnabled().then(setKeepAudioState, () => {});
  }, []);
  const toggleKeepAudio = (on: boolean) => {
    setKeepAudioState(on);
    void setKeepAudio(on);
  };

  const { state, start, finish, resume, again, cancel, reset } = useDictation(model, findCards, {
    words,
    keepAudio,
  });
  const idle = state.phase === 'idle' || state.phase === 'error' || state.phase === 'done';

  // 화자를 나누면 받아쓴 덩어리에 화자가 붙어요. 결과가 바뀌면(key) 처음 받아쓴 걸로 돌아가요.
  const resultKey =
    state.phase === 'done' ? `${state.result.durationMs}:${state.result.text.length}` : '';
  const [labeled, setLabeled] = useState<{ key: string; segments: SttSegment[] } | null>(null);
  const segments =
    state.phase === 'done'
      ? labeled?.key === resultKey
        ? labeled.segments
        : state.result.segments
      : [];
  const bySpeaker = segments.some((seg) => seg.speaker !== undefined);
  // 화자를 나눴으면 "화자 1: …" 줄로 보여 주고 공유해요. AI 정리에도 이 글을 줘요.
  const shownText =
    state.phase !== 'done'
      ? ''
      : bySpeaker
        ? toSpeakerText(timedLines(segments))
        : state.result.text;

  return (
    <View className="gap-4">
      {left !== null && (state.phase === 'idle' || state.phase === 'error') ? (
        <View className="gap-3 rounded-xl bg-muted p-4">
          <Text className="text-[14px] leading-5 text-foreground">
            다 못 받아쓴 녹음이 있어요({clock(left)}). 앱이 꺼졌을 때 남은 거예요.
          </Text>
          <View className="flex-row gap-2">
            <SmallButton
              label="이어서 받아쓰기"
              primary
              onPress={() => {
                setLeft(null);
                setFound(null);
                void resume();
              }}
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

      {state.phase === 'recording' ? (
        <View className="gap-3">
          <BigButton label={`끝내기  ${clock(state.seconds)}`} onPress={finish} danger />
          <LevelBar level={state.level} />
          <Text className="text-center text-[13px] leading-5 text-muted-foreground">
            최대 {MAX_SECONDS / 3600}시간까지 받아써요.
            {hasKeepAlive()
              ? ' 화면이 꺼지거나 앱을 나가도 녹음을 이어 가요(알림이 떠 있어요).'
              : ' 화면을 켜 두고 앱을 나가지 마세요.'}
            {keepAudio ? ' 녹음 원본도 이 기기에 남기는 중이에요.' : ''}
          </Text>
          <View className="gap-2 rounded-xl border border-border bg-card p-4">
            <Text className="text-[13px] font-bold text-muted-foreground">
              {state.backlog > 0 ? `받아쓰는 중 (밀린 조각 ${state.backlog}개)` : '받아쓰는 중'}
            </Text>
            {state.partial || state.preview ? (
              <Text className="text-[16px] leading-6 text-foreground">
                {state.partial}
                {state.partial && state.preview ? ' ' : ''}
                {/* 미리 받아쓴 글이라 조각을 받아쓰면 조금 바뀔 수 있어요. */}
                <Text className="text-muted-foreground">{state.preview}</Text>
              </Text>
            ) : (
              <Text className="text-[16px] leading-6 text-muted-foreground">
                말하면 몇 초 뒤에 글이 나와요. 회색 글은 미리 받아쓴 거라 조금 바뀔 수 있어요.
              </Text>
            )}
          </View>
          <SmallButton label="녹음 버리기" onPress={cancel} />
        </View>
      ) : state.phase === 'transcribing' ? (
        <BigButton label={`남은 부분 받아쓰는 중 ${Math.round(state.ratio * 100)}%`} disabled />
      ) : (
        <BigButton
          label="말하기 시작"
          onPress={() => {
            setFound(null);
            setLeft(null); // 새로 녹음하면 남은 녹음은 지워져요.
            void start();
          }}
        />
      )}

      {idle ? (
        <View className="gap-3">
          <MicCheck />
          <ImportAudio
            onImported={(recording) => {
              setFound(null);
              setLeft(null); // 가져와서 받아쓰면 남은 녹음은 지워져요.
              void again(recording);
            }}
          />
          <KeepAudioToggle on={keepAudio} onChange={toggleKeepAudio} />
          <RecordingList
            refreshKey={`${state.phase}:${keepAudio}`}
            onAgain={(recording) => {
              setFound(null);
              setLeft(null); // 다시 받아쓰면 남은 녹음은 지워져요.
              void again(recording);
            }}
          />
        </View>
      ) : null}

      {state.phase === 'error' ? (
        <View className="gap-2">
          <Text className="text-[14px] text-destructive">{state.message}</Text>
          <SmallButton label="다시" onPress={reset} />
        </View>
      ) : null}

      {state.phase === 'done' ? (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text className="text-[13px] font-bold text-muted-foreground">
            받아쓴 글 ({clock(Math.round(state.result.durationMs / 1000))})
          </Text>
          <Text selectable className="text-[16px] leading-6 text-foreground">
            {shownText || '알아들은 말이 없어요.'}
          </Text>
          {state.result.text ? (
            <View className="flex-row flex-wrap gap-2">
              <SmallButton label="공유" onPress={() => Share.share({ message: shownText })} />
              <SmallButton
                label="시각 붙여 공유"
                onPress={() =>
                  void shareTextFile(
                    `받아쓰기 ${stamp()}.txt`,
                    toTimedText(timedLines(segments)),
                    'text/plain',
                  ).catch(() => {})
                }
              />
              <SmallButton
                label="자막(SRT) 공유"
                onPress={() =>
                  void shareTextFile(
                    `받아쓰기 ${stamp()}.srt`,
                    toSrt(timedLines(segments)),
                    'application/x-subrip',
                  ).catch(() => {})
                }
              />
            </View>
          ) : null}
          <SpeakerSplit
            key={resultKey}
            recordingId={state.result.recordingId}
            segments={state.result.segments}
            onSegments={(next) => setLabeled({ key: resultKey, segments: next })}
          />
        </View>
      ) : null}

      {state.phase === 'done' && found ? <FoundCards found={found} /> : null}

      {state.phase === 'done' && state.result.text && found?.kind !== 'finding' ? (
        <TranscriptAi
          key={resultKey}
          text={shownText}
          replaced={found?.kind === 'found' ? found.cards.map((c) => c.id) : []}
          onCards={(cards) => setFound({ kind: 'found', cards, byAi: true })}
        />
      ) : null}
    </View>
  );
}

/** 받아쓴 글에서 찾은 카드. 카드 탭의 "확인 기다리는 카드"에도 같이 들어가요. */
function FoundCards({ found }: { found: Found }) {
  if (found.kind === 'finding')
    return (
      <Text className="text-[14px] text-muted-foreground">일정, 약속, 할 일을 찾는 중이에요</Text>
    );
  if (found.kind === 'error')
    return <Text className="text-[14px] text-destructive">{found.message}</Text>;
  if (found.cards.length === 0)
    return (
      <Text className="text-[14px] text-muted-foreground">
        등록할 만한 일정이나 할 일은 못 찾았어요.
      </Text>
    );

  return (
    <View className="gap-3 rounded-xl bg-primary-soft p-4">
      <Text className="text-[15px] font-bold text-foreground">
        {found.byAi ? 'AI가 찾은 ' : ''}카드 {found.cards.length}장을 추천해요
      </Text>
      {found.cards.map((c) => {
        const when = cardDetail(c);
        return (
          <View key={c.id} className="gap-0.5">
            <Text className="text-[15px] text-foreground">
              <Text className="font-bold">{typeLabel[c.type]}</Text> {c.title}
            </Text>
            {when ? <Text className="text-[13px] text-muted-foreground">{when}</Text> : null}
          </View>
        );
      })}
      <SmallButton label="카드 탭에서 확인하기" onPress={() => router.push('/cards')} primary />
    </View>
  );
}

function BigButton({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`h-14 items-center justify-center rounded-xl ${
        danger ? 'bg-destructive' : disabled ? 'bg-muted' : 'bg-primary'
      }`}
    >
      <Text
        className={`text-[17px] font-bold ${
          disabled ? 'text-muted-foreground' : 'text-primary-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
