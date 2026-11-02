// 팀원 목록. M2에는 로그인(D)의 profiles에서 가져와요.
export type Role = 'A' | 'B' | 'C' | 'D';

export interface Member {
  role: Role;
  name: string;
  area: string;
}

export const members: Member[] = [
  { role: 'A', name: '민성', area: '기록·문서' },
  { role: 'B', name: '준호', area: 'AI·카드' },
  { role: 'C', name: '재민', area: '캘린더' },
  { role: 'D', name: '서현', area: '기반·PM' },
];

export const memberOf = (role: Role) => members.find((m) => m.role === role)!;
