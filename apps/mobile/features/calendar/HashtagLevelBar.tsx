import { Button, Progress, Text } from '@noteapp/ui';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { extractAutoHashtags, TAG_LEVEL_CONFIG, type TagExtractionLevel } from './autoTags';
import { useTagExtractionLevel } from './tagStore';

const LEVELS: readonly TagExtractionLevel[] = [1, 2, 3, 4, 5];

/**
 * 해시태그 자동 추출 강도(1~5단계)를 막대 게이지와 단계 버튼으로 조절하는 컨트롤이에요.
 * 변경 즉시 기기 저장소에 반영되며 캘린더, 그래프, 수행 확인 화면의 추출 개수에 실시간 적용돼요.
 */
export function HashtagLevelBar({
  compact = false,
  showPreview = false,
}: {
  compact?: boolean;
  showPreview?: boolean;
}) {
  const [level, setLevel] = useTagExtractionLevel();
  const [sampleText, setSampleText] = useState('주간 백엔드 API 코드 리뷰 및 배포 점검');

  const cfg = TAG_LEVEL_CONFIG[level];
  const progressValue = ((level - 1) / (LEVELS.length - 1)) * 100;

  const previewTags = useMemo(
    () => (showPreview && sampleText.trim() ? extractAutoHashtags(sampleText, { level }) : []),
    [level, sampleText, showPreview],
  );

  const stepLevel = (delta: -1 | 1) => {
    const next = Math.min(5, Math.max(1, level + delta)) as TagExtractionLevel;
    if (next !== level) {
      void setLevel(next);
    }
  };

  return (
    <View
      className={
        compact
          ? 'gap-2 rounded-xl border border-border bg-muted/40 p-3'
          : 'gap-3 rounded-xl border border-border bg-card p-3.5'
      }
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text
          className={
            compact ? 'text-xs font-bold text-foreground' : 'text-sm font-bold text-foreground'
          }
        >
          해시태그 자동 추출 강도
        </Text>
        <View className="rounded-full bg-primary-soft px-2.5 py-0.5">
          <Text className="text-[11px] font-bold text-primary-soft-foreground">
            {level}단계 {cfg.label} (최대 {cfg.maxTags}개)
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={level <= 1}
            accessibilityLabel="해시태그 추출 강도 낮추기"
            onPress={() => stepLevel(-1)}
          >
            <Text>-</Text>
          </Button>
          <View className="flex-1 gap-1.5">
            <Progress value={progressValue} className="h-2.5" />
          </View>
          <Button
            variant="outline"
            size="sm"
            disabled={level >= 5}
            accessibilityLabel="해시태그 추출 강도 높이기"
            onPress={() => stepLevel(1)}
          >
            <Text>+</Text>
          </Button>
        </View>

        <View className="flex-row gap-1">
          {LEVELS.map((step) => {
            const active = step === level;
            const filled = step <= level;
            const stepCfg = TAG_LEVEL_CONFIG[step];
            return (
              <Pressable
                key={step}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${step}단계 ${stepCfg.label} 최대 ${stepCfg.maxTags}개`}
                onPress={() => void setLevel(step)}
                className={
                  active
                    ? 'flex-1 items-center rounded-lg border border-primary bg-primary py-1.5'
                    : filled
                      ? 'flex-1 items-center rounded-lg border border-primary/35 bg-primary-soft/60 py-1.5'
                      : 'flex-1 items-center rounded-lg border border-border bg-background py-1.5'
                }
              >
                <Text
                  className={
                    active
                      ? 'text-[11px] font-bold text-primary-foreground'
                      : filled
                        ? 'text-[11px] font-semibold text-primary-soft-foreground'
                        : 'text-[11px] font-medium text-muted-foreground'
                  }
                >
                  {stepCfg.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-0.5">
        <Text className="text-xs text-muted-foreground">{cfg.summary}</Text>
        {!compact ? (
          <Text className="text-[11px] text-muted-foreground">
            직접 추가하거나 수정한 태그는 강도 변경과 무관하게 그대로 유지돼요.
          </Text>
        ) : null}
      </View>

      {showPreview ? (
        <View className="gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <Text className="text-xs font-semibold text-foreground">실시간 추출 미리보기</Text>
          <TextInput
            value={sampleText}
            onChangeText={setSampleText}
            placeholder="예시 제목을 입력해 추출 결과를 확인하세요"
            className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
          />
          <View className="flex-row flex-wrap gap-1.5">
            {previewTags.length > 0 ? (
              previewTags.map((tag) => (
                <View
                  key={tag}
                  className="rounded-full border border-primary/25 bg-primary-soft px-2.5 py-1"
                >
                  <Text className="text-[11px] font-semibold text-primary-soft-foreground">
                    {tag}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-xs text-muted-foreground">
                제목을 입력하면 추출될 태그가 여기에 표시돼요.
              </Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
