# features

기능 하나 = 폴더 하나예요. 기능은 `index.ts`의 `feature`로 **어디에 붙는지만 선언**하고, 탭·오늘 화면·스택 레이아웃은 `registry.ts`를 읽어서 알아서 그려요. 그래서 기능을 추가하거나 고칠 때 공용 레이아웃 파일(`app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`)은 고치지 않아요.

## 새 기능 만들기

```bash
node scripts/new-feature.mjs <id> --owner <A|B|C|D> [--tab <제목>] [--section] [--screen <제목>] [--modal]

# 예: C의 검색 탭 + 오늘 화면 섹션
node scripts/new-feature.mjs search --owner C --tab 검색 --section
```

만들어지는 것: `features/<id>/`(`index.ts`, 화면, `data.ts`, `README.md`), 라우트 파일, `registry.ts` 등록 한 줄.

## 기능이 붙는 자리 (`lib/feature.ts`)

| `feature`의 키 | 붙는 곳                         | 필요한 라우트 파일    |
| -------------- | ------------------------------- | --------------------- |
| `tab`          | 하단 탭 (`order` 작을수록 왼쪽) | `app/(tabs)/<id>.tsx` |
| `todaySection` | 오늘 화면 (`order` 작을수록 위) | 없음                  |
| `screens`      | 스택 화면·모달 (제목, `modal`)  | `app/<route>.tsx`     |

```ts
export const feature = defineFeature({
  id: 'cards', // 폴더 이름과 같아요
  owner: 'B',
  tab: {
    title: '카드',
    icon: { ios: 'rectangle.stack', android: 'style', web: 'style' },
    order: 20,
  },
  todaySection: { Component: TodayCardsSection, order: 30 },
});
```

## 데이터 (`data.ts`)

- 화면은 자기 기능의 `data.ts` 함수·훅만 불러요. 예시 JSON이나 Supabase를 화면에서 직접 부르지 않아요.
- `EXPO_PUBLIC_DATA_SOURCE=fixtures`(기본)면 `packages/shared` 예시 데이터를, `supabase`면 `getSupabase()` + mapper를 써요 (`lib/data-source.ts`).
- M2에서 Supabase로 바꿀 때 `data.ts`만 고치고 화면은 그대로 둬요.

## 검사

`pnpm test`(CI 포함)가 `scripts/check-features.mjs`로 확인해요.

- 폴더마다 `feature`가 있고 `id`가 폴더 이름과 같은지
- `registry.ts`에 등록됐는지
- `tab`·`screens`에 맞는 라우트 파일이 있는지, 라우트가 겹치지 않는지
