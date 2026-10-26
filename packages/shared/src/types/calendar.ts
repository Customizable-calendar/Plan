/** 외부 캘린더에서 가져온 일정. 시각은 UTC, 시간대는 따로 보관해요. (담당: C) */
export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  /** IANA 시간대, 예: Asia/Seoul */
  timezone: string;
  source: 'google';
}
