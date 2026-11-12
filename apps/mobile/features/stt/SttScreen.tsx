import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';

import { findCardsFromMemo } from '@/features/cards';

import { MAX_SECONDS } from './engine';
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

function Recorder({ model }: { model: SttModel }) {
  const { state, start, finish, cancel, reset } = useDictation(model);
  const [cardMessage, setCardMessage] = useState<string | null>(null);

  const findCards = async (text: string) => {
    try {
      setCardMessage(await findCardsFromMemo(text));
    } catch (e) {
      setCardMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="gap-4">
      {state.phase === 'recording' ? (
        <View className="gap-3">
          <BigButton label={`끝내기  ${clock(state.seconds)}`} onPress={finish} danger />
          <Text className="text-center text-[13px] text-muted-foreground">
            최대 {MAX_SECONDS / 60}분까지 받아써요
          </Text>
          <SmallButton label="녹음 버리기" onPress={cancel} />
        </View>
      ) : state.phase === 'transcribing' ? (
        <BigButton label={`받아쓰는 중 ${Math.round(state.ratio * 100)}%`} disabled />
      ) : (
        <BigButton
          label="말하기 시작"
          onPress={() => {
            setCardMessage(null);
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
              <SmallButton label="카드 찾기" onPress={() => findCards(state.result.text)} primary />
              <SmallButton
                label="공유"
                onPress={() => Share.share({ message: state.result.text })}
              />
            </View>
          ) : null}
          {cardMessage ? <Text className="text-[14px] text-foreground">{cardMessage}</Text> : null}
        </View>
      ) : null}
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
