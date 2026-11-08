import type { CalendarEvent } from '@noteapp/shared';

import { eventLine, longDate } from './format';

// 본문에 `/`를 치면 뜨는 명령 목록이에요. 지금(M1)은 예시 데이터로만 동작해요.

export interface SlashItem {
  key: string;
  label: string;
  hint: string;
  /** 고르면 `/명령` 자리에 들어갈 글. null이면 아직 못 써요. */
  insert: string | null;
}

/** 커서 바로 앞의 `/검색어`. 없으면 null. start는 `/`의 위치예요. */
export function findSlashQuery(
  text: string,
  cursor: number,
): { start: number; query: string } | null {
  // 줄 처음이나 공백 뒤에 오는 `/글자들`만 명령으로 봐요. (URL의 / 는 무시)
  const match = /(^|\s)\/(\S*)$/.exec(text.slice(0, cursor));
  if (!match) return null;
  return { start: cursor - match[2].length - 1, query: match[2] };
}

/** 검색어에 맞는 명령. `/캘`이면 캘린더 일정이 하나씩 펼쳐져요. */
export function buildSlashItems(query: string, events: CalendarEvent[], now: Date): SlashItem[] {
  const hit = (...words: string[]) => query === '' || words.some((w) => w.startsWith(query));
  const items: SlashItem[] = [];

  if (hit('캘린더', '일정', 'calendar')) {
    for (const e of events) {
      items.push({
        key: `event-${e.id}`,
        label: eventLine(e),
        hint: '캘린더 일정',
        insert: eventLine(e),
      });
    }
  }
  if (hit('체크', '할일', 'todo')) {
    items.push({ key: 'check', label: '☐ 체크 항목', hint: '할 일 한 줄', insert: '- [ ] ' });
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
