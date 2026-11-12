import { ComingSoon } from '@noteapp/ui';
import { ScrollView } from 'react-native';

import { AccountSection } from './AccountSection';

export function SettingsScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-5">
      <AccountSection />
      <ComingSoon
        variant="section"
        title="설정"
        description="AI 키, 구글 캘린더 연결을 관리해요."
        owner="D"
      />
    </ScrollView>
  );
}
