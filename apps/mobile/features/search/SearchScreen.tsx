import { ComingSoon } from '@noteapp/ui';

import { useItems } from './data';

export function SearchScreen() {
  const { items, loading } = useItems();
  // TODO(D): items로 화면을 그려요. 다 만들면 ComingSoon을 지워요.
  return (
    <ComingSoon
      variant="screen"
      title="검색"
      description={
        loading ? '불러오는 중' : `메모, 카드, 문서를 한곳에서 찾아요. 예시 ${items.length}개`
      }
      owner="D"
    />
  );
}
