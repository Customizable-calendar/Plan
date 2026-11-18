import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type Document,
  type DocumentRow,
  fixtures,
  type Session,
  type SessionRow,
  toDocument,
  toDocumentInsert,
  toSession,
  toSessionInsert,
} from '@noteapp/shared';

import { localFirstTable } from './local-first';

// 세션과 문서 저장소(테이블: docs_sessions, docs_documents). 편집기(editor)와 세션(sessions)이 같이 써요.
// 메모와 같은 방식이에요: 로그인 전엔 이 기기에만, 로그인 후엔 기기와 계정 둘 다(lib/local-first.ts).
// 계정 연결은 'sessions' 기능을 따라가요(EXPO_PUBLIC_SUPABASE_FEATURES에 sessions가 있으면 계정에도 저장).
// 계정 연결이 꺼진 빌드에서는 예시 세션·문서(fixtures)를 처음 한 번 넣어 둬요. 지우면 다시 안 나와요.

const sessions = localFirstTable<Session>({
  feature: 'sessions',
  table: 'docs_sessions',
  toRow: toSessionInsert,
  fromRow: (row) => toSession(row as SessionRow),
  seed: () => fixtures.sessions,
});

const documents = localFirstTable<Document>({
  feature: 'sessions',
  table: 'docs_documents',
  toRow: toDocumentInsert,
  fromRow: (row) => toDocument(row as DocumentRow),
  seed: () => fixtures.documents,
});

// 예전 버전은 미완성 세션을 AsyncStorage 'sessions.drafts'에 따로 뒀어요. 처음 한 번 표로 옮기고 지워요.
const OLD_DRAFTS_KEY = 'sessions.drafts';
const OLD_REMOVED_KEY = 'sessions.drafts.removed';
let moved: Promise<void> | null = null;

function moveOldDrafts(): Promise<void> {
  moved ??= (async () => {
    try {
      const [rawDrafts, rawRemoved] = await Promise.all([
        AsyncStorage.getItem(OLD_DRAFTS_KEY),
        AsyncStorage.getItem(OLD_REMOVED_KEY),
      ]);
      if (rawDrafts) await sessions.put(JSON.parse(rawDrafts) as Session[]);
      if (rawRemoved) await sessions.remove(JSON.parse(rawRemoved) as string[]);
      if (rawDrafts || rawRemoved)
        await AsyncStorage.multiRemove([OLD_DRAFTS_KEY, OLD_REMOVED_KEY]);
    } catch {
      moved = null; // 다음에 다시 해 봐요.
    }
  })();
  return moved;
}

// ── 세션 ──

/** 세션 전부(미완성 세션 포함) */
export async function listSessions(): Promise<Session[]> {
  await moveOldDrafts();
  return sessions.list();
}

export async function putSession(session: Session): Promise<void> {
  await sessions.put([session]);
}

export async function removeSession(id: string): Promise<void> {
  await sessions.remove([id]);
}

// ── 문서 ──

/** 문서 전부. 최근에 고친 문서가 위로 와요. */
export async function listAllDocuments(): Promise<Document[]> {
  return (await documents.list()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findDocument(id: string): Promise<Document | undefined> {
  return (await documents.list()).find((d) => d.id === id);
}

/** 문서를 저장해요. 고친 시각(updatedAt)은 지금으로 바꿔요. */
export async function putDocument(document: Document): Promise<Document> {
  const saved = { ...document, updatedAt: new Date().toISOString() };
  await documents.put([saved]);
  return saved;
}

export async function removeDocument(id: string): Promise<void> {
  await documents.remove([id]);
}
