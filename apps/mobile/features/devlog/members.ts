// 팀원 목록. M2에는 로그인(D)의 profiles에서 가져와요.
export type Role = 'A' | 'B' | 'C' | 'D';

export interface Member {
  role: Role;
  name: string;
  area: string;
  /** GitHub 아이디. 그 주 PR·이슈를 불러올 때 써요. */
  github: string;
}

export const members: Member[] = [
  { role: 'A', name: '민성', area: '기록·문서', github: 'kfd0209' },
  { role: 'B', name: '준호', area: 'AI·카드', github: 'redchoeng' },
  { role: 'C', name: '재민', area: '캘린더', github: 'jaemin743' },
  { role: 'D', name: '서현', area: '기반·PM', github: 'YoonDiding' },
];

export const memberOf = (role: Role) => members.find((m) => m.role === role)!;
