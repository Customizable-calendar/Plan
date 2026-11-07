import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

// 왼쪽 메뉴(LNB)를 여닫는 상태를 앱 전체가 같이 써요. (담당: D)
// Context: 여러 화면이 같은 값을 props 없이 꺼내 쓰게 해 주는 React 기능이에요.
interface LnbState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

const LnbContext = createContext<LnbState>({ open: false, show: () => {}, hide: () => {} });

export function LnbProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({ open, show: () => setOpen(true), hide: () => setOpen(false) }),
    [open],
  );
  return <LnbContext.Provider value={value}>{children}</LnbContext.Provider>;
}

export function useLnb() {
  return useContext(LnbContext);
}
