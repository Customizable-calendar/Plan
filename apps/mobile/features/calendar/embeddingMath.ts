// 순수 TypeScript로 작성한 로컬 해시태그 임베딩 수학 · 토크나이저 · 의미 유사도 엔진이에요.
// React Native / Expo / Node(node --test) 어디서든 동일하게 실행돼요.

export type SafetensorsLayout = {
  dataStart: number;
  weightsOffset: number;
  embeddingsOffset: number;
  vocabSize: number;
  dim: number;
};

export type UnigramVocabIndex = {
  pieces: Map<string, { id: number; score: number }>;
  maxPieceLen: number;
};

export type SemanticLinkReason = 'embedding' | 'synonym' | 'context';

export type SemanticTagLink = {
  source: string;
  target: string;
  similarity: number;
  reason: SemanticLinkReason;
};

type SafetensorsTensorEntry = {
  dtype?: string;
  shape?: number[];
  data_offsets?: number[];
};

const EXPLICIT_TAG_RE = /(?:^|[^\p{L}\p{M}\p{N}_/#.-])#([\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*)/gu;

/**
 * safetensors 파일 앞부분(헤더)을 읽어 `weights(F32)`와 `embeddings(I8)` 바이트 위치를 계산해요.
 * 전체 130MB를 메모리에 올리지 않고 필요한 토큰 행만 건너뛰어 읽기 위해 사용해요.
 */
export function parseSafetensorsHeader(buffer: ArrayBuffer): SafetensorsLayout {
  if (buffer.byteLength < 8) {
    throw new Error('임베딩 모델 헤더가 손상되었어요.');
  }
  const view = new DataView(buffer);
  const low = view.getUint32(0, true);
  const high = view.getUint32(4, true);
  const headerLen = low + high * 2 ** 32;
  if (!Number.isFinite(headerLen) || headerLen <= 0 || 8 + headerLen > buffer.byteLength) {
    throw new Error('임베딩 모델 헤더 길이가 올바르지 않아요.');
  }

  const headerText = new TextDecoder().decode(new Uint8Array(buffer, 8, headerLen));
  const parsed = JSON.parse(headerText) as Record<string, SafetensorsTensorEntry>;
  const weights = parsed.weights;
  const embeddings = parsed.embeddings;

  if (
    !weights?.data_offsets ||
    weights.data_offsets.length !== 2 ||
    !embeddings?.data_offsets ||
    embeddings.data_offsets.length !== 2 ||
    !embeddings.shape ||
    embeddings.shape.length !== 2
  ) {
    throw new Error('지원하지 않는 safetensors 텐서 구조예요.');
  }

  const [vocabSize, dim] = embeddings.shape;
  if (vocabSize <= 0 || dim <= 0) {
    throw new Error('임베딩 차원 정보가 올바르지 않아요.');
  }

  const dataStart = 8 + headerLen;
  return {
    dataStart,
    weightsOffset: dataStart + weights.data_offsets[0],
    embeddingsOffset: dataStart + embeddings.data_offsets[0],
    vocabSize,
    dim,
  };
}

/**
 * Hugging Face `tokenizer.json`의 SentencePiece Unigram vocab(`[piece, score][]`)을 색인해요.
 */
export function buildUnigramIndex(tokenizerJsonText: string): UnigramVocabIndex {
  const parsed = JSON.parse(tokenizerJsonText) as {
    model?: { vocab?: unknown };
  };
  const vocab = parsed.model?.vocab;
  if (!Array.isArray(vocab)) {
    throw new Error('지원하지 않는 토크나이저 형식이에요.');
  }

  const pieces = new Map<string, { id: number; score: number }>();
  let maxPieceLen = 1;
  for (let i = 0; i < vocab.length; i++) {
    const entry = vocab[i];
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'number') {
      continue;
    }
    const piece = entry[0];
    pieces.set(piece, { id: i, score: entry[1] });
    if (piece.length > maxPieceLen) {
      maxPieceLen = piece.length;
    }
  }
  return { pieces, maxPieceLen };
}

/**
 * Unigram Viterbi DP로 문장을 가장 확률이 높은 서브워드 ID 목록으로 나눠요.
 * 특수 토큰과 공백 마커(`id <= 4`)는 제외해 의미 있는 토큰만 남겨요.
 */
export function tokenizeUnigram(text: string, index: UnigramVocabIndex): number[] {
  const cleaned = text.normalize('NFKC').trim().replace(/\s+/g, '▁');
  if (!cleaned) return [];

  const norm = `▁${cleaned}`;
  const n = norm.length;
  const maxStep = Math.max(1, Math.min(index.maxPieceLen, 16));
  const dp = new Float64Array(n + 1).fill(-1e18);
  const back = new Int32Array(n + 1).fill(-1);
  const backId = new Int32Array(n + 1).fill(-1);
  dp[0] = 0;

  for (let i = 0; i < n; i++) {
    if (dp[i] <= -1e17) continue;
    const limit = Math.min(n, i + maxStep);
    let matchedAny = false;
    for (let j = i + 1; j <= limit; j++) {
      const hit = index.pieces.get(norm.slice(i, j));
      if (hit) {
        matchedAny = true;
        const cand = dp[i] + hit.score;
        if (cand > dp[j]) {
          dp[j] = cand;
          back[j] = i;
          backId[j] = hit.id;
        }
      }
    }
    if (!matchedAny) {
      const cand = dp[i] - 20;
      if (cand > dp[i + 1]) {
        dp[i + 1] = cand;
        back[i + 1] = i;
        backId[i + 1] = -1;
      }
    }
  }

  const ids: number[] = [];
  for (let cur = n; cur > 0 && back[cur] >= 0; cur = back[cur]) {
    if (backId[cur] > 4) {
      ids.push(backId[cur]);
    }
  }
  return ids.reverse();
}

/**
 * INT8 양자화 임베딩 행과 토큰별 F32 스케일(`weights`)을 역양자화해 합산한 뒤 L2 정규화해요.
 */
export function poolQuantizedRows(
  rows: readonly { scale: number; values: Int8Array }[],
  dim: number,
): Float32Array {
  const out = new Float32Array(dim);
  for (const row of rows) {
    const len = Math.min(dim, row.values.length);
    for (let d = 0; d < len; d++) {
      out[d] += row.values[d] * row.scale;
    }
  }
  let normSq = 0;
  for (let d = 0; d < dim; d++) {
    normSq += out[d] * out[d];
  }
  const norm = Math.sqrt(normSq);
  if (norm > 0) {
    for (let d = 0; d < dim; d++) {
      out[d] /= norm;
    }
  }
  return out;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom <= 0) return 0;
  return Math.max(-1, Math.min(1, dot / denom));
}

// ---------- 기본 내장 한국어/영어 유의어 · 형태소 유사도 ----------

export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['과제', '숙제', '레포트', '리포트', '보고서', 'assignment', 'homework', 'report'],
  ['공부', '학습', '시험', '복습', '예습', '강의', '스터디', '학습일지', '문제'],
  [
    '운동',
    '헬스',
    '헬스장',
    '러닝',
    '조깅',
    '달리기',
    '요가',
    '스트레칭',
    '필라테스',
    '수영',
    '등산',
    '산책',
    '근력',
  ],
  ['회의', '미팅', '스탠드업', '싱크', '면담', '면접', '협의', '주간회의', '체크인'],
  ['점심', '저녁', '식사', '회식', '브런치', '카페', '커피'],
  ['개발', '코딩', '구현', '프로그래밍', '백엔드', '프론트엔드', 'api', '코드리뷰', '리팩토링'],
  ['발표', '데모', '리허설', '피칭', '슬라이드', '스토리보드', '세미나'],
  ['독서', '서적', '책', '논문', '리뷰', '요약'],
  ['병원', '치과', '내과', '검진', '건강', '진료'],
  ['회고', '복기', '회고록', '정리', '피드백'],
  ['기획', '스펙', '로드맵', '제안서', '요구사항', '설계', '아키텍처'],
  ['배포', '릴리즈', '스테이지', '프로덕션', '빌드', '파이프라인'],
];

const GROUP_INDEX_BY_WORD = new Map<string, number[]>();
SYNONYM_GROUPS.forEach((group, groupIdx) => {
  for (const word of group) {
    const key = word.toLowerCase();
    const list = GROUP_INDEX_BY_WORD.get(key) ?? [];
    list.push(groupIdx);
    GROUP_INDEX_BY_WORD.set(key, list);
  }
});

function cleanTagWord(tag: string): string {
  return tag.trim().replace(/^#+/, '').replace(/#+$/g, '').toLowerCase();
}

function jamoDiceSimilarity(a: string, b: string): number {
  const nfdA = a.normalize('NFD');
  const nfdB = b.normalize('NFD');
  if (nfdA.length < 4 || nfdB.length < 4) return 0;

  const bigramsA: string[] = [];
  for (let i = 0; i < nfdA.length - 1; i++) bigramsA.push(nfdA.slice(i, i + 2));

  const countsB = new Map<string, number>();
  for (let i = 0; i < nfdB.length - 1; i++) {
    const bg = nfdB.slice(i, i + 2);
    countsB.set(bg, (countsB.get(bg) ?? 0) + 1);
  }

  let overlap = 0;
  for (const bg of bigramsA) {
    const rem = countsB.get(bg) ?? 0;
    if (rem > 0) {
      overlap += 1;
      countsB.set(bg, rem - 1);
    }
  }
  const dice = (2 * overlap) / (bigramsA.length + (nfdB.length - 1));
  return Math.min(0.8, dice * 1.05);
}

/**
 * 유의어 사전, 부분 문자열/어근 공유, 한글 자모 2-gram Dice 유사도를 합산해요.
 */
export function computeLexicalSimilarity(tagA: string, tagB: string): number {
  const a = cleanTagWord(tagA);
  const b = cleanTagWord(tagB);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const groupsA = GROUP_INDEX_BY_WORD.get(a);
  const groupsB = GROUP_INDEX_BY_WORD.get(b);
  if (groupsA && groupsB && groupsA.some((g) => groupsB.includes(g))) {
    return 0.86;
  }

  // 복합어(예: `알고리즘과제` vs `숙제`)가 같은 유의어 그룹에 속하면 연결해요.
  let bestStemGroup = 0;
  for (let gIdx = 0; gIdx < SYNONYM_GROUPS.length; gIdx++) {
    const group = SYNONYM_GROUPS[gIdx];
    const hitA = group.some((kw) => kw.length >= 2 && a.includes(kw));
    const hitB = group.some((kw) => kw.length >= 2 && b.includes(kw));
    if (hitA && hitB) {
      bestStemGroup = 0.74;
      break;
    }
  }

  let substringScore = 0;
  if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) {
    substringScore = 0.78;
  }

  const jamoScore = jamoDiceSimilarity(a, b);
  return Math.max(bestStemGroup, substringScore, jamoScore);
}

function normalizeTagList(rawTags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawTags) {
    const cleaned = raw
      .trim()
      .replace(/^#+/, '')
      .replace(/#+$/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    if (!cleaned) continue;
    const tag = `#${cleaned}`;
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

function extractInlineTagsFallback(title: string): string[] {
  const seen = new Set<string>();
  for (const match of title.normalize('NFKC').matchAll(EXPLICIT_TAG_RE)) {
    seen.add(`#${match[1].toLowerCase()}`);
  }
  return [...seen];
}

/**
 * 로컬 임베딩 벡터(있을 때), 유의어/자모 유사도, 2-hop 동시 출현 문맥을 결합해
 * 노드당 상위 `maxNeighborsPerNode`개의 의미 유사 연결을 추출해요.
 */
export function computeSemanticLinks(
  items: readonly { id: string; title: string; tags?: readonly string[] }[],
  options?: {
    vectors?: ReadonlyMap<string, Float32Array>;
    minSimilarity?: number;
    maxNeighborsPerNode?: number;
  },
): SemanticTagLink[] {
  const vectors = options?.vectors;

  const coNeighbors = new Map<string, Set<string>>();
  for (const item of items) {
    const tags =
      item.tags && item.tags.length > 0
        ? normalizeTagList(item.tags)
        : extractInlineTagsFallback(item.title);
    for (const tag of tags) {
      if (!coNeighbors.has(tag)) coNeighbors.set(tag, new Set());
      const nb = coNeighbors.get(tag)!;
      for (const other of tags) {
        if (other !== tag) nb.add(other);
      }
    }
  }

  const allTags = [...coNeighbors.keys()].sort((a, b) => a.localeCompare(b, 'ko'));
  // 태그 수가 많아질수록 기준 유사도를 높이고 노드당 최대 이웃 수를 줄여 그래프가 과밀해지지 않게 자동 조절해요.
  const autoMinSimilarity = allTags.length > 60 ? 0.74 : allTags.length > 25 ? 0.68 : 0.6;
  const autoMaxNeighbors = allTags.length > 25 ? 2 : 3;
  const minSimilarity = options?.minSimilarity ?? autoMinSimilarity;
  const maxNeighborsPerNode = options?.maxNeighborsPerNode ?? autoMaxNeighbors;
  const candidates: SemanticTagLink[] = [];

  for (let i = 0; i < allTags.length; i++) {
    for (let j = i + 1; j < allTags.length; j++) {
      const a = allTags[i];
      const b = allTags[j];
      const nbA = coNeighbors.get(a);
      const nbB = coNeighbors.get(b);

      if (allTags.length > 25 && nbA?.has(b)) {
        continue;
      }

      let modelSim = 0;
      const vecA = vectors?.get(a);
      const vecB = vectors?.get(b);
      if (vecA && vecB) {
        const rawCos = cosineSimilarity(vecA, vecB);
        if (rawCos >= 0.2) {
          modelSim = Math.min(0.98, 0.55 + ((rawCos - 0.2) / 0.45) * 0.43);
        }
      }

      const lexicalSim = computeLexicalSimilarity(a, b);

      let contextSim = 0;
      if (nbA && nbB && nbA.size > 0 && nbB.size > 0) {
        let shared = 0;
        for (const t of nbA) {
          if (nbB.has(t)) shared += 1;
        }
        if (shared >= 2) {
          const unionSize = nbA.size + nbB.size - shared;
          const jaccard = unionSize > 0 ? shared / unionSize : 0;
          contextSim = 0.55 + jaccard * 0.35;
        }
      }

      if (modelSim >= minSimilarity && modelSim >= lexicalSim * 0.95) {
        candidates.push({ source: a, target: b, similarity: modelSim, reason: 'embedding' });
      } else if (lexicalSim >= minSimilarity) {
        candidates.push({ source: a, target: b, similarity: lexicalSim, reason: 'synonym' });
      } else if (contextSim >= minSimilarity) {
        candidates.push({ source: a, target: b, similarity: contextSim, reason: 'context' });
      }
    }
  }

  // 유사도가 높은 간선부터 채택하고, 양 끝 노드가 최대 이웃 수(K)를 넘지 않게 제한해요.
  candidates.sort(
    (a, b) =>
      b.similarity - a.similarity ||
      a.source.localeCompare(b.source, 'ko') ||
      a.target.localeCompare(b.target, 'ko'),
  );
  const degree = new Map<string, number>();
  const kept: SemanticTagLink[] = [];
  for (const link of candidates) {
    const degA = degree.get(link.source) ?? 0;
    const degB = degree.get(link.target) ?? 0;
    if (degA >= maxNeighborsPerNode || degB >= maxNeighborsPerNode) continue;
    degree.set(link.source, degA + 1);
    degree.set(link.target, degB + 1);
    kept.push(link);
  }
  return kept;
}
