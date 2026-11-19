import type { AiRequest } from '@noteapp/ai-client';
import { templates } from '@noteapp/shared';
import {
  AiNotice,
  Button,
  cn,
  DaySectionTitle,
  Icon,
  palette,
  RailCard,
  ScrollChips,
  Text,
} from '@noteapp/ui';
import { CheckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { cardDetail, useCards } from '@/features/cards';

import { getProvider } from './data';
import { buildRequest } from './prompt';

type Result = { text: string; request: AiRequest };

// AI 초안 화면. 디자인 시스템 개편안(양식 칩, 상자 없는 카드 줄, 주 버튼 하나)을 따라요.
export function DraftScreen() {
  const { cards, loading } = useCards();
  const [templateId, setTemplateId] = useState(templates[0].id);
  // 확인한 카드는 기본으로 모두 보내요. 뺀 카드만 기억해요.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showRequest, setShowRequest] = useState(false);

  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const confirmed = cards.filter((c) => c.status === 'confirmed');
  const selected = confirmed.filter((c) => !excluded.has(c.id));

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const generate = async () => {
    const request = buildRequest(template, selected);
    setBusy(true);
    setError(null);
    try {
      const provider = await getProvider();
      setResult({ text: await provider.complete(request), request });
      setShowRequest(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const blocked = busy || selected.length === 0;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 pb-16 pt-4">
      <View className="gap-2">
        <View className="px-5">
          <DaySectionTitle label="양식" />
        </View>
        <ScrollChips
          items={templates.map((t) => ({ key: t.id, label: t.name }))}
          active={templateId}
          onChange={setTemplateId}
        />
        <Text className="px-5 text-xs text-muted-foreground">{template.description}</Text>
      </View>

      <View className="px-5">
        <DaySectionTitle label={`보낼 카드 ${selected.length}/${confirmed.length}`} />
        {loading ? <Text className="py-3 text-sm text-muted-foreground">불러오는 중</Text> : null}
        {!loading && confirmed.length === 0 ? (
          <Text className="py-3 text-sm text-muted-foreground">
            확인한 카드가 없어요. 카드 탭에서 먼저 확인해 주세요.
          </Text>
        ) : null}
        {confirmed.map((c, index) => {
          const on = !excluded.has(c.id);
          const detail = cardDetail(c);
          return (
            <View key={c.id}>
              {index > 0 ? <View className="h-px bg-border" /> : null}
              <Pressable
                onPress={() => toggle(c.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                className={cn(!on && 'opacity-50')}
              >
                <RailCard
                  type={c.type}
                  title={c.title}
                  meta={detail ?? undefined}
                  right={
                    <View
                      className={cn(
                        'h-6 w-6 items-center justify-center rounded-full border-2',
                        on ? 'border-primary bg-primary' : 'border-input bg-background',
                      )}
                    >
                      {on ? (
                        <Icon as={CheckIcon} size={13} className="text-primary-foreground" />
                      ) : null}
                    </View>
                  }
                />
              </Pressable>
            </View>
          );
        })}
      </View>

      <View className="gap-2 px-5">
        <Button size="lg" disabled={blocked} onPress={() => void generate()}>
          {busy ? (
            <ActivityIndicator color={palette.primaryForeground} />
          ) : (
            <Text>{result ? '다시 만들기' : '초안 만들기'}</Text>
          )}
        </Button>
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      </View>

      {result ? (
        <View className="gap-3 px-5">
          <DaySectionTitle label="초안 미리보기" />
          <View className="border-t border-border pt-3">
            <Markdown text={result.text} />
          </View>
          <AiNotice />
          <Pressable onPress={() => setShowRequest((v) => !v)} accessibilityRole="button">
            <Text className="text-xs font-semibold text-primary">
              {showRequest ? '보낸 내용 닫기' : '보낸 내용 보기'},{' '}
              {(result.request.system?.length ?? 0) + result.request.prompt.length}자
            </Text>
          </Pressable>
          {showRequest ? (
            <Text className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              {result.request.system}
              {'\n\n'}
              {result.request.prompt}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** 초안 미리보기용 최소 마크다운: ## 제목, - 목록, 나머지는 문단 */
function Markdown({ text }: { text: string }) {
  return (
    <View className="gap-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return (
            <Text key={i} className={cn('text-base font-bold text-foreground', i > 0 && 'mt-3')}>
              {line.slice(3)}
            </Text>
          );
        if (line.startsWith('- '))
          return (
            <View key={i} className="flex-row gap-2 pl-1">
              <View className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <Text className="flex-1 text-sm leading-6 text-foreground">{line.slice(2)}</Text>
            </View>
          );
        return line.trim() ? (
          <Text key={i} className="text-sm leading-6 text-foreground">
            {line}
          </Text>
        ) : null;
      })}
    </View>
  );
}
