import { DevMenuScreen } from '@/features/dev';
import { features } from '@/features/registry';

// 개발 메뉴: 라우트 파일은 기능 폴더의 화면에 등록된 기능 목록을 넘겨주기만 해요.
export default function DevRoute() {
  return <DevMenuScreen features={features} />;
}
