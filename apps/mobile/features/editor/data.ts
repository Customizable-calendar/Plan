import {
  type CalendarEvent,
  type Document,
  type FileMeta,
  type FileRow,
  type Template,
  fixtures,
  templates,
  toFileInsert,
  toFileMeta,
} from '@noteapp/shared';
import { uploadFile } from '@noteapp/storage';

import { loginRequired } from '@/lib/auth';
import { dataSource, fromFixture } from '@/lib/data-source';
import { findDocument, listAllDocuments, putDocument } from '@/lib/documents';
import { getFileStorage } from '@/lib/storage';
import { getSupabase } from '@/lib/supabase';

import { monthDay } from './format';
import { PDF_MAX_BYTES } from './pdf';
import { extensionOf, type PickedImage, shrinkForUpload } from './photos';

// 편집기 데이터는 여기서만 가져오고 저장해요. 화면은 이 파일 함수만 불러요.
// 문서는 lib/documents.ts(docs_documents)에 저장해요: 기기에 먼저, 로그인하면 계정에도.

export interface EditorData {
  document: Document;
  template: Template | undefined;
}

/**
 * 문서를 열어요. id가 'new'면 templateId 양식으로 빈 문서를 새로 만들어요.
 * seed가 있으면 새 문서 본문 맨 위에 그대로 넣어요. (미완성 세션의 메모 원문)
 * 문서를 못 찾으면 null이에요.
 */
export async function openDocument(
  id: string,
  templateId?: string,
  seed?: string,
): Promise<EditorData | null> {
  if (id === 'new') {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return null;
    return { document: newDraft(template, seed), template };
  }

  const document = await findDocument(id);
  if (!document) return null;
  return { document, template: templates.find((t) => t.id === document.templateId) };
}

/** 고친 문서를 저장해요. 앱을 다시 켜도 남아요. */
export async function saveDocument(document: Document): Promise<void> {
  await putDocument(document);
}

/** 저장된 문서 전부(예전 이름 그대로). 세션 목록이 써요. */
export async function listEditedDocuments(): Promise<Document[]> {
  return listAllDocuments();
}

/** `/캘` 슬래시 명령에서 고를 일정. M2에는 캘린더(C)의 index.ts에서 내보낸 함수로 바꿔요. */
export async function listEventsForSlash(): Promise<CalendarEvent[]> {
  if (dataSource !== 'fixtures') return [];
  return fromFixture([...fixtures.events].sort((a, b) => a.startAt.localeCompare(b.startAt)));
}

// ---- 내 사진함 ----
// 사진은 저장소(media 버킷, "<내 user id>/<파일>")에, 정보는 files 테이블에 둬요.
// 로그인한 사람만 써요. 다른 기기에서 올린 사진도 실시간으로 바로 보여요.

/** 사진함에 보여 줄 사진 한 장 */
export interface Photo {
  id: string;
  /** 본문에 넣을 그림의 저장소 경로 */
  key: string;
  /** 목록 작은 그림 주소(서명된 URL). 올리는 중이면 없어요. */
  thumbUrl?: string;
  uploading: boolean;
}

/** 사진함을 쓸 수 있는지. 계정 연결이 없는 빌드면 'unavailable', 로그인 전이면 'signed-out' */
export type PhotoAccess = 'ready' | 'signed-out' | 'unavailable';

export async function photoAccess(): Promise<PhotoAccess> {
  if (!loginRequired) return 'unavailable';
  const { data } = await getSupabase().auth.getSession();
  return data.session ? 'ready' : 'signed-out';
}

// 서명된 URL은 한 시간 동안 쓸 수 있어서, 목록을 다시 읽을 때마다 새로 만들지 않고 50분 동안 다시 써요.
const URL_SECONDS = 3600;
const urlCache = new Map<string, { url: string; until: number }>();

async function signedUrl(key: string): Promise<string> {
  const cached = urlCache.get(key);
  if (cached && cached.until > Date.now()) return cached.url;
  const url = await getFileStorage().createDownloadUrl(key, URL_SECONDS);
  urlCache.set(key, { url, until: Date.now() + (URL_SECONDS - 600) * 1000 });
  return url;
}

/** 내 사진 최근 것부터 60장 */
export async function listPhotos(): Promise<Photo[]> {
  const { data, error } = await getSupabase()
    .from('files')
    .select('*')
    .like('mime', 'image/%')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(`사진함을 불러오지 못했어요. (${error.message})`);

  const files = (data as FileRow[]).map(toFileMeta);
  return Promise.all(
    files.map(async (file): Promise<Photo> => {
      const uploading = file.status !== 'ready';
      const thumbKey = file.thumbnailKey ?? file.key;
      return {
        id: file.id,
        key: file.key,
        uploading,
        thumbUrl: uploading ? undefined : await signedUrl(thumbKey),
      };
    }),
  );
}

/**
 * 사진 한 장을 올려요. 순서: 줄이기, files에 '올리는 중'으로 적기, 저장소에 올리기, '다 올림'으로 바꾸기.
 * 먼저 적어 두기 때문에 다른 기기 사진함에도 올리는 중인 칸이 바로 생겨요.
 * 중간에 실패하면 적어 둔 줄과 올린 파일을 지워요.
 */
export async function uploadPhoto(image: PickedImage): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('로그인한 뒤에 사진을 올릴 수 있어요.');

  const { full, thumb } = await shrinkForUpload(image);
  const id = randomId();
  const meta: FileMeta = {
    id,
    key: `${userId}/${id}.${extensionOf(full.mime)}`,
    thumbnailKey: `${userId}/${id}_thumb.${extensionOf(thumb.mime)}`,
    mime: full.mime,
    size: full.blob.size,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const inserted = await supabase.from('files').insert(toFileInsert(meta));
  if (inserted.error) throw new Error(`사진을 올리지 못했어요. (${inserted.error.message})`);

  const storage = getFileStorage();
  try {
    const keys = [meta.key, meta.thumbnailKey as string];
    const [fullTarget, thumbTarget] = await Promise.all([
      storage.createUploadUrl(keys[0], full.mime),
      storage.createUploadUrl(keys[1], thumb.mime),
    ]);
    await Promise.all([
      uploadFile(fullTarget, full.blob, full.mime),
      uploadFile(thumbTarget, thumb.blob, thumb.mime),
    ]);
    const done = await supabase.from('files').update({ status: 'ready' }).eq('id', id);
    if (done.error) throw new Error(done.error.message);
  } catch (error) {
    await supabase.from('files').delete().eq('id', id);
    await Promise.allSettled([
      storage.remove(meta.key),
      storage.remove(meta.thumbnailKey as string),
    ]);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요. (${reason})`);
  }
}

/**
 * 내 files에 바뀐 게 생기면(다른 기기에서 올리거나 지우면) onChange를 불러요.
 * 실시간(Realtime) 구독이에요. RLS 때문에 내 줄의 변화만 와요. 돌려준 함수를 부르면 구독을 끊어요.
 */
export function watchPhotos(onChange: () => void): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`photos-${randomId()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---- 논문 PDF ----
// PDF도 사진처럼 media 버킷과 files 테이블에 둬요. 본문에는 ![이름](file:<id>) 줄로 붙어요.

/**
 * 논문 PDF를 올리고 files id를 돌려줘요. 사진과 같은 순서예요: '올리는 중'으로 적고, 올리고, '다 올림'.
 * 실패하면 적은 줄과 올린 파일을 지워요.
 */
export async function uploadPdf(blob: Blob): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('로그인한 뒤에 PDF를 붙일 수 있어요.');
  if (blob.size > PDF_MAX_BYTES) throw new Error('PDF는 30MB까지 붙일 수 있어요.');

  const id = randomId();
  const meta: FileMeta = {
    id,
    key: `${userId}/${id}.pdf`,
    mime: 'application/pdf',
    size: blob.size,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  const inserted = await supabase.from('files').insert(toFileInsert(meta));
  if (inserted.error) throw new Error(`PDF를 올리지 못했어요. (${inserted.error.message})`);

  const storage = getFileStorage();
  try {
    await uploadFile(await storage.createUploadUrl(meta.key, meta.mime), blob, meta.mime);
    const done = await supabase.from('files').update({ status: 'ready' }).eq('id', id);
    if (done.error) throw new Error(done.error.message);
    return id;
  } catch (error) {
    await supabase.from('files').delete().eq('id', id);
    await Promise.allSettled([storage.remove(meta.key)]);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF를 올리지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요. (${reason})`);
  }
}

/** 붙인 파일을 열 주소(서명된 URL, 한 시간). 파일이 없으면 안내를 던져요. */
export async function fileUrl(fileId: string): Promise<string> {
  const { data, error } = await getSupabase()
    .from('files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();
  if (error) throw new Error(`파일을 찾지 못했어요. (${error.message})`);
  if (!data) throw new Error('파일을 찾지 못했어요. 지워졌거나 다른 계정의 파일이에요.');
  return signedUrl(toFileMeta(data as FileRow).key);
}

/** 붙인 파일의 내용. 붙인 PDF에서 글을 다시 뽑을 때 써요. */
export async function fileBlob(fileId: string): Promise<Blob> {
  const response = await fetch(await fileUrl(fileId));
  if (!response.ok) throw new Error(`파일을 받지 못했어요. (${response.status})`);
  return response.blob();
}

/** 파일 id(uuid 모양). 겹치지만 않으면 되는 값이라 Math.random으로 만들어요. */
function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

/** 양식으로 만든 새 문서 */
function newDraft(template: Template, seed?: string): Document {
  const now = new Date();
  // 양식에 기본 본문이 있으면 그걸, 없으면 칸 제목을 `## 제목`으로 깔아요.
  const base =
    template.defaultContent ?? template.sections.map((s) => `## ${s.title}\n`).join('\n');
  return {
    id: `draft-${now.getTime()}`,
    templateId: template.id,
    title: `${template.name} ${monthDay(now)}`,
    // seed(메모 원문)는 고치지 않고 양식 본문 위에 그대로 넣어요.
    body: seed ? `${seed}\n\n${base}` : base,
    cardIds: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
