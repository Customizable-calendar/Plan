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
  | (LinePart & { kind: 'paragraph' });

const HEADING = /^(#{1,3} )(.*)$/;
const CHECK = /^(- \[([ xX])\] ?)(.*)$/;
// 이름은 20자까지. 콜론 뒤에 띄어쓰기가 있거나 줄이 끝나야 해요. ("- 10:30 회의"는 해당 안 돼요)
const FIELD = /^- ([^:]{1,20}):(?: (.*)|\s*)$/;
const BULLET = /^(- ?)(.*)$/;
const NUMBER = /^((\d+)\. ?)(.*)$/;
const QUOTE = /^(> ?)(.*)$/;

export function parseBlocks(body: string): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];

  body.split('\n').forEach((raw, line) => {
    const text = raw.trimEnd();
    if (text.trim() === '') return;

    const heading = HEADING.exec(text);
    if (heading) {
      const level = (heading[1].length - 1) as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, line, prefix: heading[1], text: heading[2] });
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
