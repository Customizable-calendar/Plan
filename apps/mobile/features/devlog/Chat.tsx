import { colors, fontSize, space } from '@noteapp/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { look } from './look';

// 디자인 시스템 "5. AI 채팅" 기본안: 꼬리 말풍선, 아바타, 점 세 개 생각 중, 칩 제안, 알약 입력창, 출처·비용 표시.
// 다른 기능도 쓰게 되면 @noteapp/ui(D)로 옮겨요.

export function AiAvatar() {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>AI</Text>
    </View>
  );
}

export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <View style={[styles.userBubble]}>
      <Text style={styles.userText}>{children}</Text>
    </View>
  );
}

export function AiMessage({ children }: { children: ReactNode }) {
  return (
    <View style={styles.aiRow}>
      <AiAvatar />
      <View style={styles.aiBubble}>{children}</View>
    </View>
  );
}

export function AiText({ children }: { children: ReactNode }) {
  return <Text style={styles.aiText}>{children}</Text>;
}

/** 답의 근거: 원문과 출처를 보여줘요. */
export function Sources({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      {items.map((s) => (
        <View key={s} style={styles.source}>
          <Text style={styles.sourceText}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <AiMessage>
      <View style={styles.dots} accessibilityLabel={label} accessibilityLiveRegion="polite">
        <View style={[styles.dot, { opacity: 1 }]} />
        <View style={[styles.dot, { opacity: 0.6 }]} />
        <View style={[styles.dot, { opacity: 0.3 }]} />
        <Text style={styles.thinkingText}>{label}</Text>
      </View>
    </AiMessage>
  );
}

export function ErrorNotice({ message, action }: { message: string; action?: string }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorIcon}>!</Text>
      <View style={styles.flex}>
        <Text style={styles.errorText}>{message}</Text>
        {action && <Text style={styles.errorAction}>{action}</Text>}
      </View>
    </View>
  );
}

export function SuggestionChips({
  items,
  onPick,
  disabled,
}: {
  items: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.wrap, styles.indent]}>
      {items.map((it) => (
        <Pressable
          key={it}
          onPress={() => onPick(it)}
          disabled={disabled}
          accessibilityRole="button"
          style={[styles.suggestion, disabled && styles.disabled]}
        >
          <Text style={styles.suggestionText}>{it}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const off = disabled || !value.trim();
  return (
    <View style={styles.composerWrap}>
      <View style={styles.composer}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline
          accessibilityLabel={placeholder}
          style={styles.composerInput}
        />
        <Pressable
          onPress={onSend}
          disabled={off}
          accessibilityRole="button"
          accessibilityLabel="보내기"
          style={[styles.send, off && styles.disabled]}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
      <Text style={styles.cost}>Claude · 내 API 키 사용</Text>
    </View>
  );
}

const AVATAR = 28;

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  indent: { marginLeft: AVATAR + space.sm },
  disabled: { opacity: 0.4 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: look.aiSoft,
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: look.ai },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: look.bubble,
    borderBottomRightRadius: 4,
    backgroundColor: look.bubbleUser,
  },
  userText: { fontSize: 15, lineHeight: 24, color: colors.surface },
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  aiBubble: {
    flex: 1,
    maxWidth: '86%',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: look.bubble,
    borderTopLeftRadius: 4,
    backgroundColor: look.bubbleAi,
  },
  aiText: { fontSize: 15, lineHeight: 24, color: colors.ink },
  source: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: look.radius - 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  sourceText: { fontSize: 11, color: colors.muted },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: look.ai },
  thinkingText: { marginLeft: space.xs, fontSize: fontSize.caption, color: colors.muted },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: look.radius,
    borderWidth: 1,
    borderColor: `${look.destructive}4D`,
    backgroundColor: `${look.destructive}1A`,
  },
  errorIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 12,
    fontWeight: '800',
    color: colors.surface,
    backgroundColor: look.destructive,
    overflow: 'hidden',
  },
  errorText: { fontSize: 14, color: colors.ink },
  errorAction: { fontSize: 14, fontWeight: '700', color: look.destructive },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${look.ai}66`,
    backgroundColor: look.aiSoft,
  },
  suggestionText: { fontSize: fontSize.caption, fontWeight: '600', color: look.ai },
  composerWrap: { gap: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: space.xs,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: look.input,
    backgroundColor: colors.surface,
  },
  composerInput: { flex: 1, maxHeight: 120, fontSize: 15, color: colors.ink, paddingVertical: 6 },
  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: look.ai,
  },
  sendText: { fontSize: 18, fontWeight: '700', color: colors.surface, lineHeight: 20 },
  cost: { textAlign: 'center', fontSize: 11, color: colors.muted },
});
