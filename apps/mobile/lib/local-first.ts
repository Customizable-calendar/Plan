import AsyncStorage from '@react-native-async-storage/async-storage';

import { sourceFor } from './data-source';
import { env } from './env';
import { getSupabase } from './supabase';

// 기기 먼저 저장하는 표 (메모·카드·일정이 같이 써요).
// - 로그인 전: 이 기기에만 둬요 (AsyncStorage, 웹은 localStorage).
// - 로그인 후: 기기와 계정(Supabase) 둘 다에 둬요. 기기에 먼저 쓰고 바로 계정에도 올려요.
//   못 올린 것(인터넷이 끊긴 때 등)은 표시해 두고 다음에 목록을 볼 때 다시 올려요.
// - 처음 로그인하면 로그인 전에 이 기기에 쓴 것을 그 계정으로 옮겨요.
// - 기기 저장은 계정마다 따로라, 로그아웃하고 다른 계정으로 들어와도 섞이지 않아요.
// 계정에 올리는 건 그 기능이 EXPO_PUBLIC_SUPABASE_FEATURES(또는 앱 전체 supabase)에 켜져 있을 때만이에요.

type Row = Record<string, unknown>;

interface Stored<T> {
  items: T[];
  /** 계정에 아직 못 올린 것 */
  dirty: string[];
  /** 기기에서 지웠지만 계정에서는 아직 못 지운 것 */
  removed: string[];
  /** 예시 데이터를 한 번 넣었는지 */
  seeded?: boolean;
}

export interface LocalFirstOptions<T extends { id: string }> {
  /** features/registry의 기능 id. sourceFor로 계정에 올릴지 정해요. */
  feature: string;
  /** Supabase 테이블 이름. 기기 저장 이름에도 써요. */
  table: string;
  toRow: (item: T) => Row;
  fromRow: (row: Row) => T;
  /** 계정 연결이 꺼진 빌드(예시 데이터)에서 처음 한 번 넣을 예시 */
  seed?: () => T[];
  /** 이 표보다 먼저 올려야 하는 표 (외래 키). 예: 체크리스트는 메모 다음 */
  after?: () => Promise<void>;
}

export interface LocalFirstTable<T extends { id: string }> {
  /** 저장된 것 전부. 로그인했으면 처음 한 번 계정과 맞춰요. */
  list(): Promise<T[]>;
  /** 새로 넣거나 고쳐요 (같은 id면 덮어써요). */
  put(items: T[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  /** 계정과 맞추기: 못 올린 것을 올리고 계정에 있는 것을 받아요. 로그인 전이면 아무것도 안 해요. */
  sync(): Promise<void>;
}

const configured = Boolean(env.supabaseUrl && env.supabaseKey);
const GUEST = 'guest';

/** 로그인한 계정 id. 로그인 전이거나 Supabase 설정이 없으면 null이에요. 인터넷 없이 기기에서 읽어요. */
export async function currentUserId(): Promise<string | null> {
  if (!configured) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * 로그인·로그아웃으로 계정이 바뀌면 불러요. 기능의 store가 목록을 다시 불러올 때 써요.
 * 앱이 켜져 있는 동안 계속 들어요(구독을 풀지 않아요).
 */
export function onAccountChange(listener: () => void): void {
  if (!configured) return;
  let last: string | null | undefined;
  getSupabase().auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null;
    if (last !== undefined && id !== last) listener();
    last = id;
  });
}

// 같은 저장 칸을 동시에 고치지 않게 차례로 해요.
const queues = new Map<string, Promise<unknown>>();
function serial<R>(key: string, task: () => Promise<R>): Promise<R> {
  const run = (queues.get(key) ?? Promise.resolve()).then(task, task);
  queues.set(
    key,
    run.catch(() => {}),
  );
  return run;
}

export function localFirstTable<T extends { id: string }>(
  options: LocalFirstOptions<T>,
): LocalFirstTable<T> {
  const { feature, table, toRow, fromRow, seed, after } = options;
  const remote = configured && sourceFor(feature) === 'supabase';
  const keyFor = (owner: string) => `local-first:${table}:${owner}`;
  /** 이번에 앱을 켠 뒤 계정과 맞춘 계정 id */
  const synced = new Map<string, Promise<void>>();

  async function load(owner: string): Promise<Stored<T>> {
    const raw = await AsyncStorage.getItem(keyFor(owner));
    const stored: Stored<T> = raw
      ? (JSON.parse(raw) as Stored<T>)
      : { items: [], dirty: [], removed: [] };
    if (!remote && seed && !stored.seeded) {
      const ids = new Set(stored.items.map((i) => i.id));
      stored.items = [...stored.items, ...seed().filter((i) => !ids.has(i.id))];
      stored.seeded = true;
      await save(owner, stored);
    }
    return stored;
  }

  async function save(owner: string, stored: Stored<T>) {
    await AsyncStorage.setItem(keyFor(owner), JSON.stringify(stored));
  }

  const ownerOf = async () => (remote ? ((await currentUserId()) ?? GUEST) : GUEST);

  /** 계정에 올려 봐요. 올린 id를 돌려줘요. 못 올리면 빈 목록이에요(다음에 다시 해요). */
  async function push(items: T[]): Promise<string[]> {
    if (items.length === 0) return [];
    const { error } = await getSupabase()
      .from(table)
      .upsert(items.map(toRow) as never, { onConflict: 'user_id,id' });
    if (error) {
      console.warn(`[${table}] 계정에 올리지 못했어요. 다음에 다시 해요.`, error.message);
      return [];
    }
    return items.map((i) => i.id);
  }

  async function pushRemoved(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const { error } = await getSupabase().from(table).delete().in('id', ids);
    if (error) {
      console.warn(`[${table}] 계정에서 지우지 못했어요. 다음에 다시 해요.`, error.message);
      return [];
    }
    return ids;
  }

  async function syncFor(user: string): Promise<void> {
    if (after) await after();
    const key = keyFor(user);
    await serial(key, async () => {
      const stored = await load(user);
      // 로그인 전에 이 기기에 쓴 것을 이 계정으로 옮겨요.
      const guest = await load(GUEST);
      if (guest.items.length > 0 || guest.removed.length > 0) {
        const mine = new Map(stored.items.map((i) => [i.id, i]));
        for (const item of guest.items) mine.set(item.id, item);
        stored.items = [...mine.values()];
        stored.dirty = [...new Set([...stored.dirty, ...guest.items.map((i) => i.id)])];
        await AsyncStorage.removeItem(keyFor(GUEST));
      }

      const done = new Set(await push(stored.items.filter((i) => stored.dirty.includes(i.id))));
      stored.dirty = stored.dirty.filter((id) => !done.has(id));
      const gone = new Set(await pushRemoved(stored.removed));
      stored.removed = stored.removed.filter((id) => !gone.has(id));

      const { data, error } = await getSupabase().from(table).select('*');
      if (error) {
        console.warn(`[${table}] 계정에서 받지 못했어요. 기기에 있는 것만 보여요.`, error.message);
      } else {
        // 계정에 있는 것이 기준이에요. 아직 못 올린 것과 못 지운 것만 기기 쪽을 따라요.
        const local = new Map(stored.items.map((i) => [i.id, i]));
        const merged = new Map((data as Row[]).map(fromRow).map((i) => [i.id, i]));
        for (const id of stored.dirty) {
          const item = local.get(id);
          if (item) merged.set(id, item);
        }
        for (const id of stored.removed) merged.delete(id);
        stored.items = [...merged.values()];
      }
      await save(user, stored);
    });
  }

  async function sync(): Promise<void> {
    if (!remote) return;
    const user = await currentUserId();
    if (!user) return;
    let running = synced.get(user);
    if (!running) {
      running = syncFor(user).catch((e: unknown) => {
        synced.delete(user); // 다음에 다시 해 봐요.
        console.warn(`[${table}] 계정과 맞추지 못했어요.`, e);
      });
      synced.set(user, running);
    }
    await running;
  }

  return {
    async list() {
      await sync();
      const owner = await ownerOf();
      return serial(keyFor(owner), async () => (await load(owner)).items);
    },

    async put(items) {
      if (items.length === 0) return;
      const owner = await ownerOf();
      const key = keyFor(owner);
      await serial(key, async () => {
        const stored = await load(owner);
        const byId = new Map(stored.items.map((i) => [i.id, i]));
        for (const item of items) byId.set(item.id, item);
        stored.items = [...byId.values()];
        const ids = items.map((i) => i.id);
        stored.removed = stored.removed.filter((id) => !ids.includes(id));
        if (owner !== GUEST) {
          stored.dirty = [...new Set([...stored.dirty, ...ids])];
          await save(owner, stored);
          const done = new Set(await push(items));
          stored.dirty = stored.dirty.filter((id) => !done.has(id));
        }
        await save(owner, stored);
      });
    },

    async remove(ids) {
      if (ids.length === 0) return;
      const owner = await ownerOf();
      const key = keyFor(owner);
      await serial(key, async () => {
        const stored = await load(owner);
        stored.items = stored.items.filter((i) => !ids.includes(i.id));
        stored.dirty = stored.dirty.filter((id) => !ids.includes(id));
        if (owner !== GUEST) {
          stored.removed = [...new Set([...stored.removed, ...ids])];
          await save(owner, stored);
          const gone = new Set(await pushRemoved(ids));
          stored.removed = stored.removed.filter((id) => !gone.has(id));
        }
        await save(owner, stored);
      });
    },

    sync,
  };
}
