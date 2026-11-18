import { Button, Text } from '@noteapp/ui';

/**
 * 받아쓰기 화면의 작은 버튼. 디자인 시스템 Button(@noteapp/ui)을 그대로 써요.
 * primary면 채운 버튼(default), 아니면 테두리 버튼(outline)이에요.
 */
export function SmallButton({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      size="sm"
      variant={primary ? 'default' : 'outline'}
      onPress={onPress}
      disabled={disabled}
      className="self-start"
    >
      <Text>{label}</Text>
    </Button>
  );
}
