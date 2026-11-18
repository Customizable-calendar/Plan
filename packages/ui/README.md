# @noteapp/ui (담당: D)

색·간격·글자 크기와 여러 기능이 같이 쓰는 컴포넌트를 둬요. 기능 하나에서만 쓰는 컴포넌트는 그 기능 폴더에 둬요.

## 디자인 시스템에서 옮긴 코드

[note-app-design-system](https://github.com/Customizable-calendar/note-app-design-system) 기준 커밋 `0ea29f8`의 아래 폴더를 그대로 옮겼어요(#33 1단계, 11/17 보라 메인 색·상자 없는 목록·녹음 화면 반영). 바꾼 건 `@/` import를 상대 경로로 바꾼 것과 prettier 정리뿐이에요. 색은 `apps/mobile/global.css`(디자인 시스템 `global.css` 그대로)와 `src/theme.ts`(디자인 시스템 `lib/theme.ts`를 hex로)예요.

| 폴더                  | 내용                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui`   | react-native-reusables: Button, Card, Badge, Text, Input, Textarea, Tabs, Checkbox, RadioGroup, Switch, Avatar, Progress, Separator, Icon                                                       |
| `src/components/app`  | 카드 칩·AI 추출 카드(`cards`), 시트·슬래시 메뉴·토스트(`overlays`), 탭바·상단바(`navigation`), 왼쪽 메뉴(`lnb`), 캘린더(`calendar`), 홈(`home`), 문서(`doc`), 트리(`tree`), 녹음·요약(`record`) |
| `src/components/chat` | AI 채팅 말풍선, 입력창, 생각 중, 오류 안내                                                                                                                                                      |
| `src/lib`             | `cn`(className 합치기), `FontContext`, 디자인 토큰 타입(`design/tokens.ts`)                                                                                                                     |

누구나 고칠 수 있어요. 모양을 바꾸면 디자인 시스템 레포에도 같이 맞추고, PR 본문에 무엇을 바꿨는지 적어요. 기능 폴더에 복사해서 고쳐 쓰지는 않아요.

## 쓰는 법

```tsx
import { Button, Card, CardContent, Text, TypeChip } from '@noteapp/ui';

<Card>
  <CardContent className="gap-2">
    <TypeChip type="event" />
    <Text className="text-muted-foreground">회의 3시</Text>
    <Button size="sm">
      <Text>확인</Text>
    </Button>
  </CardContent>
</Card>;
```

- 색은 className 토큰으로 써요: `bg-primary`, `text-muted-foreground`, `bg-event-soft`, `border-border`. 값은 `apps/mobile/global.css`에 있어요.
- 아이콘은 `Icon`에 lucide 아이콘을 넘겨요: `<Icon as={Check} className="size-4 text-primary" />`.

## 예전 이름

- `colors`·`palette`·`space`·`fontSize`·`radius`·`screen`: 각자 화면을 className으로 옮기는 동안 남겨 둬요(#33 3단계). 다 옮기면 지워요.
- `ComingSoon`: 아직 만들지 않은 화면·섹션 자리 표시. 기능을 만들면 지워요.
