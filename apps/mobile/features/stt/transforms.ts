import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type SttTransform,
  type SttTransformRow,
  toSttTransform,
  toSttTransformInsert,
} from '@noteapp/shared';

import { localFirstTable } from '@/lib/local-first';

// 받아쓴 글에 쓰는 지시문(Whispering의 transformation 참고). (담당: B)
// - 기본 지시문(STARTERS)은 앱에 들어 있어요. 고치거나 지울 수 없어요.
// - 내 지시문은 메모와 같은 방식으로 저장해요(테이블: stt_transforms, lib/local-first.ts).
//   계정 연결은 'stt' 기능을 따라가요(EXPO_PUBLIC_SUPABASE_FEATURES에 stt가 있으면 계정에도 저장).
// - 받아쓰기가 끝나면 자동으로 돌릴 지시문 하나는 이 기기에만 기억해요(AUTO_KEY).

const table = localFirstTable<SttTransform>({
  feature: 'stt',
  table: 'stt_transforms',
  toRow: toSttTransformInsert,
  fromRow: (row) => toSttTransform(row as SttTransformRow),
});

const STARTER_TIME = '2026-11-18T00:00:00.000Z';
const starter = (id: string, title: string, instructions: string, order: number): SttTransform => ({
  id: `starter:${id}`,
  title,
  instructions,
  order,
  createdAt: STARTER_TIME,
  updatedAt: STARTER_TIME,
});

export const STARTERS: readonly SttTransform[] = [
  starter(
    'polish',
    '받아쓴 글 다듬기',
    '음성 인식으로 받아쓴 글이야. 잘못 알아들은 글자, 띄어쓰기, 문장 부호만 고쳐서 원래 말한 내용 그대로 다시 써 줘. 앞뒤 문맥으로 확실한 것만 고치고, 모르는 부분은 그대로 둬. 내용을 요약하거나 빼거나 더하지 마. "(잘 안 들린 말)"은 그대로 둬.',
    -1,
  ),
  starter(
    'minutes',
    '회의록으로 정리',
    '받아쓴 회의를 회의록으로 정리해 줘. "안건", "결정한 것", "할 일(누가, 언제까지)" 순서로 나누고, 항목마다 "- "로 시작해. 원문에 없는 내용은 넣지 마.',
    0,
  ),
  starter(
    'todos',
    '할 일만 뽑기',
    '받아쓴 글에서 누가 하기로 한 일만 뽑아 줘. 한 줄에 하나씩 "- [ ] 할 일 (누가, 언제까지)" 모양으로 써. 사람이나 마감을 모르면 빼고 써. 할 일이 없으면 "할 일이 없어요."라고만 써.',
    1,
  ),
  starter(
    'email',
    '공유 메일 초안',
    '받아쓴 회의 내용을 참석하지 못한 팀원에게 보낼 짧은 메일로 써 줘. 제목 한 줄, 인사, 핵심 3~5줄, 할 일, 끝인사 순서야. 존댓말로 써.',
    2,
  ),
];

export const isStarter = (t: SttTransform) => t.id.startsWith('starter:');

/** 기본 지시문 다음에 내 지시문, 순서대로. */
export async function listTransforms(): Promise<SttTransform[]> {
  const mine = (await table.list()).sort((a, b) => a.order - b.order);
  return [...STARTERS, ...mine];
}

/** 내 지시문을 만들어요. */
export async function createTransform(input: {
  title: string;
  instructions: string;
}): Promise<SttTransform> {
  const title = input.title.trim().slice(0, 40);
  const instructions = input.instructions.trim().slice(0, 4000);
  if (!title || !instructions) throw new Error('이름과 지시문을 둘 다 적어 주세요.');
  const mine = await table.list();
  const now = new Date().toISOString();
  const transform: SttTransform = {
    id: `stt-transform-${Date.now()}`,
    title,
    instructions,
    order: mine.reduce((max, t) => Math.max(max, t.order + 1), 0),
    createdAt: now,
    updatedAt: now,
  };
  await table.put([transform]);
  return transform;
}

/** 내 지시문을 지워요. 자동으로 돌리던 거면 자동도 꺼요. */
export async function removeTransform(id: string): Promise<void> {
  if (id.startsWith('starter:')) return;
  await table.remove([id]);
  if ((await autoTransformId()) === id) await setAutoTransformId(null);
}

const AUTO_KEY = 'stt.autoTransform';

/** 받아쓰기가 끝나면 자동으로 돌릴 지시문 id. 없으면 null */
export async function autoTransformId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTO_KEY);
  } catch {
    return null;
  }
}

export async function setAutoTransformId(id: string | null): Promise<void> {
  try {
    if (id) await AsyncStorage.setItem(AUTO_KEY, id);
    else await AsyncStorage.removeItem(AUTO_KEY);
  } catch {
    // 기억 못 해도 다음에 다시 고르면 돼요.
  }
}
