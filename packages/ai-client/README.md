# @noteapp/ai-client (담당: B)

Claude·OpenAI·Gemini를 같은 모양(`AiProvider`)으로 부르는 어댑터예요.

- 앱에서 AI 회사로 직접 호출해요. 서버를 거치지 않아요.
- 이 패키지는 키를 저장하지 않아요. 키는 앱의 `@/lib/secrets`에서 꺼내 `createProvider`에 넘겨요.
- 요청·응답 원문을 로그로 남기지 않아요.

Claude 어댑터가 있어요(`claude-opus-5-5`, 공식 SDK `@anthropic-ai/sdk`). 정책상 거절되면 서버가 다른 모델로 다시 돌리게(`fallbacks: "default"`) 해 뒀어요. OpenAI·Gemini는 아직이에요.

- `history`로 앞 대화를 넘기면 이어서 고쳐 달라고 할 수 있어요.
- 오류는 화면에 바로 보여줄 수 있는 한국어 `AiError`로 바꿔서 던져요.
