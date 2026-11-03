# rules/

한국어 자연어 날짜·일정 파서예요. [event-parser](https://github.com/Customizable-calendar/event-parser)에서 옮겨 왔고, 이제 여기가 원본이에요.

- `parse.ts` `parseEvent(text, options)`: 한 줄 → 제목·시작·끝·참석자·장소·반복·알림 + 원문 위치(`spans`)
- `lexicon/ko.ts`: 단어 사전. 새 표현은 정규식보다 사전에 먼저 추가해요.
- `dates.ts`: 날짜 계산, `toRRule()`
- `scanner.ts`: 이미 인식한 글자를 다시 쓰지 않게 하는 스캐너

파서는 기기 시간(`getHours` 등)으로 계산해요. 메모 시간대 변환은 `../zone.ts`가 해요.
