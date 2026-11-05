// TODO(A, M2): 사용자 설정의 시간대로 바꿔요.
const timezone = 'Asia/Seoul';

/** "10월 24일" 같은 짧은 날짜 */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}
