export type RGB = { r: number; g: number; b: number };

const clamp = (n: number, min = 0, max = 255) => Math.min(max, Math.max(min, n));

export function isHex(value: string) {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB) {
  return '#' + [r, g, b].map((v) => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('');
}

export function normalizeHex(hex: string) {
  return rgbToHex(hexToRgb(hex));
}

/** "196 85% 29%" — NativeWind / shadcn 형식의 HSL 값 (hsl() 없이) */
export function hexToHslTriplet(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return `${round1(h)} ${round1(s * 100)}% ${round1(l * 100)}%`;
}

/** a를 b 쪽으로 amount(0~1)만큼 섞기 */
export function mix(a: string, b: string, amount: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({
    r: x.r + (y.r - x.r) * amount,
    g: x.g + (y.g - x.g) * amount,
    b: x.b + (y.b - x.b) * amount,
  });
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG 대비율 (1~21) */
export function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastGrade(ratio: number) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA 큰 글자';
  return '부족';
}

/** 배경 위에 올릴 글자색: 흰색과 진한 색 중 대비가 큰 쪽 */
export function autoForeground(bg: string, dark = '#15191d', light = '#ffffff') {
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}
