# @noteapp/ai-client (담당: B)

Claude·OpenAI·Gemini를 같은 모양(`AiProvider`)으로 부르는 어댑터예요.

- 앱에서 AI 회사로 직접 호출해요. 서버를 거치지 않아요.
- 이 패키지는 키를 저장하지 않아요. 키는 앱의 `@/lib/secrets`에서 꺼내 `createProvider`에 넘겨요.
- 요청·응답 원문을 로그로 남기지 않아요.

M3에서 Claude 어댑터 하나를 먼저 만들고, 나머지는 같은 모양으로 추가해요.
