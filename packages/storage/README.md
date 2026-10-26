# @noteapp/storage (담당: D)

파일 업로드·다운로드는 이 패키지의 `FileStorage`로만 해요. 지금은 Supabase Storage, 나중에 S3 호환 저장소로 바꿀 수 있게 하기 위해서예요. 자세한 이유는 `docs/decisions/0003-file-storage.md`에 있어요.

지킬 규칙은 다섯 가지예요.

1. 업로드는 서명된 URL로 앱이 저장소에 직접 보내요. 서버를 거치지 않아요.
2. DB(`files` 테이블)에는 파일 키만 저장하고, URL은 읽을 때마다 만들어요.
3. 저장소 호출은 이 패키지에만 둬요.
4. `files` 테이블에 소유자·크기·형식·상태(pending/ready)를 기록해요.
5. 무거운 파일 처리는 작업 단위로 나눠요. 지금은 Edge Function, 나중엔 별도 워커예요.
