// 자연어 일정/할 일 제목에서 #해시태그를 자동으로 추출하는 순수 알고리즘 모듈이에요.
// React Native나 Node(node --test) 양쪽에서 바로 불러올 수 있도록 런타임 외부 의존성을 두지 않아요.

export type TagExtractionLevel = 1 | 2 | 3 | 4 | 5;

export const DEFAULT_TAG_EXTRACTION_LEVEL: TagExtractionLevel = 3;

export const TAG_LEVEL_CONFIG: Record<
  TagExtractionLevel,
  { label: string; shortLabel: string; summary: string; maxTags: number; minScore: number }
> = {
  1: {
    label: '최소',
    shortLabel: '최소',
    summary: '가장 핵심인 키워드 1개만 추출해요',
    maxTags: 1,
    minScore: 1.8,
  },
  2: {
    label: '적게',
    shortLabel: '적게',
    summary: '꼭 필요한 대표 태그 최대 2개만 남겨요',
    maxTags: 2,
    minScore: 1.45,
  },
  3: {
    label: '보통',
    shortLabel: '보통',
    summary: '핵심 명사와 도메인 태그를 최대 3개 추출해요',
    maxTags: 3,
    minScore: 1.15,
  },
  4: {
    label: '풍부하게',
    shortLabel: '풍부',
    summary: '세부 주제와 도메인 태그를 최대 5개 추출해요',
    maxTags: 5,
    minScore: 0.85,
  },
  5: {
    label: '최대',
    shortLabel: '최대',
    summary: '하위 단어와 연관 분류까지 최대 7개 폭넓게 추출해요',
    maxTags: 7,
    minScore: 0.5,
  },
};

export function normalizeTagExtractionLevel(raw: unknown): TagExtractionLevel {
  const n = typeof raw === 'number' ? Math.round(raw) : Number(raw);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return DEFAULT_TAG_EXTRACTION_LEVEL;
}

export interface AutoTagOptions {
  level?: TagExtractionLevel;
  maxTags?: number;
  corpusFreq?: ReadonlyMap<string, number>;
  preferredTags?: readonly string[];
}

const EXPLICIT_HASHTAG_RE = /(?:^|\s)#([0-9A-Za-z가-힣_]+)/g;
const CHUNK_SPLIT_RE = /[,/·|()[\]{}!?~:\n]+/g;
const TOKEN_SPLIT_RE = /[^\p{L}\p{N}_+-]+/u;
const PURE_NUMBER_RE = /^\d+$/;
const NUMERIC_UNIT_RE =
  /^\d+(?:[.,]\d+)?(?:시|시간|분|분간|초|일|일간|주|주차|주간|개월|년|년도|월|차|회|번|명|개|건|km|m|cm|mm|kg|g|mg|ml|l|페이지|쪽|강|장|화|단계|lv|level|%|원|달러)?$/i;
const ENGLISH_WORD_RE = /^[a-z0-9_+-]+$/i;

// 1음절 조사가 어근의 일부인 단어(명사/외래어)는 어간 분리를 막아 원형을 보존해요.
const PROTECTED_WORDS = new Set([
  '회의',
  '강의',
  '논의',
  '합의',
  '문의',
  '토의',
  '정의',
  '동의',
  '예의',
  '취미',
  '준비',
  '마무리',
  '동아리',
  '스터디',
  '파티',
  '커피',
  '에세이',
  '서베이',
  '트레이',
  '플레이',
  '원데이',
  '투데이',
  '아이디',
  '카피',
  '정리',
  '글쓰기',
  '일기',
  '분기',
  '초기',
  '후기',
  '정기',
  '반기',
  '달리기',
  '걷기',
  '회고',
  '보고',
  '참고',
  '광고',
  '원고',
  '재고',
  '로고',
  '시나리오',
  '오디오',
  '비디오',
  '스튜디오',
  '인프라',
  '요가',
  '평가',
  '휴가',
  '추가',
  '증가',
  '물가',
  '단가',
  '전문가',
  '작곡가',
  '가을',
  '겨울',
  '노을',
  '하늘',
  '마을',
  '완성도',
  '중요도',
  '인지도',
  '해상도',
  '정확도',
  '속도',
  '온도',
  '제도',
  '연도',
  '년도',
  '마이크로',
  '제로',
  '히어로',
  '메트로',
  '워크플로',
  '플로우',
  '결과',
  '성과',
  '교과',
  '학과',
  '치과',
  '내과',
  '외과',
  '피부과',
  '소아과',
  '통과',
  '초과',
  '고민',
  '디자인',
  '핸들',
  '캔들',
  '번들',
  '모델',
  '미들',
  '두들',
  '허들',
  '모듈',
  '테이블',
  '채널',
  '패널',
  '터널',
]);

// 해시태그로 가치가 낮은 시간/수량/범용 동사성 불용어를 걸러내요.
const NOISE_WORDS = new Set([
  '오늘',
  '내일',
  '모레',
  '어제',
  '금일',
  '익일',
  '이번',
  '다음',
  '지난',
  '이번주',
  '다음주',
  '주간',
  '월간',
  '일간',
  '매주',
  '매일',
  '매월',
  '매년',
  '평일',
  '주말',
  '연휴',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
  '일요일',
  '오전',
  '오후',
  '아침',
  '저녁',
  '새벽',
  '밤',
  '시간',
  '분간',
  '일정',
  '예정',
  '관련',
  '대한',
  '위한',
  '통한',
  '관한',
  '및',
  '또는',
  '그리고',
  '혹은',
  '등',
  '등을',
  '에서',
  '까지',
  '부터',
  '작성',
  '점검',
  '확인',
  '준비',
  '정리',
  '진행',
  '완료',
  '검토',
  '추가',
  '수정',
  '삭제',
  '변경',
  '공유',
  '처리',
  '생성',
  '구현',
  '작업',
  '하기',
  '해보기',
  '잡기',
  '보기',
  '쓰기',
  '만들기',
  '찾기',
  '고치기',
  '개선',
  '최종',
  '전체',
  '기본',
  '간단',
  '신규',
  '기존',
  '초안',
  '리스트',
  '목록',
  '내용',
  '항목',
  '부분',
  '사항',
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'todo',
  'task',
  'check',
  'update',
  'fix',
  'make',
  'add',
  'list',
  'draft',
  'today',
  'tomorrow',
]);

// 한국어 어말 조사/어미 목록이에요 (긴 접미사부터 먼저 검사해요).
const MULTI_JOSA_SUFFIXES = [
  '에서는',
  '으로는',
  '에게서',
  '한테서',
  '에서의',
  '까지의',
  '부터의',
  '에서',
  '으로',
  '부터',
  '까지',
  '처럼',
  '에게',
  '한테',
  '이랑',
  '하고',
  '이며',
  '에는',
  '에도',
  '보다',
  '마다',
];

const SINGLE_JOSA_SUFFIXES = [
  '을',
  '를',
  '이',
  '가',
  '은',
  '는',
  '에',
  '의',
  '로',
  '와',
  '과',
  '도',
  '만',
  '랑',
];

// 자주 함께 쓰여 의미를 이루는 2단어 복합 키워드 규칙이에요.
const COMPOUND_RULES: readonly (readonly [string, string, string])[] = [
  ['react', 'native', 'react_native'],
  ['코드', '리뷰', '코드리뷰'],
  ['pr', '리뷰', '코드리뷰'],
  ['성능', '최적화', '성능최적화'],
  ['디자인', '시스템', '디자인시스템'],
  ['ui', 'ux', 'ui_ux'],
  ['ux', 'ui', 'ui_ux'],
  ['유저', '인터뷰', '유저인터뷰'],
  ['사용자', '테스트', '사용성테스트'],
  ['데이터', '분석', '데이터분석'],
  ['다크', '모드', '다크모드'],
  ['학습', '일지', '학습일지'],
  ['데모', '시나리오', '데모'],
];

// 도메인별 대표 상위 태그 추론 규칙이에요.
interface DomainFacetRule {
  tag: string;
  keywords: readonly string[];
  minScore: number;
}

const DOMAIN_FACET_RULES: readonly DomainFacetRule[] = [
  {
    tag: '개발',
    keywords: [
      'api',
      '서버',
      '구현',
      '코드',
      '코드리뷰',
      '버그',
      '디버그',
      '프론트엔드',
      '백엔드',
      'db',
      'sql',
      'expo',
      'react_native',
    ],
    minScore: 1.4,
  },
  {
    tag: '백엔드',
    keywords: [
      'api',
      '서버',
      'db',
      'sql',
      '마이그레이션',
      '쿼리',
      'supabase',
      'postgres',
      '스토리지',
      '인증',
    ],
    minScore: 1.5,
  },
  {
    tag: '배포',
    keywords: ['배포', '스테이지', '릴리즈', '빌드', '프로덕션', '런칭'],
    minScore: 1.6,
  },
  {
    tag: '디자인',
    keywords: [
      'ui',
      'ux',
      'ui_ux',
      '피그마',
      '시안',
      '컴포넌트',
      '스타일',
      '디자인시스템',
      '레이아웃',
      '스토리보드',
      '브랜딩',
    ],
    minScore: 1.5,
  },
  {
    tag: '테스트',
    keywords: ['테스트', 'qa', '체크리스트', '검증', '회귀', '버그'],
    minScore: 1.4,
  },
  {
    tag: '회의',
    keywords: ['회의', '미팅', '스탠드업', '싱크', '면담', '면접', '협의', '주간회의'],
    minScore: 1.6,
  },
  {
    tag: '기획',
    keywords: ['기획', '로드맵', '스펙', '요구사항', '제안서', '스토리보드', '제품'],
    minScore: 1.4,
  },
  {
    tag: '발표',
    keywords: ['발표', '슬라이드', '데모', '피칭', '중간발표'],
    minScore: 1.5,
  },
  {
    tag: '스터디',
    keywords: [
      '스터디',
      '공부',
      '학습',
      '학습일지',
      '강의',
      '세미나',
      '알고리즘',
      '코딩테스트',
      '독서',
      '논문',
    ],
    minScore: 1.5,
  },
  {
    tag: '회고',
    keywords: ['회고', '학습일지', '복기', '회고록'],
    minScore: 1.5,
  },
  {
    tag: '운동',
    keywords: [
      '운동',
      '러닝',
      '달리기',
      '헬스',
      '요가',
      '필라테스',
      '수영',
      '스트레칭',
      '등산',
      '산책',
      '조깅',
    ],
    minScore: 1.6,
  },
  {
    tag: '건강',
    keywords: ['건강', '운동', '러닝', '스트레칭', '요가', '병원', '치과', '검진', '영양'],
    minScore: 1.3,
  },
  {
    tag: '일상',
    keywords: [
      '장보기',
      '쇼핑',
      '청소',
      '세탁',
      '은행',
      '이사',
      '여행',
      '약속',
      '생일',
      '식사',
      '카페',
    ],
    minScore: 1.3,
  },
];

/** 입력 문자열을 `#소문자_태그` 형태로 정규화해요. 유효하지 않으면 빈 문자열을 돌려줘요. */
export function normalizeHashtag(raw: string): string {
  const withoutHashes = raw.trim().replace(/^#+/, '').replace(/#+$/g, '');
  if (!withoutHashes) return '';
  const cleaned = withoutHashes
    .replace(/\s+/g, '_')
    .replace(/[^0-9A-Za-z가-힣_]/g, '')
    .toLowerCase();
  if (!cleaned || cleaned.length < 2) return '';
  if (PURE_NUMBER_RE.test(cleaned)) return '';
  return `#${cleaned}`;
}

/** 제목에서 명시적인 `#해시태그` 토큰을 추출하고, 태그가 빠진 깔끔한 제목을 돌려줘요. */
export function stripInlineHashtags(title: string): { cleanTitle: string; tags: string[] } {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const match of title.matchAll(EXPLICIT_HASHTAG_RE)) {
    const normalized = normalizeHashtag(match[1]);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      tags.push(normalized);
    }
  }

  const stripped = title
    .replace(EXPLICIT_HASHTAG_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    cleanTitle: stripped || title.trim(),
    tags,
  };
}

function stemKoreanToken(rawToken: string): string {
  let token = rawToken.trim().toLowerCase();
  if (!token) return '';
  if (ENGLISH_WORD_RE.test(token)) {
    return token.replace(/^[-_]+|[-_]+$/g, '');
  }

  token = token.replace(/[^0-9A-Za-z가-힣_]/g, '');
  if (!token || PROTECTED_WORDS.has(token)) return token;

  // 먼저 긴 조사 접미사를 떼어내요.
  for (const suffix of MULTI_JOSA_SUFFIXES) {
    if (token.endsWith(suffix)) {
      const stem = token.slice(0, token.length - suffix.length);
      if (stem.length >= 2 && !PROTECTED_WORDS.has(token)) {
        token = stem;
        break;
      }
    }
  }

  // 1음절 조사를 떼어내요. 어근이 보호 단어이거나 남은 길이가 2 미만이면 건드리지 않아요.
  if (!PROTECTED_WORDS.has(token)) {
    for (const suffix of SINGLE_JOSA_SUFFIXES) {
      if (token.endsWith(suffix)) {
        const stem = token.slice(0, token.length - suffix.length);
        if (stem.length >= 2) {
          token = stem;
          break;
        }
      }
    }
  }

  // 복수 접미사 `-들`을 정리해요 (예: 팀원들 -> 팀원).
  if (token.endsWith('들') && !PROTECTED_WORDS.has(token)) {
    const stem = token.slice(0, -1);
    if (stem.length >= 2) {
      token = stem;
    }
  }

  return token;
}

function isNoiseToken(token: string): boolean {
  if (!token || token.length < 2) return true;
  if (PURE_NUMBER_RE.test(token)) return true;
  if (NUMERIC_UNIT_RE.test(token)) return true;
  if (NOISE_WORDS.has(token)) return true;
  // 숫자+영문이 아닌 숫자+한글 조사 패턴(예: 12일에 -> 12일)을 추가 차단해요.
  if (/^\d+[가-힣]+$/.test(token)) return true;
  return false;
}

function tokenizeCleanText(cleanTitle: string): {
  phrases: string[][];
  allTokens: string[];
  compounds: { tag: string; parts: [string, string] }[];
} {
  // 접속 조사 `와`/`과`/`및`은 구(phrase) 구분자로 취급해 RAKE 공동 출현 점수를 정교하게 계산해요.
  const preSplit = cleanTitle
    .replace(CHUNK_SPLIT_RE, ' | ')
    .replace(/\s+(?:및|또는|혹은|와|과)\s+/g, ' | ');

  const rawChunks = preSplit.split('|');
  const phrases: string[][] = [];
  const allTokens: string[] = [];
  const compounds: { tag: string; parts: [string, string] }[] = [];
  const seenCompounds = new Set<string>();

  for (const chunk of rawChunks) {
    const rawWords = chunk
      .trim()
      .split(/\s+/)
      .flatMap((part) => part.split(TOKEN_SPLIT_RE))
      .filter(Boolean);

    let currentPhrase: string[] = [];
    const chunkStemmed: string[] = [];

    for (const raw of rawWords) {
      const stemmed = stemKoreanToken(raw);
      if (isNoiseToken(stemmed)) {
        if (currentPhrase.length > 0) {
          phrases.push(currentPhrase);
          currentPhrase = [];
        }
        continue;
      }
      currentPhrase.push(stemmed);
      allTokens.push(stemmed);
      chunkStemmed.push(stemmed);
    }

    if (currentPhrase.length > 0) {
      phrases.push(currentPhrase);
    }

    // 인접 바이그램으로 복합 키워드를 탐지해요.
    for (let i = 0; i < chunkStemmed.length - 1; i += 1) {
      const first = chunkStemmed[i];
      const second = chunkStemmed[i + 1];
      for (const [left, right, compound] of COMPOUND_RULES) {
        if (first === left && second === right && !seenCompounds.has(compound)) {
          seenCompounds.add(compound);
          compounds.push({ tag: compound, parts: [left, right] });
        }
      }
    }
  }

  return { phrases, allTokens, compounds };
}

/** 제목이나 태그 목록 모음에서 태그별 등장 빈도를 집계해 추천 점수 보정에 사용해요. */
export function buildCorpusFrequency(
  items: readonly (string | { title: string; tags?: readonly string[] })[],
): Map<string, number> {
  const counts = new Map<string, number>();

  const bump = (rawTag: string) => {
    const normalized = normalizeHashtag(rawTag);
    if (!normalized) return;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  };

  for (const item of items) {
    const title = typeof item === 'string' ? item : item.title;
    const explicitTags = typeof item === 'string' ? undefined : item.tags;

    const { cleanTitle, tags } = stripInlineHashtags(title);
    for (const tag of tags) bump(tag);
    if (explicitTags) {
      for (const tag of explicitTags) bump(tag);
    }

    // 태그 없는 순수 제목에서도 핵심 명사 빈도를 함께 반영해 반복 주제를 포착해요.
    const { allTokens } = tokenizeCleanText(
      cleanTitle === title.trim() && tags.length > 0 ? '' : cleanTitle,
    );
    const seenInItem = new Set<string>();
    for (const token of allTokens) {
      const tag = normalizeHashtag(token);
      if (!tag || seenInItem.has(tag)) continue;
      seenInItem.add(tag);
      bump(tag);
    }
  }

  return counts;
}

/**
 * 자연어 일정/할 일 제목에서 내부 해시태그를 자동 추출해요.
 * 1) 명시적 `#태그` 우선 수집
 * 2) 한국어 조사 어간 분리 + 불용어/시간/수치 필터 + 복합 명사 결합
 * 3) RAKE(deg/freq) + 사용자 카테고리 선호 태그 + 코퍼스 빈도 + 도메인 패싯 보정
 * 4) 복합 태그 선택 시 중복 하위 토큰 제거
 */
export function extractAutoHashtags(title: string, options: AutoTagOptions = {}): string[] {
  const level = normalizeTagExtractionLevel(options.level ?? DEFAULT_TAG_EXTRACTION_LEVEL);
  const cfg = TAG_LEVEL_CONFIG[level];
  const maxTags = Math.max(1, options.maxTags ?? cfg.maxTags);
  const { cleanTitle, tags: explicitTags } = stripInlineHashtags(title);

  // 제목 전체가 `#태그`만으로 구성된 경우에는 명시적 태그만 돌려줘요.
  const onlyExplicit =
    explicitTags.length > 0 && cleanTitle === title.trim() && title.trim().startsWith('#');
  if (onlyExplicit) {
    return explicitTags.slice(0, maxTags);
  }

  const preferredSet = new Set<string>();
  const preferredKeywords = new Map<string, string>();
  if (options.preferredTags) {
    for (const rawPref of options.preferredTags) {
      const normalized = normalizeHashtag(rawPref);
      if (normalized) {
        preferredSet.add(normalized);
        preferredKeywords.set(normalized.slice(1), normalized);
      }
    }
  }

  const { phrases, allTokens, compounds } = tokenizeCleanText(cleanTitle);
  const freq = new Map<string, number>();
  const deg = new Map<string, number>();
  const firstIndex = new Map<string, number>();

  for (let i = 0; i < allTokens.length; i += 1) {
    const token = allTokens[i];
    if (!firstIndex.has(token)) firstIndex.set(token, i);
  }

  for (const phrase of phrases) {
    const phraseLen = phrase.length;
    for (const token of phrase) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
      deg.set(token, (deg.get(token) ?? 0) + phraseLen);
    }
  }

  const candidateScores = new Map<string, number>();
  const compoundPartsByTag = new Map<string, [string, string]>();

  const bumpScore = (rawKey: string, delta: number) => {
    const normalized = normalizeHashtag(rawKey);
    if (!normalized) return;
    const key = normalized.slice(1);
    candidateScores.set(key, (candidateScores.get(key) ?? 0) + delta);
  };

  const totalTokens = Math.max(1, allTokens.length);
  for (const [token, tokenFreq] of freq.entries()) {
    const tokenDeg = deg.get(token) ?? tokenFreq;
    const rake = tokenDeg / tokenFreq;
    const posIdx = firstIndex.get(token) ?? 0;
    // 한국어 일정 제목은 핵심 목적 명사가 중앙~후반에 위치하는 경우가 많아 완만한 위치 가중을 줘요.
    const positionBonus = totalTokens > 1 ? 0.15 + (posIdx / totalTokens) * 0.25 : 0.2;
    let score = rake + tokenFreq * 0.4 + positionBonus;

    const asTag = `#${token}`;
    if (preferredSet.has(asTag)) {
      score += 2.5;
    }
    const corpusCount = options.corpusFreq?.get(asTag) ?? 0;
    if (corpusCount > 1) {
      score += Math.min(2.0, Math.log1p(corpusCount) * 0.85);
    }

    bumpScore(token, score);
  }

  // 복합어 후보에는 높은 결합 점수를 부여해요.
  for (const compound of compounds) {
    compoundPartsByTag.set(compound.tag, compound.parts);
    const asTag = `#${compound.tag}`;
    let compoundScore = 3.2;
    if (preferredSet.has(asTag)) compoundScore += 2.0;
    const corpusCount = options.corpusFreq?.get(asTag) ?? 0;
    if (corpusCount > 1) compoundScore += Math.min(1.6, Math.log1p(corpusCount) * 0.7);
    bumpScore(compound.tag, compoundScore);
  }

  // 추출 강도에 따라 도메인 패싯 추론 적용 폭을 조절해요 (1단계는 원문 키워드만 유지).
  const tokenSet = new Set([...allTokens, ...compounds.map((c) => c.tag)]);
  if (level >= 2) {
    for (const rule of DOMAIN_FACET_RULES) {
      let hits = 0;
      for (const kw of rule.keywords) {
        if (tokenSet.has(kw)) hits += 1;
      }
      const allowFacet = level === 2 ? hits >= 2 || allTokens.length <= 1 : hits > 0;
      if (allowFacet) {
        let facetScore = rule.minScore + (hits - 1) * 0.7 + (level >= 4 ? 0.35 : 0);
        const asTag = `#${rule.tag}`;
        if (preferredSet.has(asTag)) facetScore += 1.5;
        const corpusCount = options.corpusFreq?.get(asTag) ?? 0;
        if (corpusCount > 1) facetScore += Math.min(1.2, Math.log1p(corpusCount) * 0.5);
        bumpScore(rule.tag, facetScore);
      }
    }
  }

  // 사용자 선호 태그와 부분 문자열이 겹치면 가산점을 줘요.
  for (const [prefKey] of preferredKeywords.entries()) {
    for (const token of allTokens) {
      if (token !== prefKey && (token.includes(prefKey) || prefKey.includes(token))) {
        bumpScore(prefKey, 1.8);
      }
    }
  }

  const rankedEntries = [...candidateScores.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], 'ko');
  });
  const ranked = rankedEntries.map(([key]) => key);

  const result: string[] = [];
  const usedTags = new Set<string>();
  const suppressedTokens = new Set<string>();
  const suppressSubTokens = level < 5;

  for (const explicit of explicitTags) {
    if (result.length >= maxTags) break;
    if (!usedTags.has(explicit)) {
      usedTags.add(explicit);
      result.push(explicit);
      if (suppressSubTokens) {
        const parts = compoundPartsByTag.get(explicit.slice(1));
        if (parts) {
          suppressedTokens.add(parts[0]);
          suppressedTokens.add(parts[1]);
        }
      }
    }
  }

  // 먼저 복합어 선택으로 가려질 하위 토큰 집합을 고득점 순서로 결정해요 (5단계에서는 하위 단어도 보존).
  const chosenCompoundParts = new Set<string>();
  if (suppressSubTokens) {
    for (const key of ranked) {
      if (result.length + chosenCompoundParts.size / 2 >= maxTags + 2) break;
      const parts = compoundPartsByTag.get(key);
      if (parts) {
        chosenCompoundParts.add(parts[0]);
        chosenCompoundParts.add(parts[1]);
      }
    }
  }

  for (const [key, score] of rankedEntries) {
    if (result.length >= maxTags) break;
    const tag = normalizeHashtag(key);
    if (!tag || usedTags.has(tag)) continue;

    // 이미 선택되거나 상위 복합어에 흡수된 단일 하위 토큰은 중복을 줄이기 위해 건너뛰어요.
    if (
      suppressSubTokens &&
      (suppressedTokens.has(key) || (chosenCompoundParts.has(key) && !preferredSet.has(tag)))
    ) {
      continue;
    }

    // 설정된 추출 강도 기준 점수 미만은 제외하되, 0개가 되지 않게 최상위 1개는 허용해요.
    if (score < cfg.minScore && result.length > 0) {
      continue;
    }

    usedTags.add(tag);
    result.push(tag);
    if (suppressSubTokens) {
      const parts = compoundPartsByTag.get(key);
      if (parts) {
        suppressedTokens.add(parts[0]);
        suppressedTokens.add(parts[1]);
      }
    }
  }

  return result;
}
