import { Button, Icon, Progress, Text } from '@noteapp/ui';
import { SparklesIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useLocalEmbeddingModel } from './embeddingEngine';
import { EMBEDDING_MODEL } from './embeddingSpec';

/**
 * MIT 라이선스 다국어 정적 임베딩 모델을 필요 시 내려받아 관리하는 카드예요.
 * 모델이 없어도 기본 유의어 유사도로 동작하고, 내려받으면 기기 안에서 벡터 유사도를 계산해요.
 */
export function EmbeddingModelCard({ compact = false }: { compact?: boolean }) {
  const { downloaded, progress, partial, error, download, stop, remove } = useLocalEmbeddingModel();

  if (compact) {
    const compactLabel =
      progress !== undefined
        ? `로컬 의미 모델 받는 중 ${Math.round(progress * 100)}%`
        : downloaded
          ? '로컬 의미 모델 적용 중'
          : partial !== null
            ? `로컬 의미 모델 (MIT, ${Math.round(partial * 100)}%)`
            : '로컬 의미 모델 (MIT, 142MB)';

    return (
      <View className="gap-1.5 border-y border-border py-2">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-1.5">
            <Icon as={SparklesIcon} size={14} className="text-ai" />
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {compactLabel}
            </Text>
          </View>
          {progress !== undefined ? (
            <Button variant="ghost" size="sm" onPress={stop}>
              <Text>멈추기</Text>
            </Button>
          ) : downloaded ? (
            <Button variant="ghost" size="sm" onPress={() => void remove()}>
              <Text>지우기</Text>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onPress={() => void download()}>
              <Text>{partial !== null ? '이어 받기' : '받기'}</Text>
            </Button>
          )}
        </View>
        {progress !== undefined ? (
          <Progress value={Math.round(progress * 100)} className="h-1" />
        ) : null}
        {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
      </View>
    );
  }

  const statusText =
    progress !== undefined
      ? `받는 중 ${Math.round(progress * 100)}%`
      : downloaded
        ? '기기 저장 완료, 로컬 벡터 임베딩으로 의미 유사도를 계산 중이에요'
        : partial !== null
          ? `${EMBEDDING_MODEL.note}, ${Math.round(partial * 100)}% 받다 멈춤`
          : `미설치 (기본 유의어 유사도 사용 중), ${EMBEDDING_MODEL.note}`;

  return (
    <View className="gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Icon as={SparklesIcon} size={14} className="text-ai" />
            <Text className="text-xs font-bold text-foreground">{EMBEDDING_MODEL.label}</Text>
            <View className="rounded-full bg-primary-soft px-2 py-0.5">
              <Text className="text-[10px] font-bold text-primary-soft-foreground">
                {EMBEDDING_MODEL.license}
              </Text>
            </View>
          </View>
          <Text className="text-xs leading-4 text-muted-foreground">{statusText}</Text>
        </View>

        {progress !== undefined ? (
          <Button variant="outline" size="sm" onPress={stop}>
            <Text>멈추기</Text>
          </Button>
        ) : downloaded ? (
          <Button variant="outline" size="sm" onPress={() => void remove()}>
            <Text>지우기</Text>
          </Button>
        ) : (
          <Button size="sm" onPress={() => void download()}>
            <Text>{partial !== null ? '이어 받기' : '받기'}</Text>
          </Button>
        )}
      </View>

      {progress !== undefined ? (
        <Progress value={Math.round(progress * 100)} className="h-1.5" />
      ) : null}

      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
