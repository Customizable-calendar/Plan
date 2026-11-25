// 서식 막대가 쓰는 마크다운 줄 머리 넣기. 화면 없이 쓸 수 있는 순수 함수예요.

export type LineFormat = 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'check' | 'quote' | 'field';

/** 이름과 값 줄(`- 이름: 값`)을 새로 만들 때 넣는 이름. 사용자가 바로 고쳐 써요. */
export const FIELD_LABEL = '항목';

// 줄 맨 앞의 서식 머리를 알아보는 순서. 긴 것부터 봐요: '### '가 '# '보다, '- [ ] '가 '- '보다 먼저.
const PATTERNS: [LineFormat, RegExp][] = [
  ['h3', /^### /],
  ['h2', /^## /],
  ['h1', /^# /],
  ['check', /^- \[[ xX]\] /],
  // 이름은 20자까지, 콜론 뒤 띄어쓰기까지 있어야 해요. ("- 10:30 회의"는 해당 안 돼요)
  ['field', /^- [^:\n]{1,20}: /],
  ['bullet', /^- /],
  ['number', /^\d+\. /],
  ['quote', /^> /],
];

/** 줄에 붙은 서식과 그 머리 글자. 서식이 없으면 null */
export function lineFormatOf(line: string): { format: LineFormat; prefix: string } | null {
  for (const [format, pattern] of PATTERNS) {
    const match = pattern.exec(line);
    if (match) return { format, prefix: match[0] };
  }
  return null;
}

/**
 * 새로 붙일 서식 머리. 번호는 바로 윗줄 번호에 1을 더해요.
 * previousLine은 윗줄 글이에요 (없으면 빈 글).
 */
export function linePrefix(format: LineFormat, previousLine = ''): string {
  switch (format) {
    case 'h1':
      return '# ';
    case 'h2':
      return '## ';
    case 'h3':
      return '### ';
    case 'bullet':
      return '- ';
    case 'number': {
      const above = /^(\d+)\. /.exec(previousLine);
      return `${above ? Number(above[1]) + 1 : 1}. `;
    }
    case 'check':
      return '- [ ] ';
    case 'quote':
      return '> ';
    case 'field':
      return `- ${FIELD_LABEL}: `;
  }
}

/** 커서가 있는 줄의 시작과 끝 위치 */
function lineAt(body: string, cursor: number) {
  const start = body.lastIndexOf('\n', cursor - 1) + 1;
  const newline = body.indexOf('\n', start);
  const end = newline === -1 ? body.length : newline;
  return { start, end, text: body.slice(start, end) };
}

/** 커서가 있는 줄의 서식 (서식 막대에서 지금 서식을 표시할 때 써요) */
export function formatAtCursor(body: string, cursor: number): LineFormat | null {
  return lineFormatOf(lineAt(body, cursor).text)?.format ?? null;
}

/**
 * 커서가 있는 줄 맨 앞에 서식 머리를 붙여요.
 * 같은 서식이 이미 있으면 떼고(끄기), 다른 서식이 있으면 바꿔요.
 * 돌려주는 start~end는 새 커서(또는 고를 글자) 자리예요. 이름과 값 줄은 이름을 골라 둬서 바로 고쳐 쓰게 해요.
 */
export function applyLineFormat(
  body: string,
  cursor: number,
  format: LineFormat,
): { body: string; start: number; end: number } {
  const line = lineAt(body, cursor);
  const current = lineFormatOf(line.text);
  const removing = current?.format === format;
  const oldPrefix = current?.prefix ?? '';

  const above = line.start > 0 ? lineAt(body, line.start - 1).text : '';
  const next = removing ? '' : linePrefix(format, above);

  const newBody = body.slice(0, line.start) + next + body.slice(line.start + oldPrefix.length);

  if (format === 'field' && !removing) {
    const labelStart = line.start + 2;
    return { body: newBody, start: labelStart, end: labelStart + FIELD_LABEL.length };
  }
  // 커서는 머리 길이가 바뀐 만큼 옮겨요. 머리 안쪽에 있었으면 머리 끝으로.
  const at = Math.max(line.start + next.length, cursor + next.length - oldPrefix.length);
  return { body: newBody, start: at, end: at };
}
