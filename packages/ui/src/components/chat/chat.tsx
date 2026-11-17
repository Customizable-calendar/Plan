import { ExtractedCard, TypeChip } from '../app/cards';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
import {
  BUBBLE_RADIUS,
  DEFAULT_STATE,
  type AiDesign,
  type CardType,
} from '../../lib/design/tokens';
import { cn } from '../../lib/utils';
import {
  AlertCircleIcon,
  ArrowUpIcon,
  CheckIcon,
  FileTextIcon,
  MicIcon,
  PaperclipIcon,
  SparklesIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** 실제 앱에서는 lib/theme.ts 의 CHAT_DESIGN 을 넣는다 */
export const ChatDesignContext = React.createContext<AiDesign>(DEFAULT_STATE.ai);
const useChat = () => React.useContext(ChatDesignContext);

function bubbleCorners(who: 'user' | 'ai', shape: AiDesign['shape']) {
  const r = BUBBLE_RADIUS[shape];
  const tail = shape === 'tail' ? 4 : r;
  return who === 'user'
    ? { borderRadius: r, borderBottomRightRadius: tail }
    : { borderRadius: r, borderTopLeftRadius: tail };
}

export function AiAvatar({ size = 28 }: { size?: number }) {
  const { avatar } = useChat();
  if (avatar === 'none') return null;
  return (
    <View
      className="items-center justify-center rounded-full bg-ai-soft"
      style={{ width: size, height: size }}
    >
      {avatar === 'sparkle' ? (
        <Icon as={SparklesIcon} size={size * 0.5} className="text-ai" />
      ) : (
        <Text className="text-[11px] font-bold text-ai">AI</Text>
      )}
    </View>
  );
}

export function UserBubble({ children }: { children: React.ReactNode }) {
  const { shape } = useChat();
  return (
    <View
      className="max-w-[80%] self-end bg-bubble-user px-3.5 py-2.5"
      style={bubbleCorners('user', shape)}
    >
      <Text className="text-[15px] leading-6 text-bubble-user-foreground">{children}</Text>
    </View>
  );
}

/** AI 답변 한 덩어리: 아바타 + 말풍선(본문, 카드, 출처 등) */
export function AiMessage({ children }: { children: React.ReactNode }) {
  const { shape, aiBubble, avatar } = useChat();
  const plain = aiBubble === 'plain';
  return (
    <View className="flex-row items-start gap-2">
      <AiAvatar />
      <View
        className={cn(
          'gap-2.5',
          avatar === 'none' ? 'max-w-[92%]' : 'max-w-[86%] flex-1',
          !plain && 'bg-bubble-ai px-3.5 py-3',
          aiBubble === 'outline' && 'border border-bubble-ai-border',
        )}
        style={plain ? undefined : bubbleCorners('ai', shape)}
      >
        {children}
      </View>
    </View>
  );
}

export function AiText({ children }: { children: React.ReactNode }) {
  return <Text className="text-[15px] leading-6 text-bubble-ai-foreground">{children}</Text>;
}

/** 답변의 근거. 원문과 출처를 보여주는 원칙 */
export function Sources({ items }: { items: string[] }) {
  const { showSources } = useChat();
  if (!showSources) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {items.map((s) => (
        <View
          key={s}
          className="flex-row items-center gap-1 rounded-md border border-border bg-background px-2 py-1"
        >
          <Icon as={FileTextIcon} size={12} className="text-muted-foreground" />
          <Text className="text-[11px] text-muted-foreground">{s}</Text>
        </View>
      ))}
    </View>
  );
}

/** 채팅 안에서 AI 가 뽑은 카드 묶음 */
export function CardExtractBlock({
  cards,
}: {
  cards: { type: CardType; title: string; meta?: string }[];
}) {
  const { cardView } = useChat();
  if (cardView === 'compact') {
    return (
      <View className="overflow-hidden rounded-lg border border-border bg-card">
        {cards.map((c, i) => (
          <View
            key={c.title}
            className={cn(
              'flex-row items-center gap-2.5 px-3 py-2.5',
              i > 0 && 'border-t border-border',
            )}
          >
            <TypeChip type={c.type} />
            <Text className="flex-1 text-sm font-semibold text-card-foreground" numberOfLines={1}>
              {c.title}
            </Text>
            <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
              <Icon as={CheckIcon} size={14} className="text-primary-foreground" />
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View className="gap-2">
      {cards.map((c) => (
        <ExtractedCard
          key={c.title}
          type={c.type}
          title={c.title}
          meta={c.meta}
          source="대화"
          className="bg-card"
        />
      ))}
    </View>
  );
}

export function SuggestionChips({ items }: { items: string[] }) {
  const { suggestions, avatar } = useChat();
  const indent = avatar === 'none' ? 0 : 36;
  if (suggestions === 'list') {
    return (
      <View className="gap-1.5" style={{ marginLeft: indent }}>
        {items.map((it) => (
          <View
            key={it}
            className="flex-row items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
          >
            <Icon as={SparklesIcon} size={14} className="text-ai" />
            <Text className="flex-1 text-sm text-foreground">{it}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View className="flex-row flex-wrap gap-2" style={{ marginLeft: indent }}>
      {items.map((it) => (
        <View key={it} className="rounded-full border border-ai/40 bg-ai-soft px-3 py-1.5">
          <Text className="text-[13px] font-semibold text-ai">{it}</Text>
        </View>
      ))}
    </View>
  );
}

/** 생각 중 표시 */
export function Thinking({ label = '카드를 찾는 중' }: { label?: string }) {
  const { thinking } = useChat();
  return (
    <AiMessage>
      {thinking === 'dots' ? (
        <View className="h-6 flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-ai" />
          <View className="h-2 w-2 rounded-full bg-ai/60" />
          <View className="h-2 w-2 rounded-full bg-ai/30" />
        </View>
      ) : thinking === 'text' ? (
        <View className="flex-row items-center gap-2">
          <Icon as={SparklesIcon} size={14} className="text-ai" />
          <Text className="text-sm text-muted-foreground">{label}…</Text>
        </View>
      ) : (
        <View className="w-[200px] gap-2 py-1">
          <View className="h-3 w-full rounded-full bg-muted" />
          <View className="h-3 w-4/5 rounded-full bg-muted" />
          <View className="h-3 w-3/5 rounded-full bg-muted" />
        </View>
      )}
    </AiMessage>
  );
}

export function ErrorNotice({ message, action }: { message: string; action: string }) {
  return (
    <View className="flex-row items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3">
      <Icon as={AlertCircleIcon} size={18} className="text-destructive" />
      <View className="flex-1 gap-1">
        <Text className="text-sm text-foreground">{message}</Text>
        <Text className="text-sm font-bold text-destructive">{action}</Text>
      </View>
    </View>
  );
}

export function Composer({ placeholder = '메모하거나 물어보세요' }: { placeholder?: string }) {
  const { composer, showCost } = useChat();
  return (
    <View className="gap-1.5 border-t border-border bg-background px-3 pb-4 pt-2.5">
      <View
        className={cn(
          'flex-row items-center gap-2 border border-input bg-background px-2',
          composer === 'pill' ? 'h-12 rounded-full' : 'min-h-[76px] items-end rounded-xl py-2',
        )}
      >
        <View className="h-8 w-8 items-center justify-center">
          <Icon as={PaperclipIcon} size={18} className="text-muted-foreground" />
        </View>
        <Text
          className={cn(
            'flex-1 text-[15px] text-muted-foreground',
            composer === 'box' && 'self-start pt-1',
          )}
        >
          {placeholder}
        </Text>
        <View className="h-8 w-8 items-center justify-center">
          <Icon as={MicIcon} size={18} className="text-muted-foreground" />
        </View>
        <View className="h-8 w-8 items-center justify-center rounded-full bg-ai">
          <Icon as={ArrowUpIcon} size={18} className="text-ai-foreground" />
        </View>
      </View>
      {showCost ? (
        <Text className="text-center text-[11px] text-muted-foreground">
          예상 2,100 토큰 · Claude · 내 API 키 사용
        </Text>
      ) : null}
    </View>
  );
}

export function DateDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border" />
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
