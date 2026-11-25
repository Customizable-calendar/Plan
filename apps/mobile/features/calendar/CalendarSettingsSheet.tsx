import { BottomSheet, Button, Scrim, Text } from '@noteapp/ui';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { EmbeddingModelCard } from './EmbeddingModelCard';
import { HashtagLevelBar } from './HashtagLevelBar';

/** 캘린더 내부에서 해시태그 자동 추출 강도와 맞춤 시간 추천 연동을 설정하는 바텀 시트예요. */
export function CalendarSettingsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="해시태그 추출 설정 닫기"
          onPress={onClose}
          className="absolute inset-0"
        >
          <Scrim />
        </Pressable>
        <BottomSheet title="해시태그 추출 설정" className="max-h-[85%]">
          <ScrollView contentContainerClassName="gap-4 pb-2">
            <HashtagLevelBar showPreview />

            <EmbeddingModelCard />

            <View className="gap-1.5 rounded-xl border border-border bg-muted/40 p-3.5">
              <Text className="text-xs font-bold text-foreground">
                시간 추천 알고리즘에도 함께 쓰여요
              </Text>
              <Text className="text-xs leading-5 text-muted-foreground">
                추출된 해시태그가 기존 일정의 해시태그와 얼마나 겹치는지 비교해 비슷한 활동 시간대,
                제목의 시간 단서, 일정 앞뒤 여유 간격을 함께 고려한 시간 후보를 우선 추천해요.
              </Text>
            </View>

            <Button variant="ghost" onPress={onClose}>
              <Text>닫기</Text>
            </Button>
          </ScrollView>
        </BottomSheet>
      </View>
    </Modal>
  );
}
