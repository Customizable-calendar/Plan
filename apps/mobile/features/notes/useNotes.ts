import type { Note } from '@noteapp/shared';
import { useEffect, useState } from 'react';

import { listImportantNotes, listNotes, markImportant, unmarkImportant } from './data';

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

/** 중요한 메모 목록과 별 켜기·끄기. 기기 저장소에 남아서 지우기 전까지 사라지지 않아요. */
export function useImportantNotes() {
  const [important, setImportant] = useState<Note[]>([]);

  useEffect(() => {
    listImportantNotes()
      .then(setImportant)
      .catch(() => setImportant([]));
  }, []);

  const isImportant = (id: string) => important.some((n) => n.id === id);

  /** 별을 누르면 중요한 메모에 넣고, 다시 누르면 빼요. */
  const toggle = async (note: Note) => {
    setImportant(isImportant(note.id) ? await unmarkImportant(note.id) : await markImportant(note));
  };

  const remove = async (id: string) => setImportant(await unmarkImportant(id));

  return { important, isImportant, toggle, remove };
}
