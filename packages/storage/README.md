# @noteapp/storage (담당: D)

파일 업로드·다운로드는 이 패키지의 `FileStorage`로만 해요. 지금은 Supabase Storage, 나중에 S3 호환 저장소로 바꿀 수 있게 하기 위해서예요. 자세한 이유는 `docs/decisions/0003-file-storage.md`에 있어요.

지킬 규칙은 다섯 가지예요.

1. 업로드는 서명된 URL로 앱이 저장소에 직접 보내요. 서버를 거치지 않아요.
2. DB(`files` 테이블)에는 파일 키만 저장하고, URL은 읽을 때마다 만들어요.
3. 저장소 호출은 이 패키지에만 둬요.
4. `files` 테이블에 소유자·크기·형식·상태(pending/ready)를 기록해요.
5. 무거운 파일 처리는 작업 단위로 나눠요. 지금은 Edge Function, 나중엔 별도 워커예요.

## 쓰는 법

앱에서는 `@/lib/storage`의 `getFileStorage()`로 받아서 써요. 버킷은 `media`이고, 경로는 `<내 user id>/<파일 이름>` 모양이어야 해요(다른 폴더는 저장소 정책이 막아요).

```ts
import { uploadFile } from '@noteapp/storage';
import { getFileStorage } from '@/lib/storage';

const storage = getFileStorage();
const target = await storage.createUploadUrl(`${userId}/photo.webp`, 'image/webp');
await uploadFile(target, blob, 'image/webp'); // 서명된 URL로 저장소에 직접 올려요
// 올린 뒤 files 테이블에 key, mime, size를 기록해요 (mapper: toFileInsert)
const url = await storage.createDownloadUrl(target.key); // 읽을 때마다 새로 만들어요
```

`files` 테이블은 실시간(Realtime)에 올라가 있어서, 새 행이 생기면 같은 계정의 다른 기기가 바로 알 수 있어요.
