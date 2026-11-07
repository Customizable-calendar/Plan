import { colors } from '@noteapp/ui';
import { Platform, StyleSheet } from 'react-native';

// 세션 화면에서 같이 쓰는 카드 모양이에요. 흰 바탕 + 둥근 모서리 + 옅은 그림자.
export const look = {
  radius: 16,
  primarySoft: `${colors.accent}14`, // 14 = 투명도 약 8% (16진수 알파)
};

export const cardStyle = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: look.radius,
    // 그림자: iOS·웹은 shadow*, 안드로이드는 elevation으로 그려요.
    ...Platform.select({
      android: { elevation: 2 },
      default: {
        shadowColor: '#1D2533',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
    }),
  },
});
