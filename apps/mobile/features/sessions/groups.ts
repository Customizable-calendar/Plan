import { type Template, type TemplateCategory, templates } from '@noteapp/shared';

// 한 분류에 형식(양식)이 여러 개인 것. 고르기 시트, 세션 자료함, 왼쪽 메뉴에서 한 묶음으로 보여줘요.
// 지금은 블로그만 두 형식(블로그 글, 사진 포스트)이에요.
export const GROUPS: Partial<
  Record<TemplateCategory, { name: string; description: string; ask: string }>
> = {
  blog: {
    name: '블로그',
    description: '글과 사진으로 쓸지, 사진에 짧은 글을 붙일지 골라요.',
    ask: '어떤 형식으로 쓸까요?',
  },
};

/** 이 양식이 묶음에 들어가면 그 분류, 아니면 null. 형식이 하나뿐인 분류는 묶지 않아요. */
export function groupOf(template: Template | undefined): TemplateCategory | null {
  const category = template?.category;
  if (!category || !GROUPS[category]) return null;
  return templates.filter((t) => t.category === category).length > 1 ? category : null;
}
