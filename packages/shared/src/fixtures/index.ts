// 예시 데이터예요. Supabase 연결 전(M1)에는 각자 이 데이터로 화면을 만들어요.
import type { CalendarEvent, Card, Document, ExecutionRecord, Note, Session } from '../types';
import cardsJson from './cards.json';
import documentsJson from './documents.json';
import eventsJson from './events.json';
import executionsJson from './executions.json';
import notesJson from './notes.json';
import sessionsJson from './sessions.json';

export const fixtures = {
  notes: notesJson as Note[],
  cards: cardsJson as Card[],
  events: eventsJson as CalendarEvent[],
  executions: executionsJson as ExecutionRecord[],
  sessions: sessionsJson as Session[],
  documents: documentsJson as Document[],
};
