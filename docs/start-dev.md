# 개발 시작하기 (M1)

M1은 **예시 JSON으로 각자 화면 만들기**예요. Supabase·Docker·키가 없어도 돼요. 아래 순서면 처음 받은 날 바로 내 화면을 고치기 시작할 수 있어요.

## 1. 설치 (처음 한 번, 10분)

| 필요한 것   | 확인                       | 없으면                                                           |
| ----------- | -------------------------- | ---------------------------------------------------------------- |
| Node 22.13+ | `node -v`                  | [nodejs.org](https://nodejs.org) LTS 설치, 또는 `nvm install 22` |
| pnpm 10     | `pnpm -v`                  | `corepack enable` (Node에 들어 있어요)                           |
| Git, GitHub | `git -v`, `gh auth status` | `gh auth login`                                                  |
| 폰 앱       | App Store / Play Store     | **Expo Go** 설치                                                 |

```bash
git clone https://github.com/Customizable-calendar/Plan.git
cd Plan
pnpm install
```

## 2. 앱 띄우기

```bash
pnpm dev
```

터미널에 QR이 나오면 하나를 골라요.

| 어디서 보나            | 방법                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| 내 폰 (가장 쉬움)      | 컴퓨터와 같은 와이파이에서 iPhone은 카메라로, Android는 Expo Go 안에서 QR 스캔 |
| iOS 시뮬레이터 (Mac)   | Xcode 설치 후 터미널에서 `i`                                                   |
| Android 에뮬레이터     | Android Studio → Device Manager에서 기기를 켠 뒤 터미널에서 `a`                |
| 브라우저 (모양만 확인) | 터미널에서 `w`. 기기 보안 저장소(AI 키)는 웹에서 동작하지 않아요               |

회사·학교 와이파이처럼 폰이 컴퓨터를 못 찾으면 `pnpm --filter mobile start --tunnel`로 띄워요.

## 3. 내 화면 찾기

앱 **오늘** 탭 왼쪽 위 **「개발」** 버튼 → 개발 메뉴. 등록된 기능의 탭·오늘 섹션·화면이 담당별로 나오고, 탭에서 바로 갈 수 없는 화면(세션·편집기·AI 초안·수행 확인)도 여기서 열려요.

| 담당 | 화면                         | 고칠 폴더 (`apps/mobile/`)                               | 예시 데이터                              |
| ---- | ---------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| A    | 오늘 · 막 쓰기, 세션, 편집기 | `features/notes`, `features/sessions`, `features/editor` | `fixtures.notes`, `templates`            |
| B    | 카드, AI 초안                | `features/cards`, `features/ai-draft`                    | `fixtures.cards`                         |
| C    | 캘린더, 오늘 한 일 확인      | `features/calendar`, `features/execution`                | `fixtures.events`, `fixtures.executions` |
| D    | 설정, 탭·라우트, 공통 UI     | `features/settings`, `app/`, `packages/ui`               | -                                        |

각 폴더의 `README.md`에 담당·범위·**M1 할 일**이 있어요. 거기 체크박스가 첫 작업이에요.

## 4. 첫 수정 해 보기

지금 화면은 모두 「준비 중」 자리 표시(`ComingSoon`)예요. 화면은 자기 기능의 `data.ts`로만 데이터를 가져와요(`apps/mobile/features/README.md`). 예를 들어 B는 두 파일을 이렇게 만들면 저장하자마자 폰 화면이 바뀌어요.

```ts
// features/cards/data.ts — 이 기능의 데이터는 여기서만 가져와요
import { type Card, fixtures } from '@noteapp/shared';
import { useEffect, useState } from 'react';

import { dataSource, fromFixture } from '@/lib/data-source';

export async function listCards(): Promise<Card[]> {
  if (dataSource === 'fixtures') return fromFixture(fixtures.cards);
  throw new Error('cards: Supabase 연결은 M2에서 만들어요.');
}

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  useEffect(() => {
    listCards().then(setCards);
  }, []);
  return cards;
}
```

```tsx
// features/cards/CardsScreen.tsx
import { screen } from '@noteapp/ui';
import { FlatList, Text } from 'react-native';

import { useCards } from './data';

export function CardsScreen() {
  const cards = useCards();
  return (
    <FlatList
      style={screen.container}
      contentContainerStyle={screen.content}
      data={cards}
      keyExtractor={(card) => card.id}
      renderItem={({ item }) => (
        <Text>
          [{item.type}] {item.title}
        </Text>
      )}
    />
  );
}
```

- 데이터 모양(타입)은 `packages/shared/src/types/`, 예시 값은 `packages/shared/src/fixtures/`에 있어요.
- 예시 데이터가 모자라면 JSON에 추가해요. 타입을 바꿔야 하면 `contract` PR로 따로 올려요(`docs/conventions.md`).
- 다른 기능의 화면이나 데이터가 필요하면 그 기능의 `index.ts`에서 내보낸 것만 가져와요. ESLint가 막아 줘요.
- 새 기능·탭·화면이 필요하면 `node scripts/new-feature.mjs <id> --owner <A~D> ...`로 만들어요. 공용 레이아웃(`app/_layout.tsx`, `app/(tabs)/`)은 고치지 않아요. 만든 화면은 개발 메뉴에 자동으로 나와요.

## 5. 올리기

```bash
git switch -c feat/cards/list          # feat/<기능>/<설명>
# … 고치기 …
pnpm lint && pnpm typecheck && pnpm test
git add -A && git commit -m "feat(cards): 예시 데이터로 카드 목록"
git push -u origin HEAD
gh pr create                           # PR 양식이 열려요
```

규칙 전체는 [conventions.md](conventions.md), AI 도구에 맡길 때는 [AGENTS.md](../AGENTS.md)를 먼저 읽게 해요.

## 막힐 때

| 증상                                          | 해결                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 새 화면(라우트)을 만들었더니 `href` 타입 오류 | `pnpm dev`를 켜 둔 상태면 라우트 타입이 자동으로 다시 만들어져요. 꺼져 있었다면 한 번 켜요 |
| 폰에서 "Something went wrong" / 연결 안 됨    | 같은 와이파이인지 확인, 안 되면 `--tunnel`                                                 |
| 고쳤는데 화면이 안 바뀜                       | 터미널에서 `r` (다시 불러오기), 그래도 안 되면 `pnpm --filter mobile start --clear`        |
| Expo Go가 "SDK 버전이 맞지 않음"              | 스토어에서 Expo Go를 최신으로 업데이트                                                     |
| `pnpm` 명령이 없음                            | `corepack enable` 후 터미널 다시 열기                                                      |

## M2부터 (Supabase 연결)

로그인·DB가 필요해지는 M2부터는 로컬 Supabase(Docker)나 stage 프로젝트에 붙어요. 순서는 `apps/mobile/README.md` "로컬에서 띄우기"(#9 PR)와 #4·#8 이슈에 있어요.
