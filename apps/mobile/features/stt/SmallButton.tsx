import { Pressable, Text } from 'react-native';

/** 받아쓰기 화면의 작은 버튼. primary면 채운 버튼이에요. */
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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`h-9 justify-center self-start rounded-md px-3 ${
        primary ? 'bg-primary' : 'border border-border bg-background'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text
        className={`text-[14px] font-bold ${primary ? 'text-primary-foreground' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
