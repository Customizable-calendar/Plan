// whisper가 받아쓴 글을 다듬는 순수 함수들이에요. (담당: B)
// 네이티브 모듈 없이 돌아서 따로 시험해 볼 수 있어요.

/**
 * whisper에 먼저 들려주는 예시 문장. 부호가 찍힌 문장을 보여 주면 받아쓴 글에도 마침표·물음표를
 * 찍고 문장을 나눠요. 자주 나오는 팀 이름·말도 같이 넣어서 맞게 받아쓰게 해요.
 */
export const PROMPT =
  '안녕하세요. 오늘 회의를 시작하겠습니다. 민성, 준호, 재민, 서현이 참석했어요. ' +
  '다음 주 화요일 오후 2시에 디자인 리뷰를 해요. 금요일까지 발표 자료를 만들어 주세요. 질문 있나요?';

/** 앞 조각 글을 이어 붙일 때 쓰는 짧은 예시. whisper 예시 길이 한도(224토큰) 안에 들게 짧게 둬요. */
const NAMES = '민성, 준호, 재민, 서현이 참석한 회의예요.';

/** 앞 조각 끝에서 이만큼(글자)을 다음 조각 예시로 넘겨요. */
const TAIL_CHARS = 60;

/** 내 단어 줄 앞말. 이 말로 시작하는 글은 받아쓴 말이 아니라 예시가 그대로 나온 거예요. */
const WORDS_LEAD = '자주 쓰는 말:';
/** 내 단어 줄 길이 한도(글자). 예시 길이 한도 안에 들게 짧게 둬요. */
const WORDS_CHARS = 50;

/**
 * 사용자가 자주 쓰는 말(해시태그·카테고리 이름 등)을 예시 한 줄로 만들어요(SimulStreaming의
 * static prompt 참고). 앞에 둔 말일수록 먼저 넣고, 한도를 넘으면 뒤는 빼요. 없으면 빈 글이에요.
 */
export function wordsLine(words: string[]): string {
  const picked: string[] = [];
  let length = 0;
  for (const raw of words) {
    const word = raw.replace(/^#/, '').replace(/[_-]+/g, ' ').trim();
    if (word.length < 2 || word.length > 15 || picked.includes(word)) continue;
    if (length + word.length + 2 > WORDS_CHARS) break;
    picked.push(word);
    length += word.length + 2;
  }
  return picked.length ? `${WORDS_LEAD} ${picked.join(', ')}.` : '';
}

/**
 * 다음 조각을 받아쓸 때 줄 예시 문장. 앞에서 받아쓴 글 끝을 같이 주면
 * 조각이 바뀌어도 말투·이름·주제가 이어져요. words: 사용자가 자주 쓰는 말(wordsLine)
 */
export function promptFor(previous: string[], words: string[] = []): string {
  const line = wordsLine(words);
  const joined = previous.slice(-4).join(' ').trim();
  // 예시가 너무 길면 whisper가 앞부분부터 버려요. 그래서 꼭 남길 말을 뒤에 둬요.
  if (!joined) return [PROMPT, line].filter(Boolean).join(' ');
  let tail = joined.slice(-TAIL_CHARS);
  if (tail.length < joined.length) {
    // 낱말 중간에서 시작하지 않게 첫 띄어쓰기 뒤부터 써요.
    const space = tail.indexOf(' ');
    if (space >= 0) tail = tail.slice(space + 1);
  }
  return [NAMES, line, tail].filter(Boolean).join(' ');
}

/** 조용할 때 whisper가 자주 지어내는 말이에요(방송·영상 자막에서 배운 말). */
const MADE_UP =
  /시청해\s?주셔서\s?감사합니다|구독과\s?좋아요|좋아요와\s?구독|자막\s?(제공|협찬)|다음\s?영상에서\s?(만나요|뵙겠습니다)|(MBC|KBS|SBS|YTN)\s?뉴스/;

/** 예시 문장(PROMPT·NAMES)이 그대로 나온 것도 지어낸 말로 봐요. */
const PROMPT_SENTENCES = [...PROMPT.split(/(?<=[.?])\s+/), NAMES].filter((t) => t.length >= 15);

export const isMadeUp = (text: string) =>
  MADE_UP.test(text) || PROMPT_SENTENCES.includes(text) || text.startsWith(WORDS_LEAD);

/**
 * 같은 말이 세 번 넘게 이어지면 한 번만 남겨요.
 * whisper는 잡음이나 끊긴 말에서 "감사합니다. 감사합니다. 감사합니다…"처럼 같은 말을 되풀이해요.
 */
export function squashRepeats(text: string): string {
  return text.replace(/(.{2,40}?)(?:[\s,.!?]*\1){2,}/gu, '$1').trim();
}

/** 미리 받아쓴 문장 하나. endMs: 받아쓴 소리 시작부터 이 문장이 끝나는 곳 */
export interface PreviewSegment {
  text: string;
  endMs: number;
}

/** 소리 끝에서 이만큼 안쪽에서 끝난 문장만 고정해요. 끝에 붙은 문장은 말이 더 이어질 수 있어요. */
const SETTLE_MARGIN_MS = 1500;

/**
 * 미리 받아쓰기에서 고정해도 되는 앞 문장 수예요(LocalAgreement 방식, SimulStreaming 참고).
 * 같은 소리를 두 번 받아써서(previous, current) 앞에서부터 똑같이 나오고,
 * 소리 끝에서 조금 떨어져서 끝난 문장만 세요. 고정한 문장은 다시 받아쓰지 않아요.
 */
export function settledCount(
  previous: PreviewSegment[],
  current: PreviewSegment[],
  windowMs: number,
): number {
  let n = 0;
  while (
    n < current.length &&
    n < previous.length &&
    current[n]!.text === previous[n]!.text &&
    current[n]!.endMs <= windowMs - SETTLE_MARGIN_MS
  )
    n++;
  return n;
}

/** 받아쓴 조각 하나를 다듬어요. 쓸 말이 없으면 빈 글이에요. */
export function cleanSegment(text: string, previous?: string): string {
  const squashed = squashRepeats(text.trim());
  if (!squashed || isMadeUp(squashed)) return '';
  // 조각이 바뀌는 곳에서 같은 문장을 두 번 받아쓰면 한 번만 둬요.
  if (previous && squashed === previous.trim()) return '';
  return squashed;
}
