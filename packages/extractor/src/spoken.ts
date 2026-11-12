// 받아쓴 말(회의록 같은 긴 글) → 카드 후보 준비. (담당: B)
// 받아쓰기 결과에는 마침표가 거의 없어서 한 덩어리가 돼요. 말끝을 찾아 줄을 나누고,
// 카드 제목에서 "~하기로 했습니다" 같은 말꼬리와 "아 그리고" 같은 군말을 지워요.

/** 문장이 끝나는 말끝. "다"만 있는 경우("거의 다 끝냈고요")는 빼요. */
const SENTENCE_END =
  /(니다|[어아여해돼에예네]요|고요|구요|세요|래요|대요|군요|거든요|잖아요|던데요|는데요|죠|[었았였했]다|한다|된다|이다|겠다)([ \t]+)/g;
/** 말을 이어 가는 연결 끝. 다음 말이 다른 일일 때가 많아요. ("하고"는 "민수하고"처럼 '와'라서 빼요) */
const CLAUSE_END = /(했고|있고|됐고|였고|이고|는데|니까|으니까|거든|해서)([ \t]+)/g;
/** 새 이야기를 여는 말 앞에서도 나눠요. */
const TOPIC_START = /([ \t]+)(그리고|그다음에?|다음으로|아\s그리고|또|마지막으로)(?=[ \t])/g;

/**
 * 말끝·연결 끝 뒤의 공백 한 칸을 줄바꿈으로 바꿔요. 글자 수는 그대로라서
 * 카드 span(원문 위치)이 받아쓴 글과 똑같이 맞아요.
 */
export function markSpokenBreaks(text: string): string {
  const breakAfter = (_m: string, end: string, ws: string) => `${end}\n${ws.slice(1)}`;
  return text
    .replace(SENTENCE_END, breakAfter)
    .replace(CLAUSE_END, breakAfter)
    .replace(TOPIC_START, (_m, ws: string, word: string) => `\n${ws.slice(1)}${word}`);
}

/** 제목 앞의 군말 */
const LEAD =
  /^(?:(?:네|아|어|음|자|그럼|그러면|그리고|그래서|일단|또|그다음에?|마지막으로)[,\s]+)+/;
/** "~하기로 했습니다" → "~하기" */
const PROMISE = /(\S*기)로\s*(?:했\S*|하자\S*|합의\S*|정했\S*)$/;
/** "~어 주세요", "~해 주세요" → "~기" */
const PLEASE = /(\S*?)(해|어|아|여)\s*(?:주세요|줘요|주시면\s*돼요|줄래요)$/;
/** 말꼬리 */
const TAIL =
  /\s*(?:(?:이|가|은|는)\s*)?(?:있습니다|있어요|있으니까|있고|있는데|입니다|이에요|예요|합니다|해요|할게요|하겠습니다|할\s*거예요|할\s*예정이에요|할\s*예정입니다|예정이에요|예정입니다)$/;

/** 받아쓴 말에서 나온 카드 제목을 짧게 다듬어요. 너무 짧아지면 원래 제목을 써요. */
export function tidySpokenTitle(title: string): string {
  let t = title.trim().replace(LEAD, '');
  t = t.replace(PROMISE, '$1');
  t = t.replace(PLEASE, (_m, stem: string, end: string) => `${stem}${end === '해' ? '하' : ''}기`);
  t = t.replace(TAIL, '');
  // "디자인 리뷰를 하기" → "디자인 리뷰"
  t = t.replace(/\s*[을를]\s*하기$/, '');
  t = t.trim();
  return t.length >= 2 ? t : title.trim();
}
