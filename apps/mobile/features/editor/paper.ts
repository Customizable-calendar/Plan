// 논문 PDF 글에서 논문 정보, 초록, 키워드, 서론을 규칙으로 찾아요. 화면 없이 쓸 수 있는 순수 함수예요.
// 찾은 것은 "제안"이에요. 사용자가 고른 것만 본문에 넣어요. 없는 값은 지어내지 않고 비워 둬요.

/** PDF에서 찾은 글 한 덩어리와, 몇 쪽에서 찾았는지 */
export interface Found {
  text: string;
  /** 1부터 세는 쪽 번호 */
  page: number;
}

export interface PaperExtract {
  title?: string;
  authors?: string;
  year?: string;
  doi?: string;
  abstract?: Found;
  keywords?: string[];
  introduction?: Found;
}

/** PDF 문서 정보(메타데이터)에서 쓰는 값 */
export interface PdfInfo {
  Title?: unknown;
  Author?: unknown;
}

const ABSTRACT = /(?:^|\s)(abstract|국문\s*초록|초록|요약)\s*[.:—–-]?\s+/i;
const KEYWORDS = /(?:^|\s)(keywords|key\s+words|index\s+terms|주제어|핵심어|키워드)\s*[.:—–-]?\s*/i;
const INTRODUCTION = /(?:^|\s)(?:(?:1|I|Ⅰ)\s*[.:]?\s*)?(introduction|서론|머리말)\s*[.:]?\s+/i;
// 서론 다음 장: "2 Related Work", "2. 관련 연구", "II. METHOD" 같은 번호 붙은 제목
const NEXT_SECTION =
  /\s(?:2|II|Ⅱ)\s*\.?\s+(?=[A-Z가-힣])(?:[A-Z][A-Za-z-]+|[가-힣]+)(?:\s+(?:[A-Z][A-Za-z-]+|and|of|for|[가-힣]+)){0,4}\s/;
const DOI = /\b(10\.\d{4,9}\/[^\s"<>,;]+[^\s"<>,;.)\]])/i;
const ARXIV = /arXiv:\s?(\d{2})(\d{2})\.\d{4,5}/i;

/** 초록과 서론은 길면 여기까지만 가져와요(글자 수). 문장 끝에서 잘라요. */
const ABSTRACT_MAX = 3000;
const INTRO_MAX = 4000;

/** PDF에서 뽑은 글을 한 줄 글로 정리해요: 줄 끝 하이픈 잇기, 줄바꿈과 겹친 띄어쓰기를 하나로. */
export function cleanText(raw: string): string {
  return raw
    .replace(/(\p{Ll})-\s*\n\s*(\p{Ll})/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 길면 max 근처의 문장 끝에서 자르고 '…'를 붙여요. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('다. '));
  return `${end > max / 2 ? head.slice(0, end + 1) : head}…`;
}

/** 쪽마다 정리한 글을 이어 붙이고, 글자 위치로 쪽 번호를 찾을 수 있게 해요. */
function joinPages(pages: string[]) {
  const starts: number[] = [];
  let text = '';
  for (const page of pages) {
    starts.push(text.length);
    text += cleanText(page) + ' ';
  }
  const pageAt = (index: number) => {
    let page = 0;
    starts.forEach((start, i) => {
      if (index >= start) page = i;
    });
    return page + 1;
  };
  return { text, pageAt };
}

function infoText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  // 편집 프로그램이 넣은 이름(파일 이름, Untitled)은 논문 정보가 아니라서 버려요.
  if (!text || /^untitled$/i.test(text) || /\.(docx?|tex|pdf|dvi)$/i.test(text)) return undefined;
  return text;
}

/** 쪽마다 글(pages)과 PDF 문서 정보로 논문 정보를 찾아요. */
export function extractPaper(pages: string[], info: PdfInfo = {}): PaperExtract {
  const { text, pageAt } = joinPages(pages);
  const result: PaperExtract = {};

  const title = infoText(info.Title);
  if (title) result.title = title;
  const authors = infoText(info.Author);
  if (authors) result.authors = authors;

  const doi = DOI.exec(text);
  if (doi) result.doi = doi[1];
  const arxiv = ARXIV.exec(text);
  if (arxiv) result.year = `20${arxiv[1]}`;

  // 초록: "Abstract" 뒤부터 키워드나 서론이 나오기 전까지
  const abstract = ABSTRACT.exec(text);
  let afterAbstract = 0;
  if (abstract) {
    const start = abstract.index + abstract[0].length;
    const rest = text.slice(start);
    const stops = [KEYWORDS.exec(rest)?.index, INTRODUCTION.exec(rest)?.index].filter(
      (i): i is number => i !== undefined && i > 40,
    );
    const end = stops.length ? Math.min(...stops) : ABSTRACT_MAX;
    const body = rest.slice(0, end).trim();
    if (body.length > 40) {
      result.abstract = { text: cut(body, ABSTRACT_MAX), page: pageAt(start) };
      afterAbstract = start + end;
    }
  }

  // 키워드: "Keywords" 뒤 한 문장(서론 전까지). 쉼표, 세미콜론, 가운뎃점으로 나눠요.
  const keywordsAt = KEYWORDS.exec(text.slice(afterAbstract ? afterAbstract - 1 : 0));
  if (keywordsAt) {
    const start = (afterAbstract ? afterAbstract - 1 : 0) + keywordsAt.index + keywordsAt[0].length;
    const rest = text.slice(start, start + 400);
    const intro = INTRODUCTION.exec(rest);
    const line = rest.slice(0, intro ? intro.index : rest.search(/\.\s|$/));
    const words = line
      .split(/\s*[,;·•]\s*/)
      .map((w) => w.replace(/[.\s]+$/, '').trim())
      .filter((w) => w.length > 1 && w.length < 50);
    if (words.length) result.keywords = words.slice(0, 10);
  }

  // 서론: 초록 뒤의 "1 Introduction"부터 다음 번호 제목(2 ...) 전까지
  const introAt = INTRODUCTION.exec(text.slice(afterAbstract));
  if (introAt) {
    const start = afterAbstract + introAt.index + introAt[0].length;
    const rest = text.slice(start);
    const next = NEXT_SECTION.exec(rest);
    const body = rest.slice(0, next ? next.index : INTRO_MAX).trim();
    if (body.length > 40) result.introduction = { text: cut(body, INTRO_MAX), page: pageAt(start) };
  }

  return result;
}

/** 본문에 넣을 항목 */
export type PaperPart = 'info' | 'abstract' | 'keywords' | 'introduction';

const INFO_FIELDS: [keyof PaperExtract, string][] = [
  ['title', '제목'],
  ['authors', '저자'],
  ['year', '연도'],
  ['doi', 'DOI'],
];

/** 키워드를 해시태그로: 띄어쓰기는 '-'로 이어요. ('#딥 러닝'은 태그가 끊겨서요) */
export function keywordTag(word: string): string {
  return `#${word.trim().replace(/\s+/g, '-').replace(/#/g, '')}`;
}

/** '## 제목' 줄 번호. 없으면 -1 */
function headingLine(lines: string[], title: string): number {
  return lines.findIndex((l) => l.trim() === `## ${title}`);
}

/** 제목 아래 칸의 끝(다음 '#' 제목 바로 앞) */
function sectionEnd(lines: string[], from: number): number {
  for (let i = from + 1; i < lines.length; i++) if (/^#{1,3} /.test(lines[i])) return i;
  return lines.length;
}

/** 칸의 빈 자리 줄('> ', '- ')은 지우고 그 자리에 새 글을 넣어요. 칸이 없으면 맨 끝에 새로 만들어요. */
function fillSection(lines: string[], title: string, content: string[]): string[] {
  // 같은 PDF에서 다시 뽑아 넣어도 같은 글이 두 번 들어가지 않게 해요.
  if (lines.includes(content[0])) return lines;
  const at = headingLine(lines, title);
  if (at === -1) return [...lines, '', `## ${title}`, ...content];
  const end = sectionEnd(lines, at);
  const kept = lines.slice(at + 1, end).filter((l) => !/^(>|-)\s*$/.test(l));
  // 칸 안의 '- 연구 배경: '처럼 내가 채울 칸은 남기고, 찾은 글을 그 위에 넣어요.
  const tail = kept.length ? kept : [''];
  return [...lines.slice(0, at + 1), ...content, ...tail, ...lines.slice(end)];
}

/** 고른 항목을 본문에 넣은 새 본문. 원문 위치를 알 수 있게 쪽 번호를 같이 적어요. */
export function applyPaper(body: string, found: PaperExtract, parts: PaperPart[]): string {
  let lines = body.split('\n');

  if (parts.includes('info')) {
    for (const [key, label] of INFO_FIELDS) {
      const value = found[key];
      if (typeof value !== 'string') continue;
      // 비어 있는 칸만 채워요. 사용자가 이미 적은 값은 고치지 않아요.
      const i = lines.findIndex((l) => new RegExp(`^- ${label}:\\s*$`).test(l));
      if (i !== -1) lines[i] = `- ${label}: ${value}`;
    }
  }
  if (parts.includes('abstract') && found.abstract) {
    lines = fillSection(lines, '초록', [
      `> ${found.abstract.text}`,
      `PDF ${found.abstract.page}쪽에서 가져온 초록이에요.`,
    ]);
  }
  if (parts.includes('keywords') && found.keywords?.length) {
    lines = fillSection(lines, '키워드', [found.keywords.map(keywordTag).join(' ')]);
  }
  if (parts.includes('introduction') && found.introduction) {
    lines = fillSection(lines, '서론 정리', [
      `> ${found.introduction.text}`,
      `PDF ${found.introduction.page}쪽부터 가져온 서론이에요. 아래 칸은 읽고 직접 정리해요.`,
    ]);
  }
  return lines.join('\n');
}

/** 본문에 넣는 파일 줄. 미리보기에서 파일 카드로 보여요. 예: ![논문.pdf](file:<files id>) */
export function fileLine(name: string, fileId: string): string {
  return `![${name.replace(/[[\]]/g, '')}](file:${fileId})`;
}
