import { speakerLabel, timedLines, toSpeakerText, toSrt, toTimedText } from '@noteapp/extractor';
import type { Card } from '@noteapp/shared';
import { ActionRow, CountTabs, Icon, PlayerBar, Text, TranscriptBlock } from '@noteapp/ui';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  BookmarkIcon,
  CaptionsIcon,
  ClockIcon,
  CopyIcon,
  PlayIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';

import type { SttResult, SttSegment } from './engine';
import { listRecordings } from './recordings';
import { shareTextFile, stamp } from './share';
import { SpeakerSplit } from './SpeakerSplit';
import { type Found, SummaryTab } from './TranscriptAi';

// 녹음 노트(디자인 시스템 "녹음 노트", 클로바노트 참고). 받아쓰기가 끝나면 보여요.
// 탭 3개: 받아쓴 글(구간마다 시각, 단어를 누르면 그 자리부터 재생), 요약(팀 AI), 메모(녹음 중 북마크와 메모).
// 녹음 원본이 있으면 아래에 재생 막대가 있어요(expo-audio).

/** 녹음 중에 남긴 표시. text가 없으면 북마크예요. ms는 녹음 시작부터 */
export interface Mark {
  ms: number;
  text?: string;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const SKIP_MS = 5000;

export function NoteView({
  result,
  segments,
  marks,
  found,
  onCards,
  onSegments,
  onNew,
}: {
  result: SttResult;
  /** 화자를 나눴으면 화자가 붙은 덩어리 */
  segments: SttSegment[];
  marks: Mark[];
  found: Found | null;
  onCards: (cards: Card[], byAi?: boolean) => void;
  onSegments: (segments: SttSegment[]) => void;
  onNew: () => void;
}) {
  const [tab, setTab] = useState('text');
  const lines = useMemo(() => timedLines(segments), [segments]);
  const bySpeaker = segments.some((s) => s.speaker !== undefined);
  const text = bySpeaker ? toSpeakerText(lines) : result.text;
  const memos = marks.filter((m) => m.text);

  // 녹음 원본이 있으면 재생해요.
  const recording = useMemo(
    () =>
      result.recordingId ? listRecordings().find((r) => r.id === result.recordingId) : undefined,
    [result.recordingId],
  );
  const player = useAudioPlayer(recording ? recording.file.uri : null);
  const status = useAudioPlayerStatus(player);
  const nowMs = (status.currentTime ?? 0) * 1000;
  const totalMs = recording ? recording.seconds * 1000 : result.durationMs;
  const seek = (ms: number) => {
    if (!recording) return;
    void player.seekTo(Math.max(0, Math.min(totalMs, ms)) / 1000);
    if (!status.playing) player.play();
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 px-5 pb-1 pt-4">
        <Text className="flex-1 text-[17px] font-bold text-foreground">
          받아쓰기 {result.durationMs ? clock(result.durationMs) : ''}
        </Text>
        <Pressable onPress={onNew} accessibilityRole="button" hitSlop={8}>
          <Text className="text-sm font-bold text-primary">새로 받아쓰기</Text>
        </Pressable>
      </View>
      <CountTabs
        items={[
          { key: 'text', label: '받아쓴 글' },
          { key: 'summary', label: '요약' },
          { key: 'memo', label: '메모', count: marks.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName={tab === 'text' ? 'gap-1 px-2 pb-6 pt-3' : 'px-5 pb-6 pt-4'}
      >
        {tab === 'text' ? (
          <>
            {lines.length === 0 ? (
              <Text className="px-3 py-4 text-base text-muted-foreground">
                알아들은 말이 없어요.
              </Text>
            ) : (
              lines.map((line, i) => {
                const words = line.text.split(' ').map((w) => ({ text: w }));
                const span = Math.max(1, line.endMs - line.startMs);
                const inLine = (ms: number) => ms >= line.startMs && ms < line.endMs;
                const playing =
                  recording && status.playing && inLine(nowMs)
                    ? Math.min(
                        words.length - 1,
                        Math.floor(((nowMs - line.startMs) / span) * words.length),
                      )
                    : undefined;
                const memo = marks
                  .filter((m) => m.text && inLine(m.ms))
                  .map((m) => `${clock(m.ms)} ${m.text}`)
                  .join('\n');
                return (
                  <TranscriptBlock
                    key={`${line.startMs}:${i}`}
                    time={
                      line.speaker !== undefined
                        ? `${clock(line.startMs)}  ${speakerLabel(line.speaker)}`
                        : clock(line.startMs)
                    }
                    words={words}
                    playingIndex={playing}
                    bookmarked={marks.some((m) => !m.text && inLine(m.ms))}
                    memo={memo || undefined}
                    onWordPress={
                      recording
                        ? (w) => seek(line.startMs + (w / Math.max(1, words.length)) * span)
                        : undefined
                    }
                  />
                );
              })
            )}
            <View className="px-3 pt-4">
              <Action
                icon={CopyIcon}
                label="글로 공유"
                onPress={() => void Share.share({ message: text })}
              />
              <Action
                icon={ClockIcon}
                label="시각 붙여 내보내기"
                hint=".txt"
                onPress={() =>
                  void shareTextFile(
                    `받아쓰기 ${stamp()}.txt`,
                    toTimedText(lines),
                    'text/plain',
                  ).catch(() => {})
                }
              />
              <Action
                icon={CaptionsIcon}
                label="자막으로 내보내기"
                hint=".srt"
                onPress={() =>
                  void shareTextFile(
                    `받아쓰기 ${stamp()}.srt`,
                    toSrt(lines),
                    'application/x-subrip',
                  ).catch(() => {})
                }
              />
              <SpeakerSplit
                recordingId={result.recordingId}
                segments={result.segments}
                onSegments={onSegments}
              />
            </View>
          </>
        ) : tab === 'summary' ? (
          <SummaryTab text={text} found={found} onCards={onCards} />
        ) : (
          <MemoTab marks={marks} memos={memos.length} onSeek={recording ? seek : undefined} />
        )}
      </ScrollView>
      {recording ? (
        <PlayerBar
          current={clock(nowMs)}
          total={clock(totalMs)}
          progress={totalMs ? Math.min(1, nowMs / totalMs) : 0}
          playing={status.playing}
          onToggle={() => (status.playing ? player.pause() : player.play())}
          onBack={() => seek(nowMs - SKIP_MS)}
          onForward={() => seek(nowMs + SKIP_MS)}
          onSpeed={(rate) => player.setPlaybackRate(rate)}
        />
      ) : null}
    </View>
  );
}

function Action({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="border-t border-border">
      <ActionRow icon={icon} label={label} hint={hint} />
    </Pressable>
  );
}

/** 메모 탭: 녹음 중에 남긴 북마크와 메모. 누르면 그 자리부터 재생해요. */
function MemoTab({
  marks,
  memos,
  onSeek,
}: {
  marks: Mark[];
  memos: number;
  onSeek?: (ms: number) => void;
}) {
  if (marks.length === 0)
    return (
      <Text className="text-base leading-6 text-muted-foreground">
        녹음하는 동안 북마크나 메모를 남기면 여기에 시각과 같이 모여요.
      </Text>
    );
  return (
    <View>
      <Text className="pb-2 text-[13px] font-bold text-muted-foreground">
        녹음 중에 남긴 것 {marks.length}개{memos ? `, 메모 ${memos}개` : ''}
      </Text>
      {[...marks]
        .sort((a, b) => a.ms - b.ms)
        .map((m, i) => (
          <Pressable
            key={`${m.ms}:${i}`}
            onPress={onSeek ? () => onSeek(m.ms) : undefined}
            disabled={!onSeek}
            className="min-h-12 flex-row items-center gap-3 border-t border-border py-2"
          >
            <View className="w-16 flex-row items-center gap-1">
              <Icon as={onSeek ? PlayIcon : ClockIcon} size={11} className="text-primary" />
              <Text className="text-[13px] font-bold text-primary">{clock(m.ms)}</Text>
            </View>
            {m.text ? (
              <Text className="flex-1 text-base text-foreground">{m.text}</Text>
            ) : (
              <View className="flex-1 flex-row items-center gap-1.5">
                <Icon as={BookmarkIcon} size={14} className="text-secondary" />
                <Text className="text-base text-muted-foreground">북마크</Text>
              </View>
            )}
          </Pressable>
        ))}
    </View>
  );
}
