import { useEffect, useState } from 'react';

import { dataSource, fromFixture } from '@/lib/data-source';

// 이 기능의 데이터는 여기서만 가져와요. 화면은 아래 함수·훅만 써요.
// M1: 예시 데이터. M2: dataSource === 'supabase'일 때 getSupabase()로 바꿔요. 화면은 그대로예요.
// 다른 기능과 주고받는 타입이면 packages/shared/src/types에 두고 예시 JSON도 함께 추가해요.
export interface SearchItem {
  id: string;
  title: string;
}

const sample: SearchItem[] = [{ id: '1', title: '예시 항목' }];

export async function listSearchItems(): Promise<SearchItem[]> {
  if (dataSource === 'fixtures') return fromFixture(sample);
  throw new Error('search: Supabase 연결은 M2에서 만들어요.');
}

export function useItems() {
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listSearchItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);
  return { items, loading };
}
