# 받아쓰기

- **담당**: B
- **하는 일**: 말한 내용을 기기 안에서 한국어 글로 바꿔요. [whisper.rn](https://github.com/mybigday/whisper.rn)(whisper.cpp, MIT)을 써서 서버, API 키, 요금이 없어요. 소리는 기기 밖으로 안 나가요.
- **화면**: `/stt` (모델 받기, 말하기, 받아쓴 글로 카드 찾기)
- **데이터**: 내 지시문만 `stt_transforms` 테이블(로그인하면 계정에도). 받아쓴 글과 소리는 서버에 없어요. 모델 파일은 기기 `Documents/stt/`, 받아쓰는 중인 녹음은 `Documents/stt/session/`에 있어요.
- **다른 기능에 주는 것**: `useDictation`, `startDictation`, `prewarmStt`, `isSttAvailable`, `leftoverSeconds`, `discardLeftover`, `MODELS`, `isDownloaded`
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
- **말소리 감지(VAD)**: whisper.rn 안의 Silero VAD(`ggml-silero-v6.2.0.bin`, 약 0.9MB, MIT)를 처음 받아쓸 때 알아서 받아요(`vad.ts`). 조각마다 사람 말이 있는 곳만 남기고(앞뒤는 잘라 내고 1초 넘게 조용한 곳은 소리를 지워요, `speech.ts`) 말이 없으면 건너뛰어요. 30초가 되도록 쉬는 곳을 못 찾으면 VAD로 제일 길게 쉰 곳에서 잘라요. VAD를 못 받으면 소리 크기만 봐요.
- **정확도**: 밀린 조각이 적으면 후보 5개를 비교해서(beam search) 받아쓰고, 많이 밀리면 빠르게 받아써요. 앞 조각 끝 문장을 다음 조각의 예시로 넘겨서 말이 이어지게 해요. 같은 말 되풀이("감사합니다. 감사합니다…")와 방송 자막 말은 빼요(`text.ts`).
- **미리 받아쓰기**: 조각이 되기 전 말도 1.5초마다 미리 받아써서 회색 글(`state.preview`)로 보여 줘요. 받아쓸 조각이 없을 때만 돌아서 폰이 더 따뜻해지고 배터리를 더 써요. 조각을 받아쓰면 검은 글(`state.partial`)로 바뀌어요.
  - 두 번 연속 똑같이 나온 앞 문장은 고정하고, 다음부터는 그 뒤 소리만 받아써요(`settledCount`, SimulStreaming의 LocalAgreement 방식). 글이 덜 바뀌고 폰이 덜 일해요. 소리 끝에서 1.5초 안에 끝난 문장은 말이 더 이어질 수 있어서 고정하지 않아요.
- **내 단어**: 내 해시태그 카테고리 이름과 태그(`lib/tag-categories`)를 "자주 쓰는 말:" 한 줄로 예시에 넣어요(`wordsLine`, 50자까지). 내가 쓰는 말을 더 맞게 받아써요. `useDictation(model, onDone, { words })`로 넘겨요.
- **시각 붙은 줄과 내보내기**: 받아쓴 덩어리를 문장 단위 줄로 나눠요(`@noteapp/extractor`의 `timedLines`). 문장이 끝나거나, 1.5초 넘게 쉬거나, 7초가 넘으면 줄을 나눠요(SpokenLog 참고). 덩어리 안 문장 시각은 글자 수로 나눠 짐작한 값이에요. 받아쓴 뒤 "시각 붙여 공유"(`[0:05] 문장`)와 "자막(SRT) 공유"로 내보내요.
- **모델 미리 띄우기**: 받아쓰기 화면에서 모델을 고르면 모델과 말소리 감지를 미리 열어 둬요(`prewarmStt`). 녹음 버튼을 누르면 모델을 여는 몇 초를 안 기다려요. 아무도 안 쓴 채로 3분이 지나면 닫아서 메모리를 돌려줘요. 다른 화면에 붙일 때도 녹음 버튼이 보일 때 `prewarmStt(model)`을 불러 주면 좋아요.
- **속도 설정**: iOS는 GPU(Metal)에 flash attention을 켜요. 그 설정으로 못 열면 기본 설정으로 다시 열어요. Android는 whisper.rn이 CPU로만 돌려서(코어가 4개보다 많으면 스레드 4개) 그대로 둬요.
- 녹음하는 동안 화면이 꺼지지 않게 해요(`expo-keep-awake`). 앱을 나가면 녹음이 멈출 수 있어요. 백그라운드 녹음은 네이티브 설정(포그라운드 서비스)이 필요해서 아직 안 해요.
- 누가 말했는지 나누는 화자 구분은 아직 안 해요.
- **AI로 정리하기 (팀 AI)**: 받아쓴 뒤 팀 AI(서버에 둔 팀 Claude 키, `lib/team-ai`, docs/decisions/0005)로 정리해요(`ai.ts`, 화면은 `TranscriptAi.tsx`). **받아쓴 글만** 보내고 소리는 안 보내요. 로그인한 팀원만 써요. 키 입력은 없어요.
  - **요약하고 카드 다시 찾기**: 규칙으로 찾은 카드 중 확인 안 한 건 AI가 찾은 카드로 바뀌어요.
  - **지시문으로 바꾸기**(Whispering의 transformation 참고): "회의록으로 정리", "할 일만 뽑기", "공유 메일 초안" 기본 지시문과 내가 만든 지시문을 받아쓴 글에 적용해요. 받아쓴 글은 그대로 두고 결과만 보여 주고 공유해요(결과는 저장 안 해요).
  - 내 지시문은 `stt_transforms` 테이블이에요(`transforms.ts`, 메모와 같은 local-first). `EXPO_PUBLIC_SUPABASE_FEATURES`에 `stt`가 있으면 계정에도 저장해요.
  - 지시문 하나를 "받아쓰기 끝나면 자동으로"로 고르면 받아쓰기가 끝날 때 바로 돌려요. 이 선택은 이 기기에만 기억해요.

## 다른 화면에 붙이기 (예: 편집기 녹음 버튼)

```tsx
import { isDownloaded, isSttAvailable, MODELS, useDictation } from '@/features/stt';

const model = MODELS.find(isDownloaded); // 받아 둔 모델이 없으면 router.push('/stt')로 보내요
const { state, start, finish } = useDictation(model!);
// state.phase: idle → recording(seconds, partial, preview, backlog) → transcribing(ratio) → done(result.text) | error(message)
```

## M1 할 일

- [x] 모델 받기, 지우기, 받는 중 멈추기
- [x] 녹음하고 기기 안에서 받아쓰기, 받아쓴 글로 카드 찾기
- [ ] EAS 개발 빌드에서 iOS, Android 실제 확인 (#5)
- [x] 긴 녹음(조각 받아쓰기), 말하는 동안 조각마다 글 보이기, 앱이 꺼지면 이어서 받아쓰기
- [ ] 백그라운드 녹음 (Android 포그라운드 서비스, APK 새로 필요)
- [ ] 편집기 녹음 버튼에 붙이기 (A와 같이)
