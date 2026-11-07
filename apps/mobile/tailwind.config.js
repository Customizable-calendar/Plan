const { hairlineWidth } = require('nativewind/theme');

const { borderRadius, colors } = require('./design/tailwind-theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 다크 모드는 class로 켜요. media(기본값)면 웹에서 색 모드를 바꿀 때 오류가 나요.
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './shell/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      borderRadius,
      borderWidth: { hairline: hairlineWidth() },
    },
  },
};
