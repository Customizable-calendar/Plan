import type { WorkItem } from './github';
import type { Member } from './members';
import { STUDY_TITLE } from './parse';
import { weekLabel } from './week';

// 팀 공통 템플릿과 AI에게 보낼 문장이에요.
// 섹션 제목을 바꾸면 parse.ts와 화면도 같이 확인해요.

export const TEMPLATE = `## 만든 것
- 기능 한 줄 설명 (PR 번호)

## 배운 개념
- 개념 이름: 2~3문장 설명. 우리 코드 어디에 쓰였는지

## 코드 읽는 순서
1. 파일 경로: 여기서 무엇을 보면 되는지

## 막힌 곳과 해결
- 문제 → 원인 → 해결

## ${STUDY_TITLE}
Q. 팀원에게 낼 질문 (3개)
A. 답

## 다음 주 할 것
- 할 일`;

/** 앱 안 AI의 역할. 대화 내내 같아요. */
export const DEVLOG_SYSTEM = `너는 4명이 함께 만드는 AI 메모 앱(Expo + Supabase) 팀의 개발일지 정리 도우미야.
팀원이 고른 GitHub PR·이슈와 짧은 메모를 받아, 주간 회의에서 같이 공부할 개발일지를 아래 템플릿 그대로 채워.

${TEMPLATE}

- 처음 보는 팀원도 이해하게 쉬운 한국어로 써.
- 받은 PR·이슈 본문, 바뀐 파일 목록, 팀원 메모에 있는 내용만 써. 없는 건 지어내지 말고, 채울 게 없는 섹션은 "- 없음"으로 둬.
- "배운 개념"은 팀원이 적은 배운 점을 중심으로 풀어 써. 메모가 짧아도 PR 내용과 이어서 설명해.
- "코드 읽는 순서"는 바뀐 파일 목록에 있는 경로만 써.
- "${STUDY_TITLE}"은 Q./A. 줄로 3개. 회의에서 다른 팀원에게 물어볼 만한 것으로.
- 답은 항상 템플릿 전체 마크다운만 보내. 앞뒤 인사나 설명은 쓰지 마.
- 고쳐 달라는 말을 받으면 고친 일지 전체를 다시 보내.`;

export interface PickedWork {
  item: WorkItem;
  /** PR에서 바뀐 파일. 못 불러오면 비어 있어요. */
  files: string[];
  /** 팀원이 이 PR·이슈에 적은 배운 점 */
  note: string;
}

/** 처음 채워 달라고 할 때 보내는 문장 */
export function devlogRequest(
  member: Member,
  week: string,
  picked: PickedWork[],
  note: string,
): string {
  const items = picked.map(({ item, files, note: itemNote }) =>
    [
      `### ${item.kind === 'pr' ? 'PR' : '이슈'} #${item.number} ${item.title} (${item.state})`,
      item.body.trim() ? `본문:\n${item.body.trim()}` : '본문: 없음',
      files.length ? `바뀐 파일:\n${files.map((f) => `- ${f}`).join('\n')}` : '',
      itemNote.trim() ? `내가 적은 배운 점: ${itemNote.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  return [
    `${weekLabel(week)} ${member.role} 담당(${member.area}) ${member.name}의 개발일지를 채워줘.`,
    picked.length ? `## 이번 주 PR·이슈\n\n${items.join('\n\n')}` : '고른 PR·이슈는 없어.',
    note.trim() ? `## 내 메모\n${note.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** 고쳐 달라고 할 때. 사람이 초안을 직접 고쳤으면 그 내용을 같이 보내요. */
export function reviseRequest(ask: string, editedDraft?: string): string {
  return editedDraft
    ? `내가 직접 고친 지금 일지야:\n\n${editedDraft}\n\n여기서 이렇게 고쳐줘: ${ask}`
    : ask;
}

/** 앱에 키가 없을 때: 각자 쓰는 코딩 AI(Claude Code, Codex 등)에 붙여 넣을 부탁 문장 */
export function devlogPrompt(member: Member, week: string): string {
  return `이번 주(${weekLabel(week)}) 내가 이 레포에서 개발한 내용을 팀 스터디용 개발일지로 정리해줘.

나는 ${member.role} 담당(${member.area}) ${member.name}이야.
git log --since=${week} --author=${member.github}와 내가 올린 PR(gh pr list --author ${member.github} --state all)을 직접 보고 써.
처음 보는 팀원도 이해하게 쉬운 말로 쓰고, 실제 코드에 없는 내용은 쓰지 마.
아래 형식의 마크다운만 답해줘. 제목 줄(##)은 그대로 써.

${TEMPLATE}`;
}
