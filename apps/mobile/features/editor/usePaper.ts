import { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { fileBlob, fileUrl, uploadPdf } from './data';
import { applyPaper, fileLine, type PaperExtract, type PaperPart } from './paper';
import { extractFromPdf, pickPdf } from './pdf';

/**
 * 연구논문 문서의 논문 PDF 다루기: 붙이기, 열기, 초록과 서론 뽑기, 고른 것 본문에 넣기.
 * body는 지금 본문, setBody는 본문을 바꾸는 함수예요(편집기의 edit).
 */
export function usePaper(body: string, setBody: (body: string) => void) {
  const [sheet, setSheet] = useState<PaperExtract | 'loading' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

  async function extract(blob: Blob) {
    try {
      setSheet(await extractFromPdf(blob));
    } catch (e) {
      setSheet({});
      setError(`PDF 글을 읽지 못했어요. 글이 아닌 그림으로 된 PDF일 수 있어요. (${message(e)})`);
    }
  }

  /** PDF를 골라 문서 맨 위에 붙이고, 바로 초록과 서론을 찾아 보여줘요. */
  async function attach() {
    const pdf = await pickPdf();
    if (!pdf) return;
    setError(null);
    setSheet('loading');
    const blob = await (await fetch(pdf.uri)).blob();
    // 올리기와 글 뽑기를 함께 해요. 올리지 못해도(로그인 전 등) 뽑은 내용은 넣을 수 있어요.
    const [uploaded] = await Promise.allSettled([uploadPdf(blob), extract(blob)]);
    if (uploaded.status === 'fulfilled') {
      setBody(`${fileLine(pdf.name, uploaded.value)}\n\n${body}`);
    } else {
      setError(`${message(uploaded.reason)} 찾은 내용은 그대로 넣을 수 있어요.`);
    }
  }

  /** 파일 카드 버튼: 열기(새 창이나 PDF 보기 앱), 다시 뽑기 */
  async function onFile(fileId: string, action: 'open' | 'extract') {
    setError(null);
    // 웹 브라우저는 누른 뒤 기다렸다가 여는 새 창을 팝업으로 막아요. 그래서 누르자마자 빈 창을 먼저 열어 둬요.
    const tab = action === 'open' && Platform.OS === 'web' ? window.open('', '_blank') : null;
    try {
      if (action === 'open') {
        const url = await fileUrl(fileId);
        if (tab) tab.location.href = url;
        else await Linking.openURL(url);
        return;
      }
      setSheet('loading');
      await extract(await fileBlob(fileId));
    } catch (e) {
      tab?.close();
      setSheet({});
      setError(message(e));
    }
  }

  function apply(parts: PaperPart[]) {
    if (sheet && sheet !== 'loading') setBody(applyPaper(body, sheet, parts));
    close();
  }

  function close() {
    setSheet(null);
    setError(null);
  }

  return { sheet, error, attach, onFile, apply, close };
}
