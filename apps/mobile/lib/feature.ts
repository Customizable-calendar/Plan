import type { SymbolViewProps } from 'expo-symbols';
import type { ComponentType } from 'react';

// 기능이 앱에 붙는 방법을 한곳에 적는 설명서예요. (담당: D)
// 각 기능의 index.ts가 `feature`를 내보내고, features/registry.ts에 한 줄 추가하면
// 하단 탭, 홈 위젯, 왼쪽 메뉴(LNB), 스택 화면에 자동으로 붙어요. 공용 레이아웃 파일은 고치지 않아요.
// 배치 기준은 디자인 시스템(NAV_DESIGN lnb4)이에요. 하단 탭은 홈, 카드, 피드, 검색 네 개예요.

export type Owner = 'A' | 'B' | 'C' | 'D';

export interface FeatureTab {
  title: string;
  icon: SymbolViewProps['name'];
  /** 작을수록 왼쪽. '홈' 탭은 0이에요. */
  order: number;
}

/** 홈 화면의 정해진 자리. 위에서부터 banner, schedule, recent 순서예요. 한 자리에 한 기능만 와요. */
export type HomeSlot = 'banner' | 'schedule' | 'recent';

export interface FeatureHomeWidget {
  slot: HomeSlot;
  Component: ComponentType;
}

/** 왼쪽 메뉴 섹션. quick: 빠른 실행, sessions: 세션, cards: 카드, more: 기타 */
export type LnbSection = 'quick' | 'sessions' | 'cards' | 'more';

export interface FeatureLnbItem {
  section: LnbSection;
  /** 섹션 안에서 작을수록 위 */
  order: number;
  label: string;
  icon: SymbolViewProps['name'];
  /** 누르면 갈 앱 안 주소 */
  href: string;
  /** 개수 배지가 필요하면 숫자를 돌려주는 훅을 넘겨요. 예: 확인 대기 카드 수 */
  useCount?: () => number | undefined;
  /** 개수를 눈에 띄게(색 배지) 보여줄지 */
  emphasis?: boolean;
}

/** 세션 목록처럼 줄 하나로 안 되는 섹션 내용은 컴포넌트로 넘겨요. `onNavigate`를 부르면 메뉴가 닫혀요. */
export interface FeatureLnbBlock {
  section: LnbSection;
  order: number;
  Component: ComponentType<{ onNavigate: (href: string) => void }>;
}

/** @deprecated 홈 위젯(`homeWidget`)으로 옮기는 중이에요. 옮기기 전 섹션은 홈 맨 아래에 그대로 나와요. */
export interface FeatureSection {
  Component: ComponentType;
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
  homeWidget?: FeatureHomeWidget;
  lnb?: (FeatureLnbItem | FeatureLnbBlock)[];
  /** @deprecated homeWidget을 써요 */
  todaySection?: FeatureSection;
  screens?: FeatureScreen[];
}

export function defineFeature(feature: Feature): Feature {
  return feature;
}
