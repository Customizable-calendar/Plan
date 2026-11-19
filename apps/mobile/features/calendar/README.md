# 캘린더

- **담당**: C
- **하는 일**: 구글 캘린더 일정을 보여주고, 할 일 카드에 충돌 없는 시간 후보 3개를 이유와 함께 제안해요. 사용자가 골라야 저장해요.
- **화면**: `캘린더` 탭의 `CalendarScreen`, 오늘 화면의 `TodayEventsSection`
- **데이터**: `calendar_` 테이블, 구글 연동은 `supabase/functions/`
- **다른 기능에 주는 것**: 오늘 일정, 시간이 잡힌 할 일
- **받는 것**: 확인된 할 일 카드(B)

## 규칙

- 이 폴더 밖에서는 `index.ts`로 내보낸 것만 써요. 내부 파일 구조는 담당자가 자유롭게 바꿔요.
- 다른 기능과 주고받는 타입은 `packages/shared`에 있어요. 바꿀 때는 `contract` 라벨 PR로 올려요.

## M1 할 일

- [x] 예시 JSON(`events.json`)으로 일·주 보기 화면 만들기
- [x] 할 일 하나에 시간 후보 3개를 보여주는 화면 만들기 (계산은 가짜로)

## 나중에

여러 구글 계정, 시간 예산 알림, 주간 회고

## M1 구현 안내 (2026-11-07)

- 확정: 담당 C의 일·주 보기, 예시 시간 후보 선택만 구현했어요.
- 데이터는 `data.ts`에서 shared fixtures를 복사해 읽어요. 시간 후보는 로컬 예시 계산이며 AI·Google·DB 호출은 없어요.
- 예시 일정과 할 일은 서울 시간 기준 2026-11-12~14에 표시해요. 주 보기는 날짜별 제목 목록, 일 보기는 시간표예요.
- 할 일 예시는 확인된 상태로 시작해요. 후보 선택 후 저장해야 실행 중 메모리에 반영돼요.
- 서울 시간으로 표시하고 UTC ISO 시각을 저장해요. 마감·종일 일정 등을 고려해 가능한 후보를 최대 3개 보여줘요.
- 디자인 기준: note-app-design-system의 `3d34e72` 커밋, `lib/theme.ts`와 `components/app/calendar.tsx`. 색상, 14px 모서리, 좌측 색 막대, 후보 점선, 단일 선택을 적용했어요.
- 공용 NativeWind·폰트·테마 도입은 D 담당 범위라 수정하지 않았어요. 동일 색 토큰을 이 폴더의 `tokens.ts`와 React Native StyleSheet로 적용하며 글꼴은 현재 앱의 기본 글꼴이에요.
- UI 진입점은 기존 탭과 오늘 섹션을 그대로 사용해요. 다른 기능은 `index.ts`의 공개 API만 사용해요.
- 미확인: 실제 Android/iOS 기기 실행. 웹에서 동작을 확인했어요.

## 최근 개선 사항 (내부 해시태그 · 자동 추출 · 직관적 시간 배정)

- **내부 해시태그 관리 (`tagStore.ts`, `HiddenTagDisclosure.tsx`)**: 일정·할 일 제목에서 `#태그`가 드러나지 않도록 분리해 내부적으로만 보관하고, 사용자가 `태그 N` 배지를 눌렀을 때만 태그 목록 확인, 추가/삭제, 자동 추출 복원 기능을 펼쳐 보여줘요. 수동 변경 이력은 기기 `AsyncStorage`(`calendar:hidden-tags:v1`)에 저장돼요.
- **자동 해시태그 추출 (`autoTags.ts`)**: 자연어 제목만 입력해도 한국어 어말 조사 분리(고유 명사 보호), 시간·수량 불용어 제거, 복합 키워드 결합, RAKE 공동 출현 점수, 사용자 카테고리 선호 태그(`@/lib/tag-categories`) 및 코퍼스 빈도 가중치를 조합해 내부 해시태그를 자동 추천·연결해요.
- **직관적 할 일 시간 배정 (`TimeCandidates.tsx`, `CalendarDaySheet.tsx`, `CalendarTimeline.tsx`, `CalendarScreen.tsx`)**:
  - `CalendarScreen` 상단 접힘형 `TaskQuickBar`에서 시간 미배정 할 일을 1탭으로 시간 배정 화면에 연결해요.
  - `CalendarTimeline`과 `EventListView`에서 배정된 할 일을 일정과 동일한 충돌 레인으로 함께 표시하고 눌러서 바로 시간을 바꿀 수 있어요.
  - `TimeCandidates`와 `CalendarDaySheet`에서 `08시 ~ 21시` 빈 시간 시각화, 다중 날짜 추천(`오늘`/`내일`/`이번 주 추천`), 소요 시간(`30분`/`1시간`/`2시간`), 직접 시간 선택과 배정 시간 비우기를 지원해요.
- **디자인 시스템**: 모든 컴포넌트는 공용 `@noteapp/ui`와 NativeWind 시맨틱 토큰(`className`)만을 사용해요.

### 검증

저장소 루트에서 `pnpm lint`, `pnpm typecheck`, `pnpm test`를 실행해요.
날짜 경계·일정 충돌·해시태그 자동 추출·시간대 추천 테스트는 `node --test apps/mobile/features/calendar/model.test.mjs`로 실행해요.

### 이 컴퓨터에서 발생한 설치 문제

🔴 이렇게 하면 깨짐 (2026-11-07): Codex 내장 pnpm 11로 이 저장소를 설치하면 pnpm 10 설정과 충돌했어요. 저장소가 지정한 pnpm 10.34.9를 사용해요.
캐시에서 복사된 일부 node_modules 파일의 Windows ReparsePoint 때문에 Expo가 실제 파일을 링크로 오인했어요. 해당 의존성 파일을 내용 변경 없이 일반 파일로 복사해 해결했어요. 앱 공용 설정 변경은 없어요.
