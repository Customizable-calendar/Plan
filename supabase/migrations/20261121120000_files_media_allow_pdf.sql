-- 연구논문 문서에 논문 PDF를 붙일 수 있게, 사진 버킷(media)에 PDF도 올릴 수 있게 해요.
-- 경로 규칙("<내 user id>/<파일>")과 내 폴더만 쓰는 정책은 그대로예요. files 테이블에도 PDF가 같은 모양으로 적혀요.
-- 논문 PDF는 사진보다 커서 파일 하나 한도를 10MB에서 30MB로 올려요. 사진은 앱이 줄여서 올려서 그대로 작아요.
update storage.buckets
set
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'],
  file_size_limit = 31457280
where id = 'media';
