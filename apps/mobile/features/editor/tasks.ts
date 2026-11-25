// 할 일 표 위젯의 글 모양. 본문(마크다운) 안에 이렇게 적고, 미리보기는 표로 그려요.
//
//   ```할일
//   국어 | 비문학 3지문 | 60 | 55 | O
//   수학 | 미적분 문제 20개 | 90 |  |
//   ```
//
// 한 줄이 할 일 하나: 과목 | 할 일 | 예상 분 | 실제 분 | 결과(O, △, X, 비움)
// 글로 저장해서 동기화, 되돌리기, 내보내기가 그대로 되고, 편집 화면에서도 읽을 수 있어요. 화면 없이 쓰는 순수 함수예요.

export const TASKS_OPEN = '```할일';
export const FENCE_CLOSE = '```';

export type TaskResult = 'O' | '△' | 'X' | '';

export interface TaskRow {
  /** 본문의 몇 번째 줄인지 */
  line: number;
  subject: string;
  task: string;
  /** 예상 분, 실제 분. 숫자가 아니면 그대로 글로 둬요. */
  plan: string;
  actual: string;
  result: TaskResult;
}

const RESULTS: TaskResult[] = ['O', '△', 'X'];

/** 표 한 줄 글을 칸으로 나눠요. 칸이 모자라면 빈칸으로 채워요. */
export function parseTaskLine(text: string, line: number): TaskRow {
  const [subject = '', task = '', plan = '', actual = '', result = ''] = text
    .split('|')
    .map((cell) => cell.trim());
  const r = result.toUpperCase();
  return {
    line,
    subject,
    task,
    plan,
    actual,
    result: (RESULTS as string[]).includes(r) ? (r as TaskResult) : r === 'Δ' ? '△' : '',
  };
}

/** 칸들을 표 한 줄 글로 써요. '|'는 칸을 나누는 글자라 칸 안에서는 빼요. */
export function taskLine(row: Omit<TaskRow, 'line'>): string {
  const clean = (s: string) => s.replace(/\|/g, '/').trim();
  return [row.subject, row.task, row.plan, row.actual, row.result].map(clean).join(' | ');
}

/** 결과를 누를 때마다 O, △, X, 비움 순서로 바꿔요. */
export function nextResult(result: TaskResult): TaskResult {
  if (result === '') return 'O';
  const i = RESULTS.indexOf(result);
  return i === RESULTS.length - 1 ? '' : RESULTS[i + 1];
}

export interface TaskSummary {
  done: number;
  partly: number;
  missed: number;
  /** 결과를 적은 할 일 중 O의 비율(%). 적은 게 없으면 null */
  rate: number | null;
  planMinutes: number;
  actualMinutes: number;
}

/** 표 아래 한 줄 결산. 분은 숫자만 더해요. */
export function summarize(rows: TaskRow[]): TaskSummary {
  const count = (r: TaskResult) => rows.filter((row) => row.result === r).length;
  const minutes = (key: 'plan' | 'actual') =>
    rows.reduce((sum, row) => sum + (Number.parseInt(row[key], 10) || 0), 0);
  const done = count('O');
  const judged = done + count('△') + count('X');
  return {
    done,
    partly: count('△'),
    missed: count('X'),
    rate: judged ? Math.round((done / judged) * 100) : null,
    planMinutes: minutes('plan'),
    actualMinutes: minutes('actual'),
  };
}
