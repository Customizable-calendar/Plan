import type { Note } from '@noteapp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  deleteChecklist,
  deleteForever,
  listChecklists,
  listImportantNotes,
  listNotes,
  listTrash,
  markImportant,
  moveToChecklist,
  restoreNote,
  trashNote,
  unmarkImportant,
  updateChecklist,
  updateNote,
  type NoteChecklist,
  type TrashedNote,
} from './data';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 기록에 있는 메모 목록과, 고치기, 휴지통으로 보내기, 체크리스트로 옮기기 */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useFocusEffect: 화면이 보일 때마다 불러와요. 휴지통에서 되돌리고 돌아와도 바로 보여요.
  useFocusEffect(
    useCallback(() => {
      listNotes()
        .then(setNotes)
        .catch((e: unknown) => setError(message(e)))
        .finally(() => setLoading(false));
    }, []),
  );

  const without = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const update = async (note: Note) => {
    const saved = await updateNote(note);
    setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)));
  };

  const trash = async (note: Note) => {
    without(note.id); // 화면에서 먼저 빼서 바로 사라진 것처럼 보여요.
    await trashNote(note);
  };

  const toChecklist = async (note: Note) => {
    without(note.id);
    await moveToChecklist(note);
  };

  return { notes, loading, error, update, trash, toChecklist };
}

/** 중요한 메모 목록과 별 켜기·끄기. 기기 저장소에 남아서 지우기 전까지 사라지지 않아요. */
export function useImportantNotes() {
  const [important, setImportant] = useState<Note[]>([]);

  const reload = useCallback(() => {
    listImportantNotes()
      .then(setImportant)
      .catch(() => setImportant([]));
  }, []);
  useEffect(reload, [reload]);

  const isImportant = (id: string) => important.some((n) => n.id === id);

  /** 별을 누르면 중요한 메모에 넣고, 다시 누르면 빼요. */
  const toggle = async (note: Note) => {
    setImportant(isImportant(note.id) ? await unmarkImportant(note.id) : await markImportant(note));
  };

  const remove = async (id: string) => setImportant(await unmarkImportant(id));

  return { important, isImportant, toggle, remove, reload };
}

/** 막 쓰기 아래 체크리스트. 메모 화면에서 옮기고 돌아오면 다시 불러와요. */
export function useChecklists() {
  const [checklists, setChecklists] = useState<NoteChecklist[]>([]);

  // useFocusEffect: 이 화면이 다시 보일 때마다 실행돼요 (다른 화면에서 돌아올 때 포함).
  useFocusEffect(
    useCallback(() => {
      listChecklists()
        .then(setChecklists)
        .catch(() => setChecklists([]));
    }, []),
  );

  const toggleItem = async (checklist: NoteChecklist, index: number) => {
    const items = checklist.items.map((it, i) =>
      i === index ? { ...it, checked: !it.checked } : it,
    );
    setChecklists(await updateChecklist({ ...checklist, items }));
  };

  const remove = async (id: string) => setChecklists(await deleteChecklist(id));

  return { checklists, toggleItem, remove };
}

/** 휴지통 목록, 되돌리기, 완전히 지우기 */
export function useTrash() {
  const [trash, setTrash] = useState<TrashedNote[]>([]);

  useEffect(() => {
    listTrash()
      .then(setTrash)
      .catch(() => setTrash([]));
  }, []);

  const restore = async (id: string) => setTrash(await restoreNote(id));
  const erase = async (id: string) => setTrash(await deleteForever(id));

  return { trash, restore, erase };
}
