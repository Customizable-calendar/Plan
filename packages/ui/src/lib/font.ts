import * as React from 'react';

/** 화면 전체 글꼴. 실제 앱에서는 expo-font 로 불러온 글꼴 이름을 넣는다. */
export const FontContext = React.createContext<string | undefined>(undefined);

export function useFontStyle() {
  const family = React.useContext(FontContext);
  return family && family !== 'System' ? { fontFamily: family } : undefined;
}
