# 받아쓰기

- **담당**: B
- **하는 일**: 말한 내용을 기기 안에서 한국어 글로 바꿔요. [whisper.rn](https://github.com/mybigday/whisper.rn)(whisper.cpp, MIT)을 써서 서버, API 키, 요금이 없어요. 소리는 기기 밖으로 안 나가요.
- **화면**: `/stt` (모델 받기, 말하기, 받아쓴 글로 카드 찾기)
- **데이터**: 받아쓰기 기록 `stt_notes`(받아쓴 글, 줄 시각, 화자, 북마크·메모, `notes.ts`)와 내 지시문 `stt_transforms`. 둘 다 기기에 먼저 저장하고 로그인하면 계정에도 올려요(`stt` 기능). 소리(녹음 원본)는 기기에만 있어요. 모델 파일은 기기 `Documents/stt/`, 받아쓰는 중인 녹음은 `Documents/stt/session/`에 있어요.
- **다른 기능에 주는 것**: `useDictation`, `startDictation`, `prewarmStt`, `isSttAvailable`, `leftoverSeconds`, `discardLeftover`, `MODELS`, `isDownloaded`
- **받는 것**: 카드(cards)의 `findCardsFromTranscript` (받아쓰기가 끝나면 회의록에서 일정, 약속, 할 일을 찾아 확인 기다리는 카드로 넣어요)

## 화면 (디자인 시스템 녹음 화면)

디자인 시스템(note-app-design-system `0ea29f8`)의 녹음 시트와 녹음 노트를 따라요(클로바노트 참고, 디자인 시스템 `docs/benchmark`).

- **고르기**: "말하기 시작", 마이크 확인, 음성 파일 가져오기, 녹음 원본 남기기, 남긴 녹음, 모델 목록. 상자 없이 구분선으로 나눠요(`AudioTools.tsx`).
- **녹음 시트**: `RecordPanel`(시각, 파형, 받아쓰는 글, 북마크, 잠시 멈춤, 메모)을 `BottomSheet`에 넣어요. 시트를 누르면 `RecordMiniBar`로 줄고, 막대를 누르면 다시 열려요. 위쪽에는 받아쓴 글이 계속 보여요.
  - 잠시 멈춤: 멈춘 동안 들어온 소리는 버리고 녹음 시간에도 안 세요(`Dictation.pause`).
  - 북마크, 메모: 녹음 시각과 같이 남겨서 녹음 노트에 보여 줘요(이 화면에만 있고 저장은 안 해요).
- **지난 받아쓰기**: 받아쓰기가 끝나면 기록을 자동으로 남겨요(`stt_notes`). 화자를 나누거나 북마크가 바뀌면 같은 기록을 고쳐 써요. 첫 화면 "지난 받아쓰기"에서 다시 열면 녹음 노트로 보여요. 다른 기기에서 열면 글은 보이지만 녹음 원본이 없어서 재생은 안 돼요.
- **녹음 노트**(`NoteView.tsx`): `CountTabs` 3개
  - 받아쓴 글: 문장 줄마다 `TranscriptBlock`(시각, 화자, 북마크, 메모). 녹음 원본이 있으면 단어를 누르면 그 자리부터 재생하고, 재생 중인 단어가 표시돼요(줄 안 단어 시각은 글자 비율로 짐작해요). 아래에 글로 공유, .txt, .srt 내보내기, 화자 나누기.
  - 요약(`TranscriptAi.tsx`의 `SummaryTab`): `SummaryHeader`, `SummarySection`(요약, 다음 할 일, 양식으로 정리), `NextActionRow`로 카드 후보를 바로 확인, `AiNotice`.
  - 메모: 녹음 중 북마크와 메모를 시각 순서로. 누르면 그 자리부터 재생해요.
  - 녹음 원본이 있으면 아래에 `PlayerBar`(재생, 5초 앞뒤, 속도)가 있어요(`expo-audio`).
- `@noteapp/ui` 녹음 컴포넌트에 누를 수 있게 props만 더했어요(모양은 그대로): `RecordPanel`의 `onCancel`, `onFinish`, `RecordMiniBar`의 `onFinish`, `PlayerBar`의 `onBack`, `onForward`, `onSpeed`, `onLocate`.
- 버튼은 `@noteapp/ui`의 `Button`을 써요(`SmallButton`은 그 얇은 포장이에요). 화면 글자에 가운뎃점 같은 기호는 안 써요(AGENTS.md).

## 꼭 알아 둘 것

- **Expo Go에서는 안 돼요.** `whisper.rn`과 녹음(`@fugood/react-native-audio-pcm-stream`)이 네이티브 모듈이에요. EAS 개발 빌드가 있어야 해요(#5). Expo Go에서는 `isSttAvailable()`이 `false`이고 화면에 안내만 나와요. 앱이 죽지는 않아요.
- **모델은 처음 쓸 때 받아요.** 앱에 넣으면 너무 커서요. 16MB씩 나눠 받아서(HTTP Range) 인터넷이 끊기거나 앱이 꺼지거나 멈춰도 다음에 "이어 받기"로 받은 데부터 받아요(`models.ts`).

  | 모델                                        | 크기  | 쓰임                                                                          |
  | ------------------------------------------- | ----- | ----------------------------------------------------------------------------- |
  | `small` (whisper ggml-small-q5_1)           | 190MB | 한국어 추천, 내 단어 예시를 잘 따라요                                         |
  | `sensevoice` (SenseVoice int8, sherpa-onnx) | 240MB | 아주 빠름, 긴 회의에 적당, 부호도 찍어요. 내 단어 예시는 못 써요 (새 APK부터) |
  | `base` (whisper ggml-base-q5_1)             | 60MB  | 짧은 말, 느린 폰                                                              |

- **긴 녹음**: 최대 3시간. 말이 쉬는 곳에서 20~30초 조각으로 잘라(`chunker.ts`) 녹음하는 동안 뒤에서 차례로 받아써요. 그래서 말하는 동안 글이 조각마다 늘어나고, 메모리는 조각 하나(약 1MB)만큼만 써요. 말이 없는 조각은 받아쓰지 않아요(없는 말을 지어내지 않게).
- **앱이 꺼져도 이어서**: 조각과 받아쓴 글을 기기 `Documents/stt/session/`에 적어 둬요(`session.ts`). 다음에 화면을 열면 "이어서 받아쓰기"가 나와요. 끝내거나 버리면 지워요. 기기 밖으로는 안 나가요.
- **말소리 감지(VAD)**: whisper.rn 안의 Silero VAD(`ggml-silero-v6.2.0.bin`, 약 0.9MB, MIT)를 처음 받아쓸 때 알아서 받아요(`vad.ts`). 조각마다 사람 말이 있는 곳만 남기고(앞뒤는 잘라 내고 1초 넘게 조용한 곳은 소리를 지워요, `speech.ts`) 말이 없으면 건너뛰어요. 30초가 되도록 쉬는 곳을 못 찾으면 VAD로 제일 길게 쉰 곳에서 잘라요. VAD를 못 받으면 소리 크기만 봐요.
- **못 알아들은 말을 버리지 않기**: 문장으로 못 알아들어도 들은 걸 버리지 않아요(`engine.ts`).
  - 말소리 감지(VAD)가 말을 못 찾아도 소리 크기로 조용하지 않은 조각이면 통째로 받아써요. 조용한 조각만 건너뛰어요.
  - 받아쓴 게 비면 예시 문장 없이 한 번 더 받아써요. 그래도 비면 녹음하는 동안 보여 준 회색 글을 남겨요.
  - 그것도 없는데 VAD가 말소리를 찾았던 조각이면 "(잘 안 들린 말)" 자리를 시각과 같이 남겨요. 원본이 있으면 녹음 노트에서 눌러 다시 들어요.
  - 짧은 말("네", "좋아요")은 앞 문장과 같아도 남겨요. 6글자 넘는 문장만 조각 경계에서 겹치면 하나로 줄여요.
- **정확도**: 밀린 조각이 적으면 후보 5개를 비교해서(beam search) 받아쓰고, 많이 밀리면 빠르게 받아써요. 앞 조각 끝 문장을 다음 조각의 예시로 넘겨서 말이 이어지게 해요. 같은 말 되풀이("감사합니다. 감사합니다…")와 방송 자막 말은 빼요(`text.ts`).
- **미리 받아쓰기**: 조각이 되기 전 말도 1.5초마다 미리 받아써서 회색 글(`state.preview`)로 보여 줘요. 받아쓸 조각이 없을 때만 돌아서 폰이 더 따뜻해지고 배터리를 더 써요. 조각을 받아쓰면 검은 글(`state.partial`)로 바뀌어요.
  - 두 번 연속 똑같이 나온 앞 문장은 고정하고, 다음부터는 그 뒤 소리만 받아써요(`settledCount`, SimulStreaming의 LocalAgreement 방식). 글이 덜 바뀌고 폰이 덜 일해요. 소리 끝에서 1.5초 안에 끝난 문장은 말이 더 이어질 수 있어서 고정하지 않아요.
- **내 단어**: 내 해시태그 카테고리 이름과 태그(`lib/tag-categories`)를 "자주 쓰는 말:" 한 줄로 예시에 넣어요(`wordsLine`, 50자까지). 내가 쓰는 말을 더 맞게 받아써요. `useDictation(model, onDone, { words })`로 넘겨요.
- **시각 붙은 줄과 내보내기**: 받아쓴 덩어리를 문장 단위 줄로 나눠요(`@noteapp/extractor`의 `timedLines`). 문장이 끝나거나, 1.5초 넘게 쉬거나, 7초가 넘으면 줄을 나눠요(SpokenLog 참고). 덩어리 안 문장 시각은 글자 수로 나눠 짐작한 값이에요. 받아쓴 뒤 "시각 붙여 공유"(`[0:05] 문장`)와 "자막(SRT) 공유"로 내보내요.
- **모델 미리 띄우기**: 받아쓰기 화면에서 모델을 고르면 모델과 말소리 감지를 미리 열어 둬요(`prewarmStt`). 녹음 버튼을 누르면 모델을 여는 몇 초를 안 기다려요. 아무도 안 쓴 채로 3분이 지나면 닫아서 메모리를 돌려줘요. 다른 화면에 붙일 때도 녹음 버튼이 보일 때 `prewarmStt(model)`을 불러 주면 좋아요.
- **속도 설정**: iOS는 GPU(Metal)에 flash attention을 켜요. 그 설정으로 못 열면 기본 설정으로 다시 열어요. Android는 whisper.rn이 CPU로만 돌려서(코어가 4개보다 많으면 스레드 4개) 그대로 둬요.
- **화면이 꺼져도 녹음 (Android)**: 녹음하는 동안 "받아쓰는 중" 알림을 띄워요(포그라운드 서비스, 마이크 종류, `modules/stt-native`). 화면이 꺼지거나 앱을 나가도 녹음과 받아쓰기를 이어 가요. 녹음을 끝내도 남은 부분을 다 받아쓸 때까지 알림이 남아요. Android 13부터는 처음에 알림 권한을 물어봐요(안 줘도 녹음은 돼요). 화면을 켜 두는 것(`expo-keep-awake`)도 그대로예요. iOS 앱은 아직 안 만들어서 iOS 백그라운드 녹음은 안 해요.
- **음성 파일 가져오기 (Android)**: "음성 파일 가져와서 받아쓰기"로 m4a·mp3·aac·ogg·mp4 등을 골라요. OS 디코더(MediaCodec)로 16kHz 모노 WAV로 바꿔서 남긴 녹음 목록에 넣고 바로 받아써요(`importAudioFile`, `decodeToWav`). 원래 파일은 그대로예요.
- **파일로 내보내기**: "시각 붙여 공유"는 `.txt`, "자막(SRT) 공유"는 `.srt` 파일로, 남긴 녹음은 `.wav`로 공유해요(`expo-sharing`, `share.ts`). 파일 공유가 안 되는 곳에서는 글로 공유해요.
- **Qwen3-ASR 엔진 (기본 추천, sherpa-onnx가 든 APK)**: 로컬 모델 중 한국어가 제일 정확해서 골랐어요. LocalSTT 한국어 강의 벤치마크 CER(낮을수록 좋음)은 Qwen3-ASR-1.7B 5.60, Whisper large-v3-turbo 7.76, Alt(Lightning-SimulWhisper) 7.94예요. 앱에는 sherpa-onnx 공식 0.6B int8(약 940MB, `csukuangfj2/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25`, 커밋 고정)을 넣었어요(`sensevoice.ts`의 `openQwen3`).
  - 한 번에 28초까지 넣어요(LocalSTT와 같아요). 더 긴 조각은 비슷한 길이로 나눠서 받아써요(`splitPcm`).
  - 내 단어(해시태그 등)는 hotwords로 줘요. 단어가 바뀌면 모델을 다시 열어요.
  - 새로 만드는 글 길이 기본값(128토큰)이면 28초 한국어가 잘려서 512로 늘렸어요.
  - 정확하지만 느려서, 말하는 중 회색 글은 받아 둔 whisper(base, 없으면 small)가 따로 맡아요. 엔진이 달라서 Qwen3가 조각을 받아쓰는 동안에도 회색 글이 나와요. 받아 둔 whisper가 없으면 회색 글 없이 조각마다 글이 나와요.
  - sherpa-onnx는 받아쓰기 모델을 하나만 띄워서 SenseVoice와 Qwen3를 같이 못 써요.
- **Qwen3-ASR 1.7B (GPU·NPU 폰, 새 APK)**: LocalSTT 1등 모델 그대로예요. llama.rn(llama.cpp, MIT)으로 `ggml-org/Qwen3-ASR-1.7B-GGUF` Q8(본체 2.0GB + 소리 projector 340MB, 커밋 고정)을 돌려요(`llama.ts`).
  - 모델 받기 전에 llama.rn 장치 목록(`getBackendDevicesInfo`)으로 GPU(OpenCL, Snapdragon Adreno 700+)나 NPU(Hexagon, 8 Gen 1+)가 있는지 보고, 있을 때만 목록에 보여요(`canAccelerate`). Exynos, MediaTek 폰은 CPU라 0.6B를 써요. iOS는 Metal이 늘 있어요.
  - 28초씩 나눠 넣고, 내 단어는 시스템 글(context)로 줘요. 회색 글은 0.6B처럼 whisper가 따로 맡아요.
  - Expo 플러그인(`llama.rn`, `enableOpenCLAndHexagon`)이 `libOpenCL.so`, `libcdsprpc.so`를 매니페스트에 넣어요. 이 PC(Windows)에서는 설치 스크립트의 tar가 안 돼서 `RNLLAMA_SKIP_POSTINSTALL=1`로 설치했어요. EAS·CI(Linux)는 그대로 받아요.
- **받아쓴 글 다듬기**: 기본 양식에 "받아쓴 글 다듬기"를 넣었어요. 받아쓴 글만 팀 AI로 보내서 잘못 알아들은 글자, 띄어쓰기, 부호만 고쳐요(LocalSTT도 LLM 후보정을 권해요).
- **SenseVoice 엔진 (새 APK, Android)**: whisper처럼 한 글자씩 이어 만들지 않고 한 번에 통째로 받아써서 훨씬 빨라요(SpokenLog 참고). `@siteed/sherpa-onnx.rn`(MIT)로 기기 안에서 돌려요. 엔진은 whisper.rn 컨텍스트와 같은 모양으로 감싸서(`sensevoice.ts`) 조각 나누기·VAD·이어서 받아쓰기는 그대로 써요. 문장마다 시각은 안 줘서 조각 하나가 한 덩어리예요. 모델은 FunASR 모델 라이선스 1.1(출처·이름 표시)이에요.
- **화자 구분 (새 APK, Android)**: 받아쓴 뒤 "화자 나누기"를 누르면 녹음 원본으로 누가 말했는지 나눠서 "화자 1: …" 줄로 보여 줘요(`speakers.ts`, `SpeakerSplit.tsx`). pyannote 분할 3.0(MIT) + 3D-Speaker ERes2Net(Apache-2.0) 모델(45MB)을 처음 쓸 때 받아요. 사람 수는 알아서·2·3·4명 중에 골라요. 녹음 원본이 있어야 하고(원본 남기기·파일 가져오기), 30분 이하 녹음만 돼요. "화자 1"은 목소리로 나눈 것이라 실제 이름은 몰라요. 시각 붙은 글·자막·AI 정리에도 화자가 들어가요.
- sherpa-onnx는 불러오는 순간 네이티브 모듈을 찾아서, `sherpa.ts`로만 불러요(없는 빌드에서는 안 불러요). 웹은 `sherpa.web.ts`가 대신해서 웹 묶음에 안 들어가요.
- **마이크 확인**: 녹음 전에 "마이크 확인"을 누르면 녹음하지 않고 소리 크기만 막대로 보여 줘요(10초 뒤 알아서 멈춰요). 녹음하는 동안에도 막대가 보여요(`AudioTools.tsx`, `testMicrophone`).
- **녹음 원본 남기기 (선택)**: 켜 두면 녹음하는 소리를 그대로 WAV로 이 기기에 남겨요(`Documents/stt/recordings/`, `recordings.ts`). 1시간에 약 115MB라 기본은 꺼져 있어요. 남긴 녹음은 목록에서 지금 고른 모델로 "다시 받아쓰기"(`transcribeRecording`)하거나 지워요. 앱이 꺼져서 WAV 머리에 길이를 못 적은 파일은 목록을 볼 때 고쳐요.
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
