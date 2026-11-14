type CalendarTagItem = { id: string; title: string };

export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  const pattern = /(?:^|[^\p{L}\p{M}\p{N}_/#.-])#([\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*)/gu;
  for (const match of text.normalize('NFKC').matchAll(pattern)) {
    tags.add(`#${match[1].toLowerCase()}`);
  }
  return [...tags];
}

type TagNode = {
  tag: string;
  items: CalendarTagItem[];
  links: Map<string, number>;
};

export function buildHashtagGraph(items: readonly CalendarTagItem[]) {
  const graph = new Map<string, TagNode>();

  for (const item of items) {
    const tags = extractHashtags(item.title);
    for (const tag of tags) {
      const node = graph.get(tag) ?? { tag, items: [], links: new Map<string, number>() };
      node.items.push(item);
      // 같은 일정이나 할 일에 나온 태그의 연결 횟수를 높여요.
      for (const other of tags) {
        if (other !== tag) node.links.set(other, (node.links.get(other) ?? 0) + 1);
      }
      graph.set(tag, node);
    }
  }

  return [...graph.values()].sort(
    (a, b) => b.items.length - a.items.length || a.tag.localeCompare(b.tag, 'ko'),
  );
}
