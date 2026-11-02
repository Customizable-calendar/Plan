import { colors, fontSize, space } from '@noteapp/ui';
import { StyleSheet, Text, View } from 'react-native';

// 일지 본문용 최소 마크다운: 목록(- 1.), `코드`, **굵게**. 제목은 섹션으로 따로 그려요.

function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') ? (
          <Text key={i} style={styles.code}>
            {p.slice(1, -1)}
          </Text>
        ) : p.startsWith('**') ? (
          <Text key={i} style={styles.bold}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <View style={styles.wrap}>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return null;
        const bullet = line.match(/^\s*(?:[-*]|(\d+)[.)])\s+(.*)$/);
        if (bullet)
          return (
            <View key={i} style={styles.row}>
              <Text style={styles.body}>{bullet[1] ? `${bullet[1]}.` : '•'}</Text>
              <Text style={[styles.body, styles.flex]}>
                <Inline text={bullet[2]} />
              </Text>
            </View>
          );
        return (
          <Text key={i} style={styles.body}>
            <Inline text={line} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  body: { fontSize: fontSize.body, lineHeight: 24, color: colors.ink },
  bold: { fontWeight: '700' },
  code: {
    fontSize: fontSize.caption,
    color: colors.accent,
    backgroundColor: colors.background,
  },
});
