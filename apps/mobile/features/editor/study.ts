import type { Document } from '@noteapp/shared';

import type { StudyContext } from './Preview';
import { dayKey, daysUntil, fieldValue, parseDay, REVIEW_DAYS } from './widgets';

// 학습일지에서 자동으로 채우는 것: 일지 번호(No.), 시험 D-day, 1일, 3일, 7일 전 복습할 일지. 화면 없이 쓰는 순수 함수예요.

/** 일지의 날: '날짜' 칸을 읽고, 비어 있으면 만든 날이에요. */
export function logDay(doc: Document): Date {
  const written = parseDay(fieldValue(doc.body, '날짜'));
  if (written) return written;
  const created = new Date(doc.createdAt);
  return new Date(created.getFullYear(), created.getMonth(), created.getDate());
}

export interface StudyInfo {
  /** 몇 번째 학습일지인지 (만든 순서) */
  number: number;
  /** 시험까지 남은 날. '시험 날짜' 칸이 비었거나 못 읽으면 null */
  dDay: number | null;
  reviews: StudyContext['reviews'];
}

const monthDay = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

/** current: 지금 쓰는 일지, others: 같은 양식으로 쓴 모든 일지(지금 일지가 들어 있어도 돼요) */
export function studyInfo(current: Document, others: Document[]): StudyInfo {
  const rest = others.filter((d) => d.id !== current.id);
  const day = logDay(current);

  const reviews: StudyInfo['reviews'] = {};
  for (const n of REVIEW_DAYS) {
    const target = new Date(day.getFullYear(), day.getMonth(), day.getDate() - n);
    // 그날 쓴 일지가 여러 개면 가장 최근에 고친 것
    const doc = rest
      .filter((d) => dayKey(logDay(d)) === dayKey(target))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    reviews[n] = {
      doc: doc ? { id: doc.id, title: doc.title } : null,
      dateLabel: monthDay(target),
    };
  }

  const exam = parseDay(fieldValue(current.body, '시험 날짜'));
  return {
    number: rest.filter((d) => d.createdAt < current.createdAt).length + 1,
    // 그 일지의 날 기준으로 세요. 종이 플래너처럼 그날 시험까지 며칠 남았는지예요.
    dDay: exam ? daysUntil(exam, day) : null,
    reviews,
  };
}

/** D-day 글: 시험까지 D-8, 시험 날 D-day, 지나면 D+3 */
export function dDayLabel(dDay: number): string {
  if (dDay > 0) return `시험까지 D-${dDay}`;
  if (dDay === 0) return '시험 D-day';
  return `시험 D+${-dDay}`;
}
