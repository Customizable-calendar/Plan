import type { SymbolViewProps } from 'expo-symbols';
import type { ComponentType } from 'react';

// 기능이 앱에 붙는 방법을 한곳에 적는 설명서예요. (담당: D)
// 각 기능의 index.ts가 `feature`를 내보내고, features/registry.ts에 한 줄 추가하면
// 하단 탭·오늘 화면 섹션·스택 화면에 자동으로 붙어요. 공용 레이아웃 파일은 고치지 않아요.

export type Owner = 'A' | 'B' | 'C' | 'D';

export interface FeatureTab {
  title: string;
  icon: SymbolViewProps['name'];
  /** 작을수록 왼쪽. '오늘' 탭은 0이에요. */
  order: number;
}

export interface FeatureSection {
  Component: ComponentType;
  /** 오늘 화면에서 작을수록 위 */
  order: number;
}

export interface FeatureScreen {
  /** app/ 아래 라우트 이름. 예: 'draft' → app/draft.tsx, 'editor/[id]' → app/editor/[id].tsx */
  route: string;
  title: string;
  modal?: boolean;
}

export interface Feature {
  /** 기능 폴더 이름과 같아요. 탭이 있으면 app/(tabs)/<id>.tsx 라우트 이름도 같아요. */
  id: string;
  owner: Owner;
  tab?: FeatureTab;
  todaySection?: FeatureSection;
  screens?: FeatureScreen[];
}

export function defineFeature(feature: Feature): Feature {
  return feature;
}
