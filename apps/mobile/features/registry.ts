// 앱에 붙는 기능 목록이에요. 새 기능은 import 한 줄과 배열 한 줄만 추가해요.
// scripts/new-feature.mjs가 자동으로 추가해요. (담당: D)
import type { Feature, HomeSlot, LnbSection } from '@/lib/feature';

import { feature as notes } from './notes';
import { feature as sessions } from './sessions';
import { feature as editor } from './editor';
import { feature as cards } from './cards';
import { feature as aidraft } from './ai-draft';
import { feature as calendar } from './calendar';
import { feature as execution } from './execution';
import { feature as feed } from './feed';
import { feature as settings } from './settings';
import { feature as devlog } from './devlog';
import { feature as devquiz } from './devquiz';
import { feature as dev } from './dev';
import { feature as search } from './search';
import { feature as stt } from './stt';
// new-feature:import

export const features: Feature[] = [
  notes,
  sessions,
  editor,
  cards,
  aidraft,
  calendar,
  execution,
  feed,
  settings,
  devlog,
  devquiz,
  dev,
  search,
  stt,
  // new-feature:entry
];

// 하단 탭은 홈, 카드, 피드, 검색 네 개까지만 받아요(디자인 시스템 lnb4).
export const tabFeatures = features
  .filter((f): f is Feature & { tab: NonNullable<Feature['tab']> } => !!f.tab)
  .sort((a, b) => a.tab.order - b.tab.order);

// 홈 위젯은 자리(slot)로 찾아요. 같은 자리에 두 기능이 오면 pnpm test(scripts/check-features.mjs)가 실패해요.
export function homeWidget(slot: HomeSlot) {
  return features.find((f) => f.homeWidget?.slot === slot)?.homeWidget?.Component;
}

// 왼쪽 메뉴 한 섹션에 들어갈 줄과 블록을 순서대로 모아요.
export function lnbEntries(section: LnbSection) {
  return features
    .flatMap((f) => (f.lnb ?? []).map((entry) => ({ id: f.id, entry })))
    .filter(({ entry }) => entry.section === section)
    .sort((a, b) => a.entry.order - b.entry.order);
}

/** @deprecated 홈 위젯으로 옮기기 전 섹션이에요. 홈 맨 아래에 나와요. */
export const todaySections = features
  .flatMap((f) => (f.todaySection ? [{ id: f.id, ...f.todaySection }] : []))
  .sort((a, b) => a.order - b.order);

export const stackScreens = features.flatMap((f) => f.screens ?? []);
