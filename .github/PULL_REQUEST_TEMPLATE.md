## 무엇을 했나요

## 관련 이슈

Closes #

## 겹치는 PR

<!-- pnpm pr:check 결과. 같은 파일을 고치는 열린 PR 번호와 머지 순서. 없으면 "없음" -->

## 화면 (있으면 스크린샷)

## 확인 방법

## 체크

- [ ] `pnpm lint && pnpm typecheck && pnpm test` 통과
- [ ] `pnpm pr:check` 확인, `origin/stage` 최신 위로 rebase
- [ ] 기능 하나, 400줄 이하
- [ ] `packages/shared` 타입을 바꿨다면 예시 JSON도 고치고 `contract` 라벨
- [ ] 마이그레이션을 바꿨다면 `pnpm db:types`와 mapper도 같이 고침
- [ ] 키·토큰·`.env`를 커밋하지 않음
