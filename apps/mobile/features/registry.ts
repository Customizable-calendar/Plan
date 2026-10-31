// 앱에 붙는 기능 목록이에요. 새 기능은 import 한 줄과 배열 한 줄만 추가해요.
// scripts/new-feature.mjs가 자동으로 추가해요. (담당: D)
import type { Feature } from '@/lib/feature';

import { feature as notes } from './notes';
import { feature as sessions } from './sessions';
import { feature as editor } from './editor';
import { feature as cards } from './cards';
import { feature as aidraft } from './ai-draft';
import { feature as calendar } from './calendar';
import { feature as execution } from './execution';
import { feature as feed } from './feed';
import { feature as settings } from './settings';
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
  // new-feature:entry
];

export const tabFeatures = features
  .filter((f): f is Feature & { tab: NonNullable<Feature['tab']> } => !!f.tab)
  .sort((a, b) => a.tab.order - b.tab.order);

export const todaySections = features
  .flatMap((f) => (f.todaySection ? [{ id: f.id, ...f.todaySection }] : []))
  .sort((a, b) => a.order - b.order);

export const stackScreens = features.flatMap((f) => f.screens ?? []);
