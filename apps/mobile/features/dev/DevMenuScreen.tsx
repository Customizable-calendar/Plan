import { colors, fontSize, screen, space } from '@noteapp/ui';
import { type Href, Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Feature } from '@/lib/feature';

import { devEntries } from './entries';

// 개발할 때만 보이는 메뉴예요. 탭에서 바로 갈 수 없는 화면(세션·편집기·초안·수행 확인)도 여기서 열어요.
// 기능 목록은 라우트(app/dev.tsx)가 registry에서 넘겨줘요. 여기서 registry를 부르면 서로 불러오는 고리가 생겨요.
export function DevMenuScreen({ features }: { features: Feature[] }) {
  const entries = devEntries(features);
  return (
    <ScrollView style={screen.container} contentContainerStyle={screen.content}>
      <Text style={styles.hint}>
        내 담당 화면을 눌러 열고, 오른쪽 폴더의 파일을 고치면 저장할 때마다 바로 바뀌어요.
      </Text>
      {entries.map((item) => (
        <Link key={item.key} href={item.href as Href} asChild>
          <Pressable style={styles.row} accessibilityRole="link">
            <View style={styles.owner}>
              <Text style={styles.ownerText}>{item.owner}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.folder}</Text>
            </View>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: fontSize.caption, lineHeight: 20, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    padding: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  owner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  ownerText: { fontSize: fontSize.body, fontWeight: '700', color: colors.accent },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.body, fontWeight: '600', color: colors.ink },
  meta: { fontSize: fontSize.caption, color: colors.muted },
});
