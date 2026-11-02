import type { Member } from './members';
import { STUDY_TITLE } from './parse';
import { weekLabel } from './week';

// 각자 쓰는 코딩 AI(Claude Code, Codex 등)에 그대로 붙여 넣을 부탁 문장이에요.
// AI는 레포를 직접 볼 수 있으니 git 기록과 PR을 보고 정리하게 해요.
// 섹션 제목을 바꾸면 parse.ts와 화면도 같이 확인해요.

export function devlogPrompt(member: Member, week: string): string {
  const [y, m, d] = week.split('-').map(Number);
  const since = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return `이번 주(${weekLabel(week)}) 내가 이 레포에서 개발한 내용을 팀 스터디용 개발일지로 정리해줘.

나는 ${member.role} 담당(${member.area}) ${member.name}이야.
git log --since=${since} --author=<내 GitHub 아이디>와 내가 올린 PR(gh pr list --author @me --state all)을 직접 보고 써.
처음 보는 팀원도 이해하게 쉬운 말로 쓰고, 실제 코드에 없는 내용은 쓰지 마.
아래 형식의 마크다운만 답해줘. 제목 줄(##)은 그대로 써.

## 만든 것
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
}
