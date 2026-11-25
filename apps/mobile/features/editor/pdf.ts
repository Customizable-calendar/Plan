import * as DocumentPicker from 'expo-document-picker';

import { extractPaper, type PaperExtract, type PdfInfo } from './paper';

// 논문 PDF를 고르고, 글을 뽑아요. 글 뽑기는 기기 안에서 해요(unpdf, PDF.js 기반). 서버로 보내지 않아요.

/** PDF 하나는 30MB까지 (저장소 한도와 같아요) */
export const PDF_MAX_BYTES = 30 * 1024 * 1024;

export interface PickedPdf {
  uri: string;
  name: string;
  size: number;
}

/** PDF 파일 하나를 골라요. 취소하면 null */
export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const file = result.assets[0];
  return { uri: file.uri, name: file.name, size: file.size ?? 0 };
}

/** 고른 PDF의 내용(바이트) */
export async function readPdfBlob(pdf: PickedPdf): Promise<Blob> {
  return (await fetch(pdf.uri)).blob();
}

/** PDF 글에서 논문 정보, 초록, 키워드, 서론을 찾아요. */
export async function extractFromPdf(blob: Blob): Promise<PaperExtract> {
  // PDF.js는 커서 처음 쓸 때만 불러와요.
  const { extractText, getDocumentProxy, getMeta } = await import('unpdf');
  const document = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
  try {
    // 앞쪽 몇 쪽에 초록과 서론이 있어서 여섯 쪽까지만 읽어요.
    const { text } = await extractText(document, { mergePages: false });
    const { info } = await getMeta(document);
    return extractPaper(text.slice(0, 6), info as PdfInfo);
  } finally {
    // 읽느라 쓴 메모리를 비워요.
    await document.cleanup();
  }
}
