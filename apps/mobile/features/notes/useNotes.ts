import type { Note } from '@noteapp/shared';
import { useEffect, useState } from 'react';

import { listNotes } from './data';

/** 최근 메모 목록을 불러오고, 새로 저장한 메모를 맨 위에 붙이는 훅이에요. */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useEffect: 화면이 처음 나타날 때 한 번 실행돼요. 여기서 메모를 불러와요.
  useEffect(() => {
    listNotes()
      .then(setNotes)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const addNote = (note: Note) => setNotes((prev) => [note, ...prev]);

  return { notes, loading, error, addNote };
}
