import type { CalendarEvent } from '@noteapp/shared';

import { eventLine, longDate } from './format';

// 본문에 `//`(슬래시 두 번)를 치면 뜨는 명령 목록이에요. 일정이 맨 위에 나와요.
// `/` 하나는 글에서 자주 쓰여서(1/2, 그리고/또는) 두 번 칠 때만 열어요. 지금(M1)은 예시 일정으로만 동작해요.

export interface SlashItem {
  key: string;
  label: string;
  hint: string;
  /** 고르면 `/명령` 자리에 들어갈 글. null이면 아직 못 써요. */
  insert: string | null;
}

/** 커서 바로 앞의 `//검색어`. 없으면 null. start는 첫 `/`의 위치예요. */
export function findSlashQuery(
  text: string,
  cursor: number,
): { start: number; query: string } | null {
  // 줄 처음이나 공백 뒤에 오는 `//글자들`만 명령으로 봐요. (https://의 // 는 앞에 글자가 붙어 있어서 무시)
  const match = /(^|\s)\/\/([^\s/]*)$/.exec(text.slice(0, cursor));
  if (!match) return null;
  return { start: cursor - match[2].length - 2, query: match[2] };
}

/** 검색어에 맞는 명령. `//`만 치면 일정이 먼저 펼쳐지고, `//오늘`처럼 이어 치면 걸러져요. */
export function buildSlashItems(query: string, events: CalendarEvent[], now: Date): SlashItem[] {
  const hit = (...words: string[]) => query === '' || words.some((w) => w.startsWith(query));
  const items: SlashItem[] = [];

  if (hit('캘린더', '일정', 'calendar')) {
    for (const e of events) {
      items.push({
        key: `event-${e.id}`,
        label: eventLine(e),
        hint: '캘린더 일정',
        // 본문에는 '- 일정: ...' 줄로 넣어요. 미리보기에서 이름과 값 표로 보여요.
        insert: `- 일정: ${eventLine(e)}`,
      });
    }
  }
  if (hit('체크', '할일', 'todo')) {
    items.push({ key: 'check', label: '체크 항목', hint: '할 일 한 줄', insert: '- [ ] ' });
  }
  if (hit('오늘', '날짜', 'date')) {
    items.push({
      key: 'today',
      label: '오늘 날짜',
      hint: longDate(now.toISOString()),
      insert: longDate(now.toISOString()),
    });
  }
  if (hit('카드', 'card')) {
    items.push({ key: 'card', label: '카드 넣기', hint: '나중에 붙여요', insert: null });
  }
  return items;
}
