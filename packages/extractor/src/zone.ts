// 파서는 Date의 "기기 시간" 필드(getHours 등)로 계산해요.
// 메모 시간대가 기기와 달라도 맞게 돌도록, 시간대 벽시계 ↔ 기기 시간 Date를 오가요.

interface WallClock {
  year: number;
  month: number; // 1~12
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: Date, timeZone: string): WallClock {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, Number(x.value)]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute };
}

/** 그 순간의 timeZone 벽시계를 기기 시간 Date로 (파서 입력용) */
export function toLocalFrame(instant: Date, timeZone: string): Date {
  const w = wallClock(instant, timeZone);
  return new Date(w.year, w.month - 1, w.day, w.hour, w.minute);
}

/** 파서가 돌려준 기기 시간 Date를 timeZone 벽시계로 읽어 실제 순간으로 */
export function fromLocalFrame(local: Date, timeZone: string): Date {
  const target = Date.UTC(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
  );
  // 시간대 오프셋을 한 번 추정하고, 서머타임 경계를 위해 한 번 더 고쳐요.
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const w = wallClock(new Date(guess), timeZone);
    const seen = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
    guess += target - seen;
  }
  return new Date(guess);
}
