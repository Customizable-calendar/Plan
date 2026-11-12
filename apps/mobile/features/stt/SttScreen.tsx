import type { Card } from '@noteapp/shared';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';

import { cardDetail, findCardsFromTranscript, typeLabel } from '@/features/cards';

import { discardLeftover, leftoverSeconds, MAX_SECONDS, type SttResult } from './engine';
import type { SttModel, SttModelId } from './models';
import { useDictation } from './useDictation';
import { type ModelRow, useModels } from './useModels';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** 받아쓰기 확인 화면: 모델 받기, 말하기, 받아쓴 글로 카드 찾기 */
export function SttScreen() {
  const { rows, error, download, stop, remove, available } = useModels();
  const [picked, setPicked] = useState<SttModelId | null>(null);

  const model = useMemo(() => {
    const ready = rows.filter((r) => r.downloaded);
    return (ready.find((r) => r.model.id === picked) ?? ready[0])?.model;
  }, [rows, picked]);

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
  const { model, downloaded, progress } = row;
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
          {progress !== undefined ? `받는 중 ${Math.round(progress * 100)}%` : model.note}
        </Text>
      </View>
      {progress !== undefined ? (
        <SmallButton label="멈추기" onPress={onStop} />
      ) : downloaded ? (
        <SmallButton label="지우기" onPress={onRemove} />
      ) : (
        <SmallButton label="받기" onPress={onDownload} primary />
      )}
    </Pressable>
  );
}

/** 받아쓴 글에서 카드를 찾는 상태: 찾는 중, 찾은 카드, 실패 */
type Found =
  { kind: 'finding' } | { kind: 'found'; cards: Card[] } | { kind: 'error'; message: string };

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

  const { state, start, finish, resume, cancel, reset } = useDictation(model, findCards);

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
          <Text className="text-center text-[13px] leading-5 text-muted-foreground">
            최대 {MAX_SECONDS / 3600}시간까지 받아써요. 화면을 켜 두고 앱을 나가지 마세요.
          </Text>
          <View className="gap-2 rounded-xl border border-border bg-card p-4">
            <Text className="text-[13px] font-bold text-muted-foreground">
              {state.backlog > 0 ? `받아쓰는 중 (밀린 조각 ${state.backlog}개)` : '받아쓰는 중'}
            </Text>
            <Text className="text-[16px] leading-6 text-foreground">
              {state.partial || '말이 쉬는 곳마다(20~30초) 글이 나와요.'}
            </Text>
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
            {state.result.text || '알아들은 말이 없어요.'}
          </Text>
          {state.result.text ? (
            <View className="flex-row flex-wrap gap-2">
              <SmallButton
                label="공유"
                onPress={() => Share.share({ message: state.result.text })}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {state.phase === 'done' && found ? <FoundCards found={found} /> : null}
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
        카드 {found.cards.length}장을 추천해요
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

function SmallButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`h-9 justify-center self-start rounded-md px-3 ${
        primary ? 'bg-primary' : 'border border-border bg-background'
      }`}
    >
      <Text
        className={`text-[14px] font-bold ${primary ? 'text-primary-foreground' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
