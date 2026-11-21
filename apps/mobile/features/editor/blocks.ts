// 본문 마크다운을 미리보기용 블록으로 나누고, 블록에서 고친 글을 본문의 그 줄에 되돌려 써요.
// 화면 없이 쓸 수 있는 순수 함수예요.

/** 고칠 수 있는 글 한 줄. 본문에서는 `prefix + text`로 적혀 있어요. */
export interface LinePart {
  /** 본문의 몇 번째 줄인지 (0부터) */
  line: number;
  /** 줄 맨 앞의 마크다운 머리. 예: '## ', '- [ ] ', '- 제목: ' */
  prefix: string;
  text: string;
}

export type PreviewBlock =
  | (LinePart & { kind: 'heading'; level: 1 | 2 | 3 })
  /** `- 이름: 값` 줄이 이어진 묶음. 표처럼 이름과 값을 나란히 보여줘요. */
  | { kind: 'fields'; rows: (LinePart & { label: string })[] }
  | (LinePart & { kind: 'bullet' })
  | (LinePart & { kind: 'check'; checked: boolean })
  | (LinePart & { kind: 'number'; order: number })
  | (LinePart & { kind: 'quote' })
  | (LinePart & { kind: 'paragraph' })
  /** 붙인 파일 줄 `![이름](file:<files id>)`. 미리보기에서 파일 카드로 보여요. */
  | { kind: 'file'; line: number; name: string; fileId: string };

// 내용 없는 제목('## ')도 제목으로 봐요. 줄 끝 띄어쓰기는 지우고 보니까 '##'만 남아도 돼요. ('#태그'는 아니에요)
const HEADING = /^(#{1,3})(?: (.*))?$/;
const CHECK = /^(- \[([ xX])\] ?)(.*)$/;
// 이름은 20자까지. 콜론 뒤에 띄어쓰기가 있거나 줄이 끝나야 해요. ("- 10:30 회의"는 해당 안 돼요)
const FIELD = /^- ([^:]{1,20}):(?: (.*)|\s*)$/;
const BULLET = /^(- ?)(.*)$/;
const NUMBER = /^((\d+)\. ?)(.*)$/;
const QUOTE = /^(> ?)(.*)$/;
// 띄어쓰기 없이 서식 기호만 있는 줄('###', '-', '1.', '- [ ]', '>', '- 이름:')은 서식이 아니라 그냥 글로 봐요.
// 미리보기에서 빈 줄의 서식을 지우면 이렇게 기호만 남겨서, 한 글자씩 더 지울 수 있게 해요.
const BARE = /^(#{1,3}|-|- \[[ xX]\]|\d+\.|>|- [^:]{1,20}:)$/;
// 붙인 파일: ![논문.pdf](file:<uuid>)
const FILE = /^!\[([^\]]*)\]\(file:([0-9a-f-]{36})\)$/;

export function parseBlocks(body: string): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];

  body.split('\n').forEach((raw, line) => {
    const text = raw.trimEnd();
    if (text.trim() === '') return;

    // 끝 띄어쓰기를 지우기 전 글로 봐요. '## '(빈 제목)과 '##'(기호만 남은 글)을 나눠야 해서요.
    const file = FILE.exec(text);
    if (file) {
      blocks.push({ kind: 'file', line, name: file[1], fileId: file[2] });
      return;
    }

    if (BARE.test(raw)) {
      blocks.push({ kind: 'paragraph', line, prefix: '', text: raw });
      return;
    }

    const heading = HEADING.exec(text);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      const prefix = `${heading[1]} `;
      blocks.push({ kind: 'heading', level, line, prefix, text: heading[2] ?? '' });
      return;
    }

    // 체크 줄을 먼저 봐요. '- [ ] 할 일: ...'이 이름과 값 줄로 잡히지 않게요.
    const check = CHECK.exec(text);
    if (check) {
      const checked = check[2] !== ' ';
      blocks.push({ kind: 'check', checked, line, prefix: check[1], text: check[3] });
      return;
    }

    const field = FIELD.exec(text);
    if (field) {
      const label = field[1].trim();
      const row = { label, line, prefix: `- ${field[1]}: `, text: (field[2] ?? '').trim() };
      const last = blocks[blocks.length - 1];
      // 바로 앞도 이름과 값 줄이면 같은 표에 이어 붙여요.
      if (last?.kind === 'fields') last.rows.push(row);
      else blocks.push({ kind: 'fields', rows: [row] });
      return;
    }

    const bullet = BULLET.exec(text);
    if (bullet) {
      blocks.push({ kind: 'bullet', line, prefix: '- ', text: bullet[2] });
      return;
    }

    const number = NUMBER.exec(text);
    if (number) {
      const order = Number(number[2]);
      blocks.push({ kind: 'number', order, line, prefix: `${order}. `, text: number[3] });
      return;
    }

    const quote = QUOTE.exec(text);
    if (quote) {
      blocks.push({ kind: 'quote', line, prefix: '> ', text: quote[2] });
      return;
    }

    blocks.push({ kind: 'paragraph', line, prefix: '', text });
  });

  return blocks;
}

/** 본문의 line번째 줄을 통째로 바꿔요. */
export function replaceLine(body: string, line: number, content: string): string {
  const lines = body.split('\n');
  lines[line] = content;
  return lines.join('\n');
}

/** line번째 줄 바로 아래에 새 줄을 넣어요. */
export function insertLineAfter(body: string, line: number, content: string): string {
  const lines = body.split('\n');
  lines.splice(line + 1, 0, content);
  return lines.join('\n');
}

/** 글이 있는 마지막 줄 번호. 본문이 비었으면 -1 */
export function lastFilledLine(body: string): number {
  const lines = body.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim() !== '') return i;
  return -1;
}

/** line번째 줄의 글. 없는 줄이면 빈 글 */
export function lineText(body: string, line: number): string {
  return body.split('\n')[line] ?? '';
}

// 해시태그: 줄 처음이나 띄어쓰기 뒤에서 '#' 바로 다음에 글자가 붙은 것. ('# 제목'처럼 띄어 쓰면 제목이에요)
const TAG = /(^|\s)(#[^\s#]+)/g;

/** 글을 해시태그와 나머지로 나눠요. 미리보기에서 태그만 다른 색으로 보여줄 때 써요. */
export function splitTags(text: string): { text: string; tag: boolean }[] {
  const parts: { text: string; tag: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(TAG)) {
    const start = (match.index ?? 0) + match[1].length;
    if (start > last) parts.push({ text: text.slice(last, start), tag: false });
    parts.push({ text: match[2], tag: true });
    last = start + match[2].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), tag: false });
  return parts;
}

/**
 * 사진을 넣을 기본 자리: '## 사진'이나 '## 대표 사진' 제목 아래, 이미 넣은 사진 줄들의 끝.
 * 이 줄 번호 바로 아래에 넣으면 돼요. 그런 칸이 없으면 null
 */
export function photoSlot(body: string): number | null {
  const lines = body.split('\n');
  const heading = lines.findIndex((l) => /^## (대표 )?사진\s*$/.test(l));
  if (heading === -1) return null;
  let at = heading;
  while (at + 1 < lines.length && FILE.test(lines[at + 1])) at++;
  return at;
}

/** line번째 줄 위에서 글이 있는 가장 가까운 줄 번호. 없으면 -1 */
export function previousFilledLine(body: string, line: number): number {
  const lines = body.split('\n');
  for (let i = line - 1; i >= 0; i--) if (lines[i].trim() !== '') return i;
  return -1;
}

/** line번째 줄을 지워요. */
export function removeLine(body: string, line: number): string {
  const lines = body.split('\n');
  lines.splice(line, 1);
  return lines.join('\n');
}

/** 엔터를 쳤을 때 다음 줄에 붙일 머리. 목록이 아니면 null (새 줄을 만들지 않아요) */
export function nextPrefix(block: PreviewBlock): string | null {
  if (block.kind === 'bullet') return '- ';
  if (block.kind === 'check') return '- [ ] ';
  if (block.kind === 'number') return `${block.order + 1}. `;
  return null;
}
