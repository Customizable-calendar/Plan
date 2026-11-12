import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { sendLoginCode, verifyLoginCode } from '@/lib/auth';

type Step = { kind: 'email' } | { kind: 'code'; email: string };

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** 이메일로 6자리 코드를 받아 로그인해요. 로그인하면 루트 레이아웃이 앱 화면으로 보내요. */
export function LoginScreen() {
  const [step, setStep] = useState<Step>({ kind: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      await sendLoginCode(email);
      setCode('');
      setStep({ kind: 'code', email: email.trim().toLowerCase() });
    });

  const verify = () =>
    run(async () => {
      if (step.kind === 'code') await verifyLoginCode(step.email, code);
    });

  const canSend = looksLikeEmail(email) && !busy;
  const canVerify = /^\d{6}$/.test(code.trim()) && !busy;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center gap-6 p-6">
        <View className="gap-2">
          <Text className="text-[26px] font-bold text-foreground">로그인</Text>
          <Text className="text-[15px] leading-6 text-muted-foreground">
            {step.kind === 'email'
              ? '이메일로 6자리 코드를 보내 드려요. 비밀번호는 없어요.'
              : `${step.email}로 보낸 6자리 코드를 넣어 주세요.`}
          </Text>
        </View>

        {step.kind === 'email' ? (
          <TextInput
            className="rounded-xl border border-border bg-card px-4 py-3 text-[16px] text-foreground"
            placeholder="이메일 주소"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => canSend && void send()}
            editable={!busy}
          />
        ) : (
          <TextInput
            className="rounded-xl border border-border bg-card px-4 py-3 text-center text-[24px] tracking-[8px] text-foreground"
            placeholder="000000"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            onSubmitEditing={() => canVerify && void verify()}
            editable={!busy}
            autoFocus
          />
        )}

        {error ? <Text className="text-[14px] leading-5 text-destructive">{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={step.kind === 'email' ? !canSend : !canVerify}
          onPress={() => void (step.kind === 'email' ? send() : verify())}
          className={`items-center rounded-xl py-4 ${
            (step.kind === 'email' ? canSend : canVerify) ? 'bg-primary' : 'bg-muted'
          }`}
        >
          {busy ? (
            <ActivityIndicator />
          ) : (
            <Text
              className={`text-[16px] font-bold ${
                (step.kind === 'email' ? canSend : canVerify)
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {step.kind === 'email' ? '코드 받기' : '로그인'}
            </Text>
          )}
        </Pressable>

        {step.kind === 'code' ? (
          <View className="flex-row justify-center gap-6">
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void send()}>
              <Text className="text-[14px] text-primary">코드 다시 받기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setError(null);
                setStep({ kind: 'email' });
              }}
            >
              <Text className="text-[14px] text-muted-foreground">이메일 바꾸기</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
