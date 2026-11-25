import { palette } from '@noteapp/ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';

interface Props {
  fileId: string;
  /** 파일 id로 볼 수 있는 주소(서명된 URL)를 받아요. */
  resolve: (fileId: string) => Promise<string>;
  /** 여러 장을 옆으로 넘겨 볼 때는 높이를 정해 두고 너비를 비율대로 맞춰요. */
  inRow?: boolean;
}

/** 본문에 넣은 사진 한 장. 주소를 받아 오고, 사진 비율대로 보여줘요. */
export function FileImage({ fileId, resolve, inRow }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    resolve(fileId)
      .then((next) => {
        if (!alive) return;
        setUrl(next);
        // 사진의 가로세로 비율을 알아야 찌그러지지 않게 보여줄 수 있어요.
        Image.getSize(
          next,
          (w, h) => alive && h > 0 && setRatio(w / h),
          () => alive && setRatio(1),
        );
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [fileId, resolve]);

  if (failed) {
    return (
      <View className="items-center justify-center rounded-lg bg-muted px-4 py-6">
        <Text className="text-sm text-muted-foreground">사진을 불러오지 못했어요</Text>
      </View>
    );
  }
  if (!url || !ratio) {
    return (
      <View
        className={`items-center justify-center rounded-lg bg-muted ${inRow ? 'h-64 w-64' : 'h-48'}`}
      >
        <ActivityIndicator color={palette.mutedForeground} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel="본문 사진"
      resizeMode="cover"
      className={`rounded-lg bg-muted ${inRow ? 'h-64' : 'w-full max-w-2xl'}`}
      // 비율은 사진마다 달라서 화면에서 계산한 값을 그대로 써요.
      style={{ aspectRatio: ratio }}
    />
  );
}

/** 이어진 사진 여러 장. 옆으로 넘겨 봐요(SNS 게시물처럼). */
export function FileImageRow({
  fileIds,
  resolve,
}: {
  fileIds: string[];
  resolve: (fileId: string) => Promise<string>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {fileIds.map((id) => (
        <FileImage key={id} fileId={id} resolve={resolve} inRow />
      ))}
    </ScrollView>
  );
}
