import { StyleSheet } from 'react-native';

import { colors, space } from './theme';

/** 스크롤 화면의 기본 바탕과 여백 */
export const screen = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, gap: space.md },
});
