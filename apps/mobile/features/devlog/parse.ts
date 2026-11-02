// 붙여 넣은 일지 마크다운을 섹션과 스터디 질문으로 나눠요.

export interface Section {
  title: string;
  body: string;
}

export interface StudyQuestion {
  question: string;
  answer?: string;
}

export const STUDY_TITLE = '스터디 질문';

/** "## 제목"으로 나눠요. 제목 없는 앞부분은 "메모"로 둬요. */
export function splitSections(text: string): Section[] {
  const out: Section[] = [];
  let current: Section | null = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const h = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (h) {
      current = { title: h[1], body: '' };
      out.push(current);
      continue;
    }
    if (!current) {
      if (!line.trim()) continue;
      current = { title: '메모', body: '' };
      out.push(current);
    }
    current.body += `${line}\n`;
  }
  return out
    .map((s) => ({ title: s.title, body: s.body.trim() }))
    .filter((s) => s.body || s.title !== '메모');
}

/** "스터디 질문" 섹션의 "Q. … / A. …" 짝. 답이 없어도 질문만 모아요. */
export function studyQuestions(text: string): StudyQuestion[] {
  const section = splitSections(text).find((s) => s.title.includes(STUDY_TITLE));
  if (!section) return [];
  const out: StudyQuestion[] = [];
  for (const raw of section.body.split('\n')) {
    const line = raw.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim();
    const q = line.match(/^(?:\*\*)?Q\s*\d*[.:)]\s*(?:\*\*)?\s*(.+)$/i);
    const a = line.match(/^(?:\*\*)?A\s*\d*[.:)]\s*(?:\*\*)?\s*(.+)$/i);
    if (q) out.push({ question: q[1] });
    else if (a && out.length) {
      const last = out[out.length - 1];
      last.answer = last.answer ? `${last.answer}\n${a[1]}` : a[1];
    } else if (line && out.length && out[out.length - 1].answer) {
      out[out.length - 1].answer += `\n${line}`;
    }
  }
  return out;
}
