import type { Feature, Owner } from '@/lib/feature';

// 등록된 기능(registry)에서 개발 메뉴 줄을 만들어요. 기능을 추가하면 여기는 고치지 않아도 메뉴에 나와요.
export interface DevEntry {
  key: string;
  title: string;
  /** 앱 안 주소. 동적 라우트([id])는 'sample'로 채워요 */
  href: string;
  owner: Owner;
  /** 고칠 파일이 있는 폴더 */
  folder: string;
}

export function devEntries(features: Feature[]): DevEntry[] {
  return features
    .filter((f) => f.id !== 'dev')
    .flatMap((f) => {
      const base = { owner: f.owner, folder: `features/${f.id}` };
      const rows: DevEntry[] = [];
      if (f.tab)
        rows.push({ ...base, key: `${f.id}:tab`, title: `${f.tab.title} 탭`, href: `/${f.id}` });
      if (f.todaySection)
        rows.push({ ...base, key: `${f.id}:today`, title: `오늘 화면 · ${f.id} 섹션`, href: '/' });
      for (const s of f.screens ?? []) {
        rows.push({
          ...base,
          key: `${f.id}:${s.route}`,
          title: s.title,
          href: `/${s.route.replace(/\[[^\]]+\]/g, 'sample')}`,
        });
      }
      return rows;
    })
    .sort((a, b) => a.owner.localeCompare(b.owner));
}
