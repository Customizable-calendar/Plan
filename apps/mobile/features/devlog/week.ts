// 주 단위(월~일)로 일지를 묶어요. 회의가 일요일 밤이라 그 주 일지를 그날 같이 봐요.
// TODO(B, M2): 사용자 시간대. 지금은 한국 시간(UTC+9, 서머타임 없음) 기준이에요.

const KST = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** 그 순간이 속한 주의 월요일 0시(한국 시간)를 "YYYY-MM-DD"로. 일지를 묶는 키예요. */
export function weekKey(at: Date): string {
  const kst = new Date(at.getTime() + KST);
  const monday = new Date(kst.getTime() - ((kst.getUTCDay() + 6) % 7) * DAY);
  return monday.toISOString().slice(0, 10);
}

export function shiftWeek(key: string, weeks: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  return new Date(d.getTime() + weeks * 7 * DAY).toISOString().slice(0, 10);
}

/** "11월 2일 ~ 8일", 달이 바뀌면 "10월 26일 ~ 11월 1일" */
export function weekLabel(key: string): string {
  const start = new Date(`${key}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * DAY);
  const md = (d: Date) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  const endText = end.getUTCMonth() === start.getUTCMonth() ? `${end.getUTCDate()}일` : md(end);
  return `${md(start)} ~ ${endText}`;
}
