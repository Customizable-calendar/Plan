// 서식 막대가 쓰는 마크다운 줄 머리 넣기. 화면 없이 쓸 수 있는 순수 함수예요.

export type LineFormat = 'h1' | 'h2' | 'check' | 'bullet' | 'quote';

export const LINE_PREFIX: Record<LineFormat, string> = {
  h1: '# ',
  h2: '## ',
  check: '- [ ] ',
  bullet: '- ',
  quote: '> ',
};

// 줄 맨 앞에 이미 붙어 있는 서식 머리(긴 것부터 확인해요: '- [ ] '가 '- '보다 먼저)
const ANY_PREFIX = /^(#{1,2} |- \[[ x]\] |- |> )/;

/**
 * 커서가 있는 줄 맨 앞에 서식 머리를 붙여요.
 * 같은 서식이 이미 있으면 떼고(끄기), 다른 서식이 있으면 바꿔요.
 */
export function applyLineFormat(
  body: string,
  cursor: number,
  format: LineFormat,
): { body: string; cursor: number } {
  const lineStart = body.lastIndexOf('\n', cursor - 1) + 1;
  const lineEnd = body.indexOf('\n', lineStart);
  const line = body.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

  const current = ANY_PREFIX.exec(line)?.[0] ?? '';
  const wanted = LINE_PREFIX[format];
  const next = current === wanted ? '' : wanted;

  const newBody = body.slice(0, lineStart) + next + body.slice(lineStart + current.length);
  // 커서는 머리 길이가 바뀐 만큼 옮겨요. 머리 안쪽에 있었으면 머리 끝으로.
  const newCursor = Math.max(lineStart + next.length, cursor + next.length - current.length);
  return { body: newBody, cursor: newCursor };
}
