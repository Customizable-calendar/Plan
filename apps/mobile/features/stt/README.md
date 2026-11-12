# 받아쓰기

- **담당**: B
- **하는 일**: 말한 내용을 기기 안에서 한국어 글로 바꿔요. [whisper.rn](https://github.com/mybigday/whisper.rn)(whisper.cpp, MIT)을 써서 서버, API 키, 요금이 없어요. 소리는 기기 밖으로 안 나가요.
- **화면**: `/stt` (모델 받기, 말하기, 받아쓴 글로 카드 찾기)
- **데이터**: 서버 데이터 없음. 모델 파일만 기기 `Documents/stt/`에 받아요.
- **다른 기능에 주는 것**: `useDictation`, `startDictation`, `isSttAvailable`, `MODELS`, `isDownloaded`
- **받는 것**: 카드(cards)의 `findCardsFromTranscript` (받아쓰기가 끝나면 회의록에서 일정, 약속, 할 일을 찾아 확인 기다리는 카드로 넣어요)

## 꼭 알아 둘 것

- **Expo Go에서는 안 돼요.** `whisper.rn`과 녹음(`@fugood/react-native-audio-pcm-stream`)이 네이티브 모듈이에요. EAS 개발 빌드가 있어야 해요(#5). Expo Go에서는 `isSttAvailable()`이 `false`이고 화면에 안내만 나와요. 앱이 죽지는 않아요.
- **모델은 처음 쓸 때 받아요.** 앱에 넣으면 너무 커서요.

  | 모델                      | 크기  | 쓰임             |
  | ------------------------- | ----- | ---------------- |
  | `small` (ggml-small-q5_1) | 190MB | 한국어 추천      |
  | `base` (ggml-base-q5_1)   | 60MB  | 짧은 말, 느린 폰 |

- 한 번에 최대 10분까지 받아써요. 소리를 메모리에 모았다가(16kHz 모노 16비트, 10분에 약 19MB) 끝낼 때 한 번에 받아써요.
- 누가 말했는지 나누는 화자 구분은 아직 안 해요.

## 다른 화면에 붙이기 (예: 편집기 녹음 버튼)

```tsx
import { isDownloaded, isSttAvailable, MODELS, useDictation } from '@/features/stt';

const model = MODELS.find(isDownloaded); // 받아 둔 모델이 없으면 router.push('/stt')로 보내요
const { state, start, finish } = useDictation(model!);
// state.phase: idle → recording(seconds) → transcribing(ratio) → done(result.text) | error(message)
```

## M1 할 일

- [x] 모델 받기, 지우기, 받는 중 멈추기
- [x] 녹음하고 기기 안에서 받아쓰기, 받아쓴 글로 카드 찾기
- [ ] EAS 개발 빌드에서 iOS, Android 실제 확인 (#5)
- [ ] 말하는 동안 글이 바로 나오는 실시간 받아쓰기 (`RealtimeTranscriber`)
- [ ] 편집기 녹음 버튼에 붙이기 (A와 같이)
