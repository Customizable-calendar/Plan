export interface EmbeddingModelFile {
  name: string;
  url: string;
  bytes: number;
}

export interface EmbeddingModelPack {
  id: string;
  label: string;
  license: string;
  note: string;
  dir: string;
  files: EmbeddingModelFile[];
}

export class EmbeddingStorageError extends Error {
  override cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

// Model2Vec BGE-M3 증류 다국어 정적 임베딩(MIT 라이선스), 커밋 해시 고정.
const BASE_URL =
  'https://huggingface.co/natzx94/potion-multilingual-128M-int8/resolve/aad5bc103f55245ba729ed177265fd6e2cfa0b44/';

export const EMBEDDING_MODEL: EmbeddingModelPack = {
  id: 'potion-multilingual-int8',
  label: '다국어 의미 임베딩 (Potion int8)',
  license: 'MIT',
  note: 'BGE-M3 증류, 한국어 및 영어 지원, MIT 라이선스, 약 142MB',
  dir: 'potion-multilingual-128m-int8',
  files: [
    {
      name: 'tokenizer.json',
      url: `${BASE_URL}tokenizer.json`,
      bytes: 18_616_131,
    },
    {
      name: 'model.safetensors',
      url: `${BASE_URL}model.safetensors`,
      bytes: 130_091_948,
    },
  ],
};

export const EMBEDDING_MODEL_BYTES = EMBEDDING_MODEL.files.reduce((sum, f) => sum + f.bytes, 0);
