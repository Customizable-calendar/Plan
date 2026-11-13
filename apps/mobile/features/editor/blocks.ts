// 본문 마크다운을 미리보기용 블록으로 나눠요. 화면 없이 쓸 수 있는 순수 함수예요.
// 원문은 고치지 않고 읽기만 해요.

export type PreviewBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  /** `- 이름: 값` 줄이 이어진 묶음. 표처럼 이름과 값을 나란히 보여줘요. */
  | { kind: 'fields'; rows: { label: string; value: string }[] }
  | { kind: 'bullet'; text: string }
  | { kind: 'check'; checked: boolean; text: string }
  | { kind: 'number'; order: string; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'paragraph'; text: string };

const HEADING = /^(#{1,3}) (.*)$/;
const CHECK = /^- \[([ xX])\] ?(.*)$/;
// 이름은 20자까지. 콜론 뒤에 띄어쓰기가 있거나 줄이 끝나야 해요. ("- 10:30 회의"는 해당 안 돼요)
const FIELD = /^- ([^:]{1,20}):(?: (.*)|\s*)$/;
const BULLET = /^- ?(.*)$/;
const NUMBER = /^(\d+)\. ?(.*)$/;
const QUOTE = /^> ?(.*)$/;

export function parseBlocks(body: string): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];

  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') continue;

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, text: heading[2] });
      continue;
    }

    // 체크 줄을 먼저 봐요. '- [ ] 할 일: ...'이 이름과 값 줄로 잡히지 않게요.
    const check = CHECK.exec(line);
    if (check) {
      blocks.push({ kind: 'check', checked: check[1] !== ' ', text: check[2] });
      continue;
    }

    const field = FIELD.exec(line);
    if (field) {
      const row = { label: field[1].trim(), value: (field[2] ?? '').trim() };
      const last = blocks[blocks.length - 1];
      // 바로 앞도 이름과 값 줄이면 같은 표에 이어 붙여요.
      if (last?.kind === 'fields') last.rows.push(row);
      else blocks.push({ kind: 'fields', rows: [row] });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      blocks.push({ kind: 'bullet', text: bullet[1] });
      continue;
    }

    const number = NUMBER.exec(line);
    if (number) {
      blocks.push({ kind: 'number', order: number[1], text: number[2] });
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      blocks.push({ kind: 'quote', text: quote[1] });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: line });
  }

  return blocks;
}
