# personal-memo 구조 벤치마킹

- 출처: [Junjak-Personal/personal-memo](https://github.com/Junjak-Personal/personal-memo) (`b8b1334`, 2026-10-31 기준)
- 작성자 허락: 코드 구조를 그대로 가져와도 된다고 확인받음 (2026-10-31)
- 그쪽 앱: 혼자 쓰는 마크다운 메모 앱. Nuxt 웹 + Flutter 웹뷰 껍데기, 파일시스템 저장, 구글 캘린더 단방향 연동, AI 연결(MCP)
- 이 문서: 그쪽에서 **우리 구조(Expo + Supabase + Edge Functions)로 옮길 부분**과 그 스켈레톤. 실제 코드는 담당자가 이 스켈레톤을 출발점으로 기능 PR에서 만들어요.

스택은 가져오지 않아요(Nuxt·Flutter·파일 저장). 가져오는 건 **설계 방식과 순수 로직**이에요. 이유는 맨 아래 "가져오지 않는 것"에 있어요.

## 1. 가져올 것 한눈에

| 기능                  | 그쪽 파일                                                       | 우리 위치(제안)                                                   | 담당 | 시기 |
| --------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- | ---- | ---- |
| 날짜 계산             | `shared/utils/memo-date.ts`                                     | `packages/shared/src/utils/date.ts`                               | D    | M0   |
| 일정 여부 규칙        | `shared/utils/todo.ts` (`isScheduled`)                          | `packages/shared/src/rules/schedule.ts`                           | B·C  | M1   |
| 도메인 오류 → 응답    | `server/memo/errors.ts`, `server/utils/memo.ts`                 | `packages/shared/src/errors.ts`, `supabase/functions/_shared/`    | D    | M2   |
| 충돌 감지(버전)       | `server/memo/file.ts` (`versionOf`, `baseVersion`)              | 테이블 `version` 컬럼 + 기능 `data.ts`                            | D    | M2   |
| 쓰던 내용 보호        | `app/utils/memo-drafts.ts`, `app/plugins/memo-drafts.client.ts` | `apps/mobile/lib/drafts.ts`                                       | A    | M2   |
| 한 번에 하나만 실행   | `server/calendar/sync.ts` (`run`), `useStructureQueue.ts`       | `packages/shared/src/utils/singleFlight.ts`                       | D    | M2   |
| 구글 캘린더 대조      | `server/calendar/{google,reconcile,sync}.ts` + 테스트           | `packages/calendar-sync/` + `supabase/functions/google-calendar/` | C    | M3   |
| 수정 이력             | `server/memo/history.ts`                                        | 테이블 `docs_revisions` + 트리거                                  | A    | M3   |
| 공유 시트 → 받은 메모 | `app/utils/share-inbox.ts`, `ios/Shared/MemoInbox.swift`        | `features/notes/inbox.ts` (네이티브는 나중)                       | A    | P1   |
| AI 연결(MCP)          | `server/mcp/tools.ts`, `server/oauth/`                          | 서버 단계(NestJS) 이후                                            | B    | P1+  |

## 2. 구조 원칙 (그쪽 `.claude/project-profile/index.md`에서)

우리 `AGENTS.md`와 겹치지 않는 것만 골랐어요. 받아들이면 `AGENTS.md`에 옮겨요.

1. **핵심 로직은 프레임워크 밖에.** 대조·규칙·변환은 React·Supabase·Deno를 모르는 순수 TS로 두고 Vitest로 바로 검사해요. 화면과 Edge Function은 그 함수를 부르기만 해요.
2. **외부 API는 인터페이스로 받기.** `CalendarApi` 같은 인터페이스를 두고, 테스트에서는 메모리로 흉내 낸 `FakeCalendar`를 넣어요. 진짜 구글을 부르지 않고 실패·중복·대량 삭제를 다 시험할 수 있어요.
3. **규칙은 함수 하나.** "이 카드는 캘린더에 올라가나" 같은 판단을 화면·동기화·AI 도구가 각자 하지 않고 `packages/shared`의 함수 하나를 같이 써요.
4. **조용히 실패하지 않기.** 실패하면 화면에 이유와 다시 시도 수단을 둬요. 저장은 성공했는데 캘린더 반영이 실패하면 "캘린더 반영 실패 · 다시 시도"처럼 따로 보여 줘요.
5. **날짜만 있는 값은 `YYYY-MM-DD` 문자열로 계산.** `new Date('2026-10-10')`은 UTC 자정으로 읽혀 한국에서 하루 밀려요.
6. **조용히 덮지 않기.** 서버 내용이 내가 읽은 뒤 바뀌었으면 저장을 거절하고, 어느 쪽을 남길지 사람이 골라요.

## 3. 스켈레톤

아래 코드는 그쪽 코드를 우리 타입(`Card`, `Document` 등)과 스택에 맞게 줄인 출발점이에요. 그대로 붙여도 되지만, 기능 PR에서 테스트와 함께 다듬어요.

### 3.1 날짜 계산 — `packages/shared/src/utils/date.ts`

그쪽은 KST 고정이지만, 우리는 IANA 시간대를 따로 저장하니(`docs/conventions.md`) 시간대를 인자로 받아요.

```ts
/** `YYYY-MM-DD` 이고 실제로 있는 날인가 (2026-02-30 거부) */
export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 날짜에 n일을 더한다. 시간대와 무관하게 날짜만 계산한다 */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = 일요일 */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** UTC 시각 → 그 시간대의 날짜. 예: ('2026-10-09T16:00:00Z', 'Asia/Seoul') → '2026-10-10' */
export function dayIn(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(iso));
}

/** 그 시간대의 오늘 */
export function todayIn(timezone: string): string {
  return dayIn(new Date().toISOString(), timezone);
}
```

테스트에 꼭 넣을 것: 월말·윤년 `addDays`, `2026-02-30` 거부, 한국 자정 직후 `dayIn`.

### 3.2 일정 여부 규칙 — `packages/shared/src/rules/schedule.ts`

그쪽 `isScheduled`(날짜 있는 미완료 할 일만 일정)를 우리 카드에 맞춘 것. 캘린더 화면·시간 잡기·구글 대조가 모두 이 함수만 써요.

```ts
import type { Card } from '../types';

/** 구글 캘린더에 올라가는 카드: 사용자가 확인했고, 시각이 정해진 일정·할 일 */
export function isScheduled(card: Card): card is Card & { startAt: string } {
  if (card.status !== 'confirmed') return false;
  if (card.type === 'event') return !!card.startAt;
  if (card.type === 'task') return !!card.startAt; // 시간 잡기로 자리를 잡은 할 일만. dueAt만 있으면 일정 아님
  return false;
}
```

카드 규칙이 바뀌면 이 파일과 `test/`만 고쳐요. 화면 코드에서 `card.status === 'confirmed' && ...`를 다시 쓰지 않아요.

### 3.3 도메인 오류 — `packages/shared/src/errors.ts` + Edge Function 감싸개

순수 로직은 HTTP를 모르고 `AppError`만 던져요. HTTP 상태로 바꾸는 건 감싸개 한 곳에서 해요.

```ts
// packages/shared/src/errors.ts
export type AppErrorCode =
  'bad_request' | 'unauthorized' | 'not_found' | 'conflict' | 'too_large' | 'upstream';

const STATUS: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 409,
  too_large: 413,
  upstream: 502,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: AppErrorCode,
    message: string, // 화면에 그대로 보여 줄 한국어 문장
    readonly extra: Record<string, string> = {}, // 409의 현재 version처럼 화면이 쓸 값
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
```

```ts
// supabase/functions/_shared/handler.ts (Deno)
import { AppError } from '../../../packages/shared/src/errors.ts';

export function defineHandler(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      return Response.json(await handler(req));
    } catch (error) {
      if (error instanceof AppError) {
        return Response.json(
          { code: error.code, message: error.message, ...error.extra },
          { status: error.status },
        );
      }
      console.error(error);
      return Response.json(
        { code: 'internal', message: '서버에서 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.' },
        { status: 500 },
      );
    }
  };
}
```

`packages/shared`를 Deno에서 import하는 방법(상대 경로 / import map)은 첫 함수 PR에서 정하고 결정 기록으로 남겨요.

### 3.4 충돌 감지 — `version` 컬럼

그쪽은 파일 내용 해시를 `baseVersion`으로 비교해요. 우리는 테이블에 정수 `version`을 두고 같은 일을 해요.

```sql
-- 마이그레이션 예: 문서 테이블에 version 추가
alter table public.docs_documents add column version integer not null default 1;

create or replace function public.bump_version() returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

create trigger docs_documents_bump_version
  before update on public.docs_documents
  for each row execute function public.bump_version();
```

```ts
// features/<기능>/data.ts — 읽을 때 받은 version과 같을 때만 고친다 (#10 이후 화면은 data.ts로만 데이터를 다뤄요)
import { AppError } from '@noteapp/shared';
import { getSupabase } from '@/lib/supabase';

export async function updateDocument(
  id: string,
  baseVersion: number,
  patch: { title: string; body: string },
) {
  const { data, error } = await getSupabase()
    .from('docs_documents')
    .update(patch)
    .eq('id', id)
    .eq('version', baseVersion)
    .select('version')
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new AppError('conflict', '다른 곳에서 먼저 고쳤어요. 최신 내용을 불러올지 골라 주세요.');
  return data.version as number;
}
```

그쪽에서 배운 점: 체크 표시처럼 **본문과 따로 바뀌는 값은 버전 비교에서 뺐어요.** 목록에서 완료를 눌렀다고 열려 있는 편집기 저장이 막히면 안 되기 때문이에요. 우리도 카드 상태처럼 따로 바뀌는 값은 별도 컬럼·별도 갱신 함수로 두고 `version`을 올리지 않아요(트리거에서 해당 컬럼만 바뀐 경우 건너뛰기).

### 3.5 쓰던 내용 보호 — `apps/mobile/lib/drafts.ts`

저장 요청을 보내기 **전에** 기기에 적고, 서버가 받으면 지워요. 앱이 꺼지거나 연결이 끊겨도 마지막 입력이 남아요. 그쪽 `localStorage`를 `AsyncStorage`로 바꿨어요.

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'draft:';

export interface Draft {
  id: string;
  /** 이 수정이 기준으로 삼은 서버 version. 서버가 그 뒤 바뀌었으면 자동으로 덮지 않는다 */
  baseVersion: number;
  input: { title: string; body: string };
  savedAt: string;
  /** 서버가 409로 거절했다 — 사람이 고를 때까지 자동 저장하지 않는다 */
  conflict?: boolean;
}

export async function writeDraft(draft: Draft) {
  try {
    await AsyncStorage.setItem(PREFIX + draft.id, JSON.stringify(draft));
    return true;
  } catch {
    return false; // 보관은 덤이다. 원본은 언제나 서버
  }
}

export async function readDraft(id: string): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export async function removeDraft(id: string) {
  await AsyncStorage.removeItem(PREFIX + id).catch(() => {});
}

export async function listDrafts(): Promise<Draft[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
  const drafts = await Promise.all(keys.map((k) => readDraft(k.slice(PREFIX.length))));
  return drafts.filter((d): d is Draft => d !== null);
}
```

보관함 비우기(그쪽 `memo-drafts.client.ts`): 앱이 뜰 때, `AppState`가 `active`로 돌아올 때, 보관된 게 있으면 1분마다 `listDrafts()`를 돌며 저장해요.

- 열려 있는 문서는 그 화면의 자동저장이 맡으니 건너뛰어요.
- 409면 `conflict: true`로 표시만 하고 남겨요. 그 문서를 열면 "이 기기에 저장하지 못한 수정이 있어요 → [버리기] [덮어쓰기]"를 물어요.
- 네트워크 오류·401이면 나머지도 안 되니 멈추고 다음 기회에 해요.
- 저장한 개수만큼 "보관해 둔 수정 n개를 저장했어요" 토스트.

### 3.6 한 번에 하나만 실행 — `packages/shared/src/utils/singleFlight.ts`

그쪽 `CalendarSync.run`의 방식: 도는 중에 또 부르면, 끝난 뒤 **한 번만** 더 돌아요. 동기화·보관함 비우기·목록 새로고침에 같이 써요.

```ts
export function singleFlight(task: () => Promise<void>) {
  let active: Promise<void> | null = null;
  let queued: Promise<void> | null = null;

  return function run(): Promise<void> {
    if (!active) {
      active = task().finally(() => {
        active = null;
      });
      return active;
    }
    queued ??= active.then(() => {
      queued = null;
      return run();
    });
    return queued;
  };
}
```

### 3.7 구글 캘린더 대조 — `packages/calendar-sync/` (담당 C)

그쪽에서 가장 많이 가져올 부분이에요. 원본 `server/calendar/reconcile.ts`(151줄)와 테스트를 거의 그대로 옮기고, 아래만 바꿔요.

| 그쪽                                | 우리                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| 서비스 계정 하나, 전용 캘린더 하나  | 사용자마다 OAuth 토큰, 사용자가 고른 캘린더 하나 (토큰은 Edge Function에서만)         |
| 메모 → 캘린더, 종일 일정만          | 확인한 카드 → 캘린더, 시각 일정도 있음(`startAt`/`endAt` + IANA 시간대)               |
| `extendedProperties.private.memoId` | `extendedProperties.private.noteappCardId`                                            |
| 5분 타이머 + 저장 직후              | 저장 직후(앱이 함수 호출) + 앱 열 때. 서버 타이머는 Supabase cron 도입 때             |
| 실패 기록은 서버 메모리             | `calendar_sync_status` 테이블 (Edge Function은 요청마다 새로 떠서 메모리가 남지 않음) |

```ts
// packages/calendar-sync/src/api.ts — 외부 API는 이 인터페이스로만
export interface GoogleEventTime {
  date?: string | null; // 종일
  dateTime?: string | null; // 시각
  timeZone?: string | null;
}

export interface GoogleEvent {
  id: string;
  summary?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  extendedProperties?: { private?: Record<string, string> };
}

export type EventWrite = Omit<GoogleEvent, 'id'> & { transparency?: 'opaque' | 'transparent' };

export interface CalendarApi {
  /** 우리 앱이 만든 일정만 (privateExtendedProperty 필터) */
  list(): Promise<GoogleEvent[]>;
  insert(body: EventWrite): Promise<GoogleEvent>;
  patch(eventId: string, body: EventWrite): Promise<GoogleEvent>;
  /** 이미 지워진 일정(404·410)은 성공으로 본다 */
  remove(eventId: string): Promise<void>;
}
```

```ts
// packages/calendar-sync/src/reconcile.ts — 순수 함수. 무엇을 할지만 정한다
import type { Card } from '@noteapp/shared';
import type { EventWrite, GoogleEvent } from './api';

/** 🔴 한 번에 이 수 이하는 늘 지운다. 넘고, 기존의 절반도 넘으면 사람에게 확인받는다 */
export const MASS_DELETE_FREE = 3;
const KEY = 'noteappCardId';

export type SyncOp =
  | { kind: 'create'; cardId: string; body: EventWrite }
  | { kind: 'update'; cardId: string; eventId: string; body: EventWrite }
  | { kind: 'delete'; cardId: string; eventId: string; reason: 'orphan' | 'duplicate' };

export interface HeldDeletes {
  reason: 'empty' | 'many';
  deletes: number;
  existing: number;
}

export interface PlanInput {
  cards: (Card & { startAt: string })[]; // isScheduled를 통과한 카드
  /** 사용자의 카드 전체 수. 0이면 데이터를 못 읽은 것으로 보고 지우지 않는다 */
  total: number;
  events: GoogleEvent[];
  timezone: string;
  allowMassDelete?: boolean; // 사람이 화면에서 「그래도 지우기」를 눌렀다
}

export function planSync({ cards, total, events, timezone, allowMassDelete = false }: PlanInput) {
  const byCard = new Map<string, GoogleEvent[]>();
  for (const e of events) {
    const id = e.extendedProperties?.private?.[KEY];
    if (id) byCard.set(id, [...(byCard.get(id) ?? []), e]);
  }

  const ops: SyncOp[] = [];
  for (const card of cards) {
    const linked = byCard.get(card.id) ?? [];
    const want = eventFor(card, timezone);
    if (!linked.length) {
      ops.push({ kind: 'create', cardId: card.id, body: { ...want, transparency: 'opaque' } });
      continue;
    }
    // 같은 카드의 일정이 둘 이상이면(생성 응답을 놓친 재시도) 맞는 것 하나만 남긴다
    const keep = linked.find((e) => sameShape(e, want)) ?? linked[0]!;
    if (!sameShape(keep, want))
      ops.push({ kind: 'update', cardId: card.id, eventId: keep.id, body: want });
    for (const extra of linked) {
      if (extra !== keep)
        ops.push({ kind: 'delete', cardId: card.id, eventId: extra.id, reason: 'duplicate' });
    }
  }

  const wanted = new Set(cards.map((c) => c.id));
  const orphans: SyncOp[] = [];
  for (const [cardId, linked] of byCard) {
    if (wanted.has(cardId)) continue;
    for (const e of linked)
      orphans.push({ kind: 'delete', cardId, eventId: e.id, reason: 'orphan' });
  }

  const existing = byCard.size;
  const deletes = orphans.length;
  const held: HeldDeletes | null =
    allowMassDelete || deletes === 0
      ? null
      : total === 0
        ? { reason: 'empty', deletes, existing }
        : deletes > MASS_DELETE_FREE && deletes > existing / 2
          ? { reason: 'many', deletes, existing }
          : null;

  return { ops: held ? ops : [...ops, ...orphans], held };
}

/** 카드 → 구글 일정 모양. 종일이면 end.date는 끝 날짜 «다음 날» (구글 규칙) */
export function eventFor(card: Card & { startAt: string }, timezone: string): EventWrite {
  return {
    summary: card.title,
    start: { dateTime: card.startAt, timeZone: timezone, date: null },
    end: { dateTime: card.endAt ?? card.startAt, timeZone: timezone, date: null },
    extendedProperties: { private: { [KEY]: card.id } },
  };
}

function sameShape(e: GoogleEvent, want: EventWrite) {
  return (
    e.summary === want.summary &&
    sameInstant(e.start?.dateTime, want.start?.dateTime) &&
    sameInstant(e.end?.dateTime, want.end?.dateTime)
  );
}

function sameInstant(a?: string | null, b?: string | null) {
  return !!a && !!b && Date.parse(a) === Date.parse(b);
}
```

```ts
// packages/calendar-sync/test/reconcile.test.ts — 진짜 구글 없이 시험 (그쪽 FakeCalendar 방식)
import { describe, expect, it } from 'vitest';
import { planSync } from '../src/reconcile';

describe('planSync', () => {
  it('일정이 없는 확인 카드는 만든다', () => {
    /* cards 1개, events [] → ops[0].kind === 'create' */
  });
  it('같은 카드의 일정이 둘이면 하나를 지운다', () => {});
  it('우리 키가 없는 일정은 건드리지 않는다', () => {});
  it('4건 이상이고 절반을 넘는 삭제는 보류한다', () => {});
  it('카드 전체가 0개면 삭제를 보류한다', () => {});
});
```

함수 쪽(`supabase/functions/google-calendar/index.ts`)은 얇게: 로그인 사용자 확인 → 그 사용자의 구글 토큰 꺼내기 → `CalendarApi` 만들기 → 카드 읽기 → `planSync` → 실행 → 실패 기록 저장 → 결과 응답.

그쪽에서 겪은 것 중 그대로 지킬 것:

- 🔴 개발과 운영이 같은 캘린더를 쓰면 서로의 일정을 "주인 없는 일정"으로 보고 지워요. 로컬·stage는 테스트용 구글 계정·캘린더만 써요.
- 🔴 종일 일정의 `end.date`는 끝 날짜를 포함하지 않아요. 보낼 때 `+1일`, 읽을 때 `-1일`.
- 구글에서 사람이 바꾼 색·알림은 건드리지 않아요. 비교는 제목·시작·끝만 해요.
- 실패해도 카드 저장은 성공으로 두고, 카드 옆에 "캘린더 반영 실패 · 다시 시도"를 보여 줘요.
- 실제 구글로 시험하는 스크립트는 캘린더에 이미 우리 일정이 있으면 멈추게 해요(그쪽 `scripts/calendar-smoke/`).

### 3.8 수정 이력 — `docs_revisions` (담당 A)

그쪽 규칙: 고치기 전 내용을 보관, 연속 자동저장은 5분 단위로 묶음, 문서마다 30일·50개까지, 복원 직전 상태도 보관.

```sql
create table public.docs_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.docs_documents (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  title text not null,
  body text not null,
  saved_at timestamptz not null default now()
);
alter table public.docs_revisions enable row level security;
create policy "본인 이력만" on public.docs_revisions
  for select using (user_id = auth.uid());

-- 고치기 직전 내용을 보관한다. 마지막 보관이 5분 안이면 건너뛴다(자동저장 묶음)
create or replace function public.docs_keep_revision() returns trigger language plpgsql security definer as $$
begin
  if old.title is distinct from new.title or old.body is distinct from new.body then
    if not exists (
      select 1 from public.docs_revisions
      where document_id = old.id and saved_at > now() - interval '5 minutes'
    ) then
      insert into public.docs_revisions (document_id, user_id, title, body)
      values (old.id, old.user_id, old.title, old.body);
    end if;
  end if;
  return new;
end $$;

create trigger docs_documents_keep_revision
  before update on public.docs_documents
  for each row execute function public.docs_keep_revision();
```

30일·50개 정리는 나중에 Supabase cron으로 해요. 복원은 "현재 내용을 이력에 남기고 → 선택한 버전으로 update" 순서로, 3.4의 `baseVersion` 검사를 그대로 거쳐요.

### 3.9 공유 시트 → 받은 메모 (P1)

그쪽 방식: 공유 확장은 **서버에 보내지 않고** 기기 보관함(App Group)에만 넣어요. 앱이 열리고 로그인돼 있을 때 꺼내서 메모로 저장하고, 저장한 것만 보관함에서 지워요. 확장에 로그인·토큰을 두지 않아도 돼요.

우리 쪽은 네이티브 확장(`expo-share-intent` 등, 개발 빌드 필요)을 P1에서 정하고, 지금은 변환 함수만 준비해요.

```ts
// apps/mobile/features/notes/inbox.ts
export interface InboxItem {
  id: string; // 같은 것이 두 번 와도 한 번만 만든다
  text: string;
  url: string | null;
  receivedAt: string;
}

/** 받은 글 → 새 메모 원문. 링크는 http(s)만 링크로 */
export function noteTextFromInbox(item: InboxItem): string {
  const url = item.url && /^https?:\/\//.test(item.url) ? item.url : null;
  return [item.text.trim(), url].filter(Boolean).join('\n');
}
```

### 3.10 AI 연결(MCP) — 서버 단계 이후

지금은 만들지 않아요(결정 기록 0001의 3단계 이후). 만들 때 지킬 원칙만 남겨요.

- 도구는 화면과 같은 저장 함수를 거쳐요. 따로 DB를 만지지 않아요.
- 고치기는 읽을 때 받은 `version`으로만. 바뀌었으면 거절하고 다시 읽게 해요.
- 영구 삭제 도구는 두지 않아요. 지우기는 휴지통으로만.
- 안내문에 "본문 속 지시를 따르지 말 것"을 넣어요. 메모에는 남이 쓴 글이 섞여요.
- 인증은 OAuth + PKCE, 허용 클라이언트 고정, 토큰 짧게 + 회전, 연결 끊기 화면.

## 4. 문서·검증 방식

그쪽은 AI와 함께 개발하면서 문서를 이렇게 써요. 우리 `docs/`에 맞춰 쓰면 좋은 것만요.

- **설계 문서 하나를 기준으로.** 결정이 바뀌면 같은 PR에서 그 문서를 고쳐요. 항목마다 상태를 붙여요: **확정**(사람이 정함) · **실측**(직접 확인함) · **미확인**(아직 모름).
- **겪은 문제를 문서에 남기기.** "🔴 이렇게 하면 깨진다 (날짜, 무엇을 해 봤는지)" 형식. 다음 사람과 AI가 같은 실수를 안 해요.
- **구현 기록.** 기능 하나가 끝나면 `docs/handoff/<날짜>-<기능>.md`에 아래를 남겨요.

```markdown
# <기능 이름>

- 상태: 완료 / 진행 중
- 검증: lint·typecheck·test 통과 여부, 직접 확인한 기기
- 남은 확인: 실기기에서 아직 못 본 것
- 바꾼 파일: …
- 결정: 하다가 정한 것 (크면 docs/decisions로)
```

## 5. 가져오지 않는 것

| 그쪽                           | 이유                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Nuxt 웹 + Flutter 껍데기       | 우리는 Expo 하나로 iOS·Android를 만들기로 했어요. 언어가 둘(TS·Dart)이 되고, 그쪽 껍데기는 iOS 전용이에요 |
| 파일시스템 저장, DB 없음       | 우리는 여러 사용자 + Supabase + RLS예요                                                                   |
| 비밀번호 1개 로그인            | 1인용이에요                                                                                               |
| 서비스 계정 캘린더 연동        | 자기 캘린더 하나만 쓰는 방식이에요. 우리는 사용자마다 OAuth                                               |
| 집 서버 + Cloudflare 터널 배포 | 우리는 Supabase + EAS                                                                                     |

## 6. 적용 순서

1. **M0**: 이 문서 리뷰 → 2장 원칙 중 받아들일 것을 `AGENTS.md`로. `date.ts`(3.1)를 `packages/shared`에 추가.
2. **M1**: `schedule.ts`(3.2)를 카드·캘린더 화면이 같이 씀. `packages/calendar-sync`에 `reconcile.ts` + 테스트를 먼저 옮김(구글 없이 돌아감).
3. **M2**: 테이블을 만들 때 `version`(3.4)과 오류 감싸개(3.3)를 같이. 편집기에 쓰던 내용 보호(3.5).
4. **M3**: `google-calendar` 함수에 대조(3.7) 연결, 수정 이력(3.8).
5. **P1 이후**: 공유 시트(3.9), AI 연결(3.10).
