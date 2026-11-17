/**
 * Force-directed hashtag graph builder and layout engine.
 * - Velocity Verlet, phyllotaxis, link/repulsion/collide forces ported from `d3/d3-force` (ISC License).
 * - Cluster and ego-network graph model inspired by `jackyzha0/quartz` (MIT License).
 */
export type CalendarTagItem = {
  id: string;
  title: string;
  kind?: 'event' | 'task';
  startAt?: string;
  endAt?: string;
};
export type TagNode = {
  tag: string;
  items: CalendarTagItem[];
  links: Map<string, number>;
  cluster: number;
  weight: number;
};
export type TagEdge = { key: string; source: string; target: string; weight: number };
export type PositionedTagNode = TagNode & { x: number; y: number; radius: number; hop: number };
export type PositionedTagEdge = TagEdge & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  backbone: boolean;
};
export type LayoutHashtagGraphOptions = {
  width: number;
  height: number;
  focusTag?: string;
  maxHops?: number;
  backboneOnly?: boolean;
};

const CLUSTER_COUNT = 6;

export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  const pattern = /(?:^|[^\p{L}\p{M}\p{N}_/#.-])#([\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*)/gu;
  for (const match of text.normalize('NFKC').matchAll(pattern))
    tags.add(`#${match[1].toLowerCase()}`);
  return [...tags];
}

function assignClusters(nodes: TagNode[]): void {
  const connected = nodes.filter((node) => node.links.size > 0);
  if (!connected.length) {
    nodes.forEach((node, i) => {
      node.cluster = i % CLUSTER_COUNT;
    });
    return;
  }
  const target = Math.min(CLUSTER_COUNT, Math.max(1, Math.ceil(connected.length / 3)));
  const seeds: TagNode[] = [];
  const seedSet = new Set<string>();
  for (let c = 0; c < target; c++) {
    let best: TagNode | undefined;
    let bestScore = -Infinity;
    for (const cand of connected) {
      if (seedSet.has(cand.tag)) continue;
      let linkToSeeds = 0;
      for (const seed of seeds) linkToSeeds += cand.links.get(seed.tag) ?? 0;
      const score = cand.weight / (1 + linkToSeeds * 12);
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (!best) break;
    best.cluster = c;
    seeds.push(best);
    seedSet.add(best.tag);
  }
  const nodeMap = new Map(nodes.map((node) => [node.tag, node]));
  const sizes = new Array<number>(seeds.length).fill(1);
  for (let pass = 0; pass < 5; pass++) {
    for (const node of nodes) {
      if (seedSet.has(node.tag) || node.links.size === 0) continue;
      const scores = new Array<number>(seeds.length).fill(0);
      for (const [neighborTag, weight] of node.links) {
        const nb = nodeMap.get(neighborTag);
        if (nb && nb.cluster >= 0 && nb.cluster < seeds.length)
          scores[nb.cluster] += weight / Math.sqrt(sizes[nb.cluster] || 1);
      }
      const bestCluster = scores.reduce((best, s, idx) => (s > scores[best] ? idx : best), 0);
      if (scores[bestCluster] > 0 && bestCluster !== node.cluster) {
        if (node.cluster >= 0) sizes[node.cluster] = Math.max(0, sizes[node.cluster] - 1);
        node.cluster = bestCluster;
        sizes[bestCluster] += 1;
      }
    }
  }
  let fallback = 0;
  for (const node of nodes) if (node.cluster < 0) node.cluster = fallback++ % CLUSTER_COUNT;
}

export function buildHashtagGraph(items: readonly CalendarTagItem[]): TagNode[] {
  const graph = new Map<string, TagNode>();
  for (const item of items) {
    const tags = extractHashtags(item.title);
    for (const tag of tags) {
      const node = graph.get(tag) ?? {
        tag,
        items: [],
        links: new Map<string, number>(),
        cluster: -1,
        weight: 0,
      };
      node.items.push(item);
      for (const other of tags)
        if (other !== tag) node.links.set(other, (node.links.get(other) ?? 0) + 1);
      graph.set(tag, node);
    }
  }
  for (const node of graph.values()) {
    let sum = 0;
    for (const w of node.links.values()) sum += w;
    node.weight = node.items.length + sum * 0.5;
  }
  const sorted = [...graph.values()].sort(
    (a, b) =>
      b.items.length - a.items.length ||
      b.links.size - a.links.size ||
      a.tag.localeCompare(b.tag, 'ko'),
  );
  assignClusters(sorted);
  return sorted;
}

export function buildHashtagEdges(nodes: readonly TagNode[]): TagEdge[] {
  const allowed = new Set(nodes.map((node) => node.tag));
  const edges = new Map<string, TagEdge>();
  for (const node of nodes) {
    for (const [other, weight] of node.links) {
      if (!allowed.has(other) || node.tag === other) continue;
      const [source, target] = node.tag < other ? [node.tag, other] : [other, node.tag];
      const key = `${source}:${target}`;
      if (!edges.has(key)) edges.set(key, { key, source, target, weight });
    }
  }
  return [...edges.values()].sort(
    (a, b) => a.weight - b.weight || a.key.localeCompare(b.key, 'ko'),
  );
}

export function computeHopDistances(
  nodes: readonly TagNode[],
  rootTag?: string,
): Map<string, number> {
  const dist = new Map(nodes.map((node) => [node.tag, Infinity]));
  if (!rootTag || !dist.has(rootTag)) return dist;
  const nodeMap = new Map(nodes.map((node) => [node.tag, node]));
  const queue = [rootTag];
  dist.set(rootTag, 0);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const nextHop = (dist.get(cur) ?? Infinity) + 1;
    for (const nb of nodeMap.get(cur)?.links.keys() ?? []) {
      if ((dist.get(nb) ?? Infinity) > nextHop) {
        dist.set(nb, nextHop);
        queue.push(nb);
      }
    }
  }
  return dist;
}

export function layoutHashtagGraph(
  nodes: readonly TagNode[],
  options: LayoutHashtagGraphOptions,
): { nodes: PositionedTagNode[]; edges: PositionedTagEdge[] } {
  const { width, height, focusTag, maxHops, backboneOnly = false } = options;
  if (!nodes.length || width <= 0 || height <= 0) return { nodes: [], edges: [] };
  const hops = computeHopDistances(nodes, focusTag);
  const visible =
    focusTag && maxHops !== undefined && Number.isFinite(maxHops)
      ? nodes.filter((n) => (hops.get(n.tag) ?? Infinity) <= maxHops)
      : [...nodes];
  if (!visible.length) return { nodes: [], edges: [] };

  const ordered = [...visible].sort((a, b) =>
    a.tag === focusTag
      ? -1
      : b.tag === focusTag
        ? 1
        : b.items.length - a.items.length || a.tag.localeCompare(b.tag, 'ko'),
  );
  const [cx, cy, initAngle] = [width / 2, height / 2, Math.PI * (3 - Math.sqrt(5))];
  const useCluster = ordered.length >= 8 && (maxHops === undefined || !Number.isFinite(maxHops));
  type SimNode = PositionedTagNode & { vx: number; vy: number; deg: number };
  const simNodes: SimNode[] = ordered.map((node, i) => {
    const radius = Math.min(
      19,
      9 + Math.sqrt(node.items.length) * 2.5 + Math.min(2.5, node.links.size * 0.35),
    );
    const r = node.tag === focusTag ? 0 : 10 * Math.sqrt(0.5 + i);
    const cAngle = (Math.max(0, node.cluster) / CLUSTER_COUNT) * 2 * Math.PI - Math.PI / 2;
    const ox = useCluster ? Math.cos(cAngle) * width * 0.18 : 0;
    const oy = useCluster ? Math.sin(cAngle) * height * 0.18 : 0;
    return {
      ...node,
      radius,
      hop: hops.get(node.tag) ?? Infinity,
      x: cx + ox + r * Math.cos(i * initAngle) * (width > height * 1.2 ? 1.35 : 1) * 0.65,
      y: cy + oy + r * Math.sin(i * initAngle) * 0.65,
      vx: 0,
      vy: 0,
      deg: Math.max(1, node.links.size),
    };
  });

  const simMap = new Map(simNodes.map((n) => [n.tag, n]));
  const edges = buildHashtagEdges(visible);
  const simLinks = edges.flatMap((edge) => {
    const source = simMap.get(edge.source),
      target = simMap.get(edge.target);
    if (!source || !target) return [];
    return [
      {
        source,
        target,
        bias: source.deg / (source.deg + target.deg),
        strength: Math.min(
          1,
          (1 / Math.min(source.deg, target.deg)) * (1 + Math.min(1.5, (edge.weight - 1) * 0.25)),
        ),
        distance: Math.max(72, 126 - edge.weight * 8) * Math.min(1.25, Math.max(0.8, width / 460)),
      },
    ];
  });

  const [padX, padTop, padBottom] = [
    Math.min(width / 2 - 4, 58),
    Math.min(height / 2 - 4, 36),
    Math.min(height / 2 - 4, 54),
  ];
  const [usableW, usableH] = [
    Math.max(1, width - padX * 2),
    Math.max(1, height - padTop - padBottom),
  ];
  const spaceScale = Math.min(
    1,
    Math.max(0.68, Math.sqrt((usableW * usableH) / (simNodes.length * 5200))),
  );
  const [extraX, extraY] = [32 * spaceScale, 28 * spaceScale];
  let seed = 1337;
  const jiggle = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff - 0.5) * 1e-4;
  };
  const resolveCollisions = (strength: number) => {
    for (let i = 0; i < simNodes.length; i++)
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i],
          b = simNodes[j];
        const dx = a.x + a.vx - (b.x + b.vx) || jiggle(),
          dy = a.y + a.vy - (b.y + b.vy) || jiggle();
        const minDx = a.radius + b.radius + extraX,
          minDy = a.radius + b.radius + extraY;
        const norm = (dx * dx) / (minDx * minDx) + (dy * dy) / (minDy * minDy);
        if (norm < 1) {
          const push = ((1 - Math.sqrt(norm)) / (Math.sqrt(norm) || 1e-6)) * strength;
          const rA = a.radius * a.radius,
            rB = b.radius * b.radius,
            share = rB / (rA + rB);
          a.vx += dx * push * share;
          a.vy += dy * push * share;
          b.vx -= dx * push * (1 - share);
          b.vy -= dy * push * (1 - share);
        }
      }
  };

  let alpha = 1;
  const alphaDecay = 1 - Math.pow(0.001, 1 / 160);
  for (let iter = 0; iter < 160; iter++) {
    alpha += (0 - alpha) * alphaDecay;
    for (let i = 0; i < simNodes.length; i++)
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i],
          b = simNodes[j];
        const dx = b.x - a.x || jiggle(),
          dy = b.y - a.y || jiggle(),
          l2 = Math.max(25, dx * dx + dy * dy);
        const wA = (-240 * (1 + 0.08 * b.links.size) * alpha) / l2,
          wB = (-240 * (1 + 0.08 * a.links.size) * alpha) / l2;
        a.vx += dx * wA;
        a.vy += dy * wA;
        b.vx -= dx * wB;
        b.vy -= dy * wB;
      }
    for (const { source, target, bias, strength, distance } of simLinks) {
      const dx = target.x + target.vx - source.x - source.vx || jiggle(),
        dy = target.y + target.vy - source.y - source.vy || jiggle();
      const dist = Math.hypot(dx, dy) || 1e-6,
        f = ((dist - distance) / dist) * alpha * strength;
      target.vx -= dx * f * bias;
      target.vy -= dy * f * bias;
      source.vx += dx * f * (1 - bias);
      source.vy += dy * f * (1 - bias);
    }
    for (const node of simNodes) {
      if (useCluster && node.tag !== focusTag && node.cluster >= 0) {
        const cAngle = (node.cluster / CLUSTER_COUNT) * 2 * Math.PI - Math.PI / 2;
        node.vx += (cx + Math.cos(cAngle) * width * 0.22 - node.x) * 0.08 * alpha;
        node.vy += (cy + Math.sin(cAngle) * height * 0.22 - node.y) * 0.08 * alpha;
      } else {
        const pull = node.tag === focusTag ? 2.2 : node.hop === Infinity ? 1.5 : 1;
        node.vx += (cx - node.x) * (width > height * 1.2 ? 0.025 : 0.075) * pull * alpha;
        node.vy += (cy - node.y) * (height > width ? 0.045 : 0.08) * pull * alpha;
      }
      if (node.x < padX) node.vx += (padX - node.x) * 0.25;
      else if (node.x > width - padX) node.vx += (width - padX - node.x) * 0.25;
      if (node.y < padTop) node.vy += (padTop - node.y) * 0.25;
      else if (node.y > height - padBottom) node.vy += (height - padBottom - node.y) * 0.25;
    }
    resolveCollisions(0.65);
    for (const n of simNodes) {
      n.vx *= 0.6;
      n.vy *= 0.6;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  const xs = simNodes.map((n) => n.x),
    ys = simNodes.map((n) => n.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const fitScale =
    simNodes.length === 1
      ? 1
      : Math.min(1, usableW / Math.max(1, maxX - minX), usableH / Math.max(1, maxY - minY));
  for (const n of simNodes) {
    n.x = cx + (n.x - (minX + maxX) / 2) * fitScale;
    n.y = padTop + usableH / 2 + (n.y - (minY + maxY) / 2) * fitScale;
    n.vx = 0;
    n.vy = 0;
  }
  for (let pass = 0; pass < 36; pass++) {
    resolveCollisions(0.45);
    for (const n of simNodes) {
      n.vx *= 0.5;
      n.vy *= 0.5;
      n.x = Math.max(padX, Math.min(width - padX, n.x + n.vx));
      n.y = Math.max(padTop, Math.min(height - padBottom, n.y + n.vy));
    }
  }

  const positionedNodes: PositionedTagNode[] = simNodes.map(
    ({ vx: _vx, vy: _vy, deg: _deg, ...rest }) => rest,
  );
  const finalMap = new Map(positionedNodes.map((n) => [n.tag, n]));
  const topEdge = new Map<string, string>(),
    bestScore = new Map<string, number>();
  for (const edge of edges) {
    const s = finalMap.get(edge.source),
      t = finalMap.get(edge.target);
    if (!s || !t) continue;
    if (edge.weight * 1000 + t.items.length > (bestScore.get(edge.source) ?? -1)) {
      bestScore.set(edge.source, edge.weight * 1000 + t.items.length);
      topEdge.set(edge.source, edge.key);
    }
    if (edge.weight * 1000 + s.items.length > (bestScore.get(edge.target) ?? -1)) {
      bestScore.set(edge.target, edge.weight * 1000 + s.items.length);
      topEdge.set(edge.target, edge.key);
    }
  }
  const positionedEdges = edges.flatMap((edge) => {
    const s = finalMap.get(edge.source),
      t = finalMap.get(edge.target);
    if (!s || !t) return [];
    const active = Boolean(focusTag && (edge.source === focusTag || edge.target === focusTag));
    const backbone =
      active ||
      edge.weight >= 2 ||
      topEdge.get(edge.source) === edge.key ||
      topEdge.get(edge.target) === edge.key;
    return !backboneOnly || backbone
      ? [{ ...edge, x1: s.x, y1: s.y, x2: t.x, y2: t.y, active, backbone }]
      : [];
  });
  return { nodes: positionedNodes, edges: positionedEdges };
}
