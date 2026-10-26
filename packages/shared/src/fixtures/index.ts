// 예시 데이터예요. Supabase 연결 전(M1)에는 각자 이 데이터로 화면을 만들어요.
import type { CalendarEvent, Card, ExecutionRecord, Note } from '../types';
import cardsJson from './cards.json';
import eventsJson from './events.json';
import executionsJson from './executions.json';
import notesJson from './notes.json';

export const fixtures = {
  notes: notesJson as Note[],
  cards: cardsJson as Card[],
  events: eventsJson as CalendarEvent[],
  executions: executionsJson as ExecutionRecord[],
};
