import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// 사진함에 올릴 사진을 고르고, 올리기 전에 작게 만들어요. 저장소 호출은 data.ts가 해요.
// 원본(폰 사진은 몇 MB)을 그대로 올리지 않고 긴 변 기준으로 줄여서 WebP로 바꿔요.

/** 본문에 넣을 사진의 긴 변(px) */
const FULL_SIDE = 1600;
/** 사진함 목록에 보여 줄 작은 그림의 긴 변(px) */
const THUMB_SIDE = 320;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** 줄여서 파일로 만든 그림. 저장소에 그대로 올려요. */
export interface ShrunkImage {
  blob: Blob;
  mime: string;
}

/** 기기 사진첩에서 사진을 여러 장 골라요. 취소하면 빈 목록이에요. */
export async function pickImages(): Promise<PickedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** 본문용 큰 그림과 목록용 작은 그림을 만들어요. */
export async function shrinkForUpload(image: PickedImage) {
  const [full, thumb] = await Promise.all([
    shrink(image, FULL_SIDE, 0.82),
    shrink(image, THUMB_SIDE, 0.7),
  ]);
  return { full, thumb };
}

/** 긴 변이 maxSide를 넘으면 비율을 지켜 줄이고 WebP로 저장해요. */
async function shrink(image: PickedImage, maxSide: number, compress: number): Promise<ShrunkImage> {
  const context = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > maxSide) {
    // 한쪽만 정하면 다른 쪽은 비율대로 맞춰져요.
    context.resize(image.width >= image.height ? { width: maxSide } : { height: maxSide });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.WEBP, compress });
  const blob = await (await fetch(saved.uri)).blob();
  // 웹 브라우저가 WebP를 못 만들면 PNG로 줘요. 실제로 만들어진 형식으로 올려요.
  const mime = blob.type === 'image/png' || blob.type === 'image/jpeg' ? blob.type : 'image/webp';
  return { blob, mime };
}

/** 형식에 맞는 파일 끝 이름 */
export function extensionOf(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  return 'webp';
}
