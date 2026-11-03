// 팀 레포의 PR·이슈를 GitHub API로 불러와요. 레포가 공개라 키 없이 돼요(시간당 60번).
// TODO(B): 레포를 비공개로 바꾸면 GitHub 토큰을 lib/secrets에 두고 Authorization을 붙여요.

export const REPO = 'Customizable-calendar/Plan';
const API = 'https://api.github.com';

export interface WorkItem {
  kind: 'pr' | 'issue';
  number: number;
  title: string;
  body: string;
  /** "열림" | "닫힘" | "머지됨" */
  state: string;
  url: string;
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  } catch {
    throw new Error('GitHub에 연결하지 못했어요. 인터넷을 확인해 주세요.');
  }
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub 조회 한도(시간당 60번)를 넘었어요. 잠시 뒤에 다시 해 주세요.');
  }
  if (!res.ok) throw new Error(`GitHub 오류 (${res.status})`);
  return (await res.json()) as T;
}

interface SearchItem {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  pull_request?: { merged_at: string | null };
}

/** since(한국 시간 그날 0시) 이후 그 사람이 올리거나 맡은 PR·이슈. 최근 바뀐 순. */
export async function fetchWork(login: string, since: string): Promise<WorkItem[]> {
  const q = `repo:${REPO} involves:${login} updated:>=${since}T00:00:00+09:00`;
  const data = await get<{ items: SearchItem[] }>(
    `/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=30`,
  );
  return data.items.map((it) => ({
    kind: it.pull_request ? 'pr' : 'issue',
    number: it.number,
    title: it.title,
    body: it.body ?? '',
    state: it.pull_request?.merged_at ? '머지됨' : it.state === 'open' ? '열림' : '닫힘',
    url: it.html_url,
  }));
}

/** PR에서 바뀐 파일 "경로 (+추가 -삭제)". AI가 코드 읽는 순서를 쓸 때 봐요. */
export async function fetchPrFiles(number: number): Promise<string[]> {
  const files = await get<{ filename: string; additions: number; deletions: number }[]>(
    `/repos/${REPO}/pulls/${number}/files?per_page=100`,
  );
  return files.map((f) => `${f.filename} (+${f.additions} -${f.deletions})`);
}
