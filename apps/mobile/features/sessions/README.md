# 세션·템플릿

- **담당**: A
- **하는 일**: 업무일지·블로그·회의록·연구논문·학습일지 같은 양식을 고르는 곳이에요. 양식은 코드가 아니라 `packages/shared/src/templates/*.json` 데이터예요.
- **화면**: `/sessions` 세션 목록 (`SessionsListScreen`)
- **데이터**: `docs_` 테이블 (만든 문서), 템플릿은 JSON 파일
- **다른 기능에 주는 것**: 선택한 템플릿 id를 AI 초안(B)과 편집기에 넘겨요.
- **받는 것**: `@noteapp/shared`의 `templates`

## 규칙

- 이 폴더 밖에서는 `index.ts`로 내보낸 것만 써요. 내부 파일 구조는 담당자가 자유롭게 바꿔요.
- 다른 기능과 주고받는 타입은 `packages/shared`에 있어요. 바꿀 때는 `contract` 라벨 PR로 올려요.

## M1 할 일

- [x] 템플릿 JSON을 읽어 세션 목록 화면 만들기 (내 세션은 `fixtures.sessions`)
- [x] 템플릿을 고르면 편집기로 이동하기 (`/editor/new?templateId=...`)
- [x] 세션 목록: 분류 칩, 검색, 문서 카드(아이콘, 태그, 수정일, 본문 미리보기), 새 세션 작성 버튼
- [x] 양식 고르기 시트(`TemplatePickerModal`)에서 고르면 편집기로 이동
- [x] 문서 카드 삭제 버튼과 확인창 (M1: 앱이 켜져 있는 동안만)

## 나중에

AI로 새 양식 만들기 (P1)
