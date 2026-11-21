import { Button, palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import {
  listPhotos,
  type Photo,
  type PhotoAccess,
  photoAccess,
  uploadPhoto,
  watchPhotos,
} from './data';
import { pickImages } from './photos';

interface Props {
  onClose: () => void;
}

/**
 * 편집기 안 「내 사진함」 칸. 내가 올린 사진을 최근 것부터 가로로 보여줘요.
 * 폰이나 다른 기기에서 올린 사진도 실시간으로 바로 나타나요.
 */
export function PhotoTray({ onClose }: Props) {
  const [access, setAccess] = useState<PhotoAccess | null>(null);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [busy, setBusy] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(() => {
    listPhotos()
      .then(setPhotos)
      .catch((e: Error) => setMessage(e.message));
  }, []);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    void photoAccess().then((next) => {
      if (!alive) return;
      setAccess(next);
      if (next !== 'ready') return;
      reload();
      stop = watchPhotos(reload);
    });
    return () => {
      alive = false;
      stop?.();
    };
  }, [reload]);

  async function upload() {
    setMessage(null);
    const picked = await pickImages();
    if (picked.length === 0) return;
    setBusy((n) => n + picked.length);
    // 한 장씩 올려요. 한 장이 실패해도 나머지는 계속 올려요.
    for (const image of picked) {
      try {
        await uploadPhoto(image);
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    reload();
  }

  return (
    <View className="gap-2 border-t border-border bg-card px-3 pb-2 pt-2.5">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-[15px] font-semibold text-foreground">내 사진함</Text>
        {access === 'ready' ? (
          <Button size="sm" variant="soft" disabled={busy > 0} onPress={() => void upload()}>
            <Text className="text-sm font-medium text-primary-soft-foreground">
              {busy > 0 ? `${busy}장 올리는 중` : '사진 올리기'}
            </Text>
          </Button>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="사진함 닫기"
          hitSlop={8}
          onPress={onClose}
          className="h-8 w-8 items-center justify-center rounded-md active:bg-muted"
        >
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            size={18}
            tintColor={palette.mutedForeground}
          />
        </Pressable>
      </View>

      {access === null ? (
        <ActivityIndicator color={palette.mutedForeground} />
      ) : access === 'unavailable' ? (
        <Note text="이 빌드는 계정 연결이 꺼져 있어서 사진함을 쓸 수 없어요." />
      ) : access === 'signed-out' ? (
        <Note text="설정의 계정 칸에서 로그인하면 사진함을 쓸 수 있어요. 폰에서 올린 사진이 여기에 바로 보여요." />
      ) : photos === null ? (
        <ActivityIndicator color={palette.mutedForeground} />
      ) : photos.length === 0 ? (
        <Note text="아직 올린 사진이 없어요. 폰이나 다른 기기에서 올려도 여기에 바로 보여요." />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {photos.map((photo) => (
            <View key={photo.id} className="h-20 w-20 overflow-hidden rounded-md bg-muted">
              {photo.thumbUrl ? (
                <Image
                  source={{ uri: photo.thumbUrl }}
                  accessibilityLabel="사진"
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="flex-1 items-center justify-center gap-1">
                  <ActivityIndicator size="small" color={palette.mutedForeground} />
                  <Text className="text-[11px] text-muted-foreground">올리는 중</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {message ? <Text className="text-xs text-destructive">{message}</Text> : null}
    </View>
  );
}

function Note({ text }: { text: string }) {
  return <Text className="py-2 text-sm leading-5 text-muted-foreground">{text}</Text>;
}
