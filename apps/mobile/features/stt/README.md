# 받아쓰기

- **담당**: B
- **하는 일**: 말한 내용을 기기 안에서 한국어 글로 바꿔요. [whisper.rn](https://github.com/mybigday/whisper.rn)(whisper.cpp, MIT)을 써서 서버, API 키, 요금이 없어요. 소리는 기기 밖으로 안 나가요.
- **화면**: `/stt` (모델 받기, 말하기, 받아쓴 글로 카드 찾기)
- **데이터**: 서버 데이터 없음. 모델 파일은 기기 `Documents/stt/`, 받아쓰는 중인 녹음은 `Documents/stt/session/`에 있어요.
- **다른 기능에 주는 것**: `useDictation`, `startDictation`, `isSttAvailable`, `leftoverSeconds`, `discardLeftover`, `MODELS`, `isDownloaded`
- **받는 것**: 카드(cards)의 `findCardsFromTranscript` (받아쓰기가 끝나면 회의록에서 일정, 약속, 할 일을 찾아 확인 기다리는 카드로 넣어요)

## 꼭 알아 둘 것

- **Expo Go에서는 안 돼요.** `whisper.rn`과 녹음(`@fugood/react-native-audio-pcm-stream`)이 네이티브 모듈이에요. EAS 개발 빌드가 있어야 해요(#5). Expo Go에서는 `isSttAvailable()`이 `false`이고 화면에 안내만 나와요. 앱이 죽지는 않아요.
- **모델은 처음 쓸 때 받아요.** 앱에 넣으면 너무 커서요.

  | 모델                      | 크기  | 쓰임             |
  | ------------------------- | ----- | ---------------- |
  | `small` (ggml-small-q5_1) | 190MB | 한국어 추천      |
  | `base` (ggml-base-q5_1)   | 60MB  | 짧은 말, 느린 폰 |

- **긴 녹음**: 최대 3시간. 말이 쉬는 곳에서 20~30초 조각으로 잘라(`chunker.ts`) 녹음하는 동안 뒤에서 차례로 받아써요. 그래서 말하는 동안 글이 조각마다 늘어나고, 메모리는 조각 하나(약 1MB)만큼만 써요. 말이 없는 조각은 받아쓰지 않아요(없는 말을 지어내지 않게).
- **앱이 꺼져도 이어서**: 조각과 받아쓴 글을 기기 `Documents/stt/session/`에 적어 둬요(`session.ts`). 다음에 화면을 열면 "이어서 받아쓰기"가 나와요. 끝내거나 버리면 지워요. 기기 밖으로는 안 나가요.
- 녹음하는 동안 화면이 꺼지지 않게 해요(`expo-keep-awake`). 앱을 나가면 녹음이 멈출 수 있어요. 백그라운드 녹음은 네이티브 설정(포그라운드 서비스)이 필요해서 아직 안 해요.
- 누가 말했는지 나누는 화자 구분은 아직 안 해요.

## 다른 화면에 붙이기 (예: 편집기 녹음 버튼)

```tsx
import { isDownloaded, isSttAvailable, MODELS, useDictation } from '@/features/stt';

const model = MODELS.find(isDownloaded); // 받아 둔 모델이 없으면 router.push('/stt')로 보내요
const { state, start, finish } = useDictation(model!);
// state.phase: idle → recording(seconds, partial, backlog) → transcribing(ratio) → done(result.text) | error(message)
```

## M1 할 일

- [x] 모델 받기, 지우기, 받는 중 멈추기
- [x] 녹음하고 기기 안에서 받아쓰기, 받아쓴 글로 카드 찾기
- [ ] EAS 개발 빌드에서 iOS, Android 실제 확인 (#5)
- [x] 긴 녹음(조각 받아쓰기), 말하는 동안 조각마다 글 보이기, 앱이 꺼지면 이어서 받아쓰기
- [ ] 백그라운드 녹음 (Android 포그라운드 서비스, APK 새로 필요)
- [ ] 편집기 녹음 버튼에 붙이기 (A와 같이)
