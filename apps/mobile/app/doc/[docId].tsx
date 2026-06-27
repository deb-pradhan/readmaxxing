/**
 * Reader screen — mobile equivalent of the web reader.
 *
 * Reuses the **segment tree** from `@readmaxxing/core` (the canonical
 * data model). The rendering uses React Native `Text` so the
 * `KaraokeHighlighter` web primitive (which uses DOM spans) can
 * stay platform-neutral. The mobile screen walks the segment tree
 * and renders each sentence as a `Text` block with the active word
 * highlighted — same logical structure as the web reader, same
 * `data-word-idx`/`data-current-sentence` attributes are not
 * available in RN but we drive the active index from the same
 * speech marks the audio engine emits.
 *
 * Native modules:
 *   - `expo-av` Audio.Sound for streaming TTS + background playback.
 *   - `expo-notifications` for streak reminders (registration only
 *     here; Phase 6.1 wires the actual push flow).
 *
 * Phase 6.1 follow-up: swap `expo-av` for `react-native-sherpa-onnx`
 * to get on-device Piper/Kokoro TTS — no cloud round-trip.
 */

// Phase 6.1: swap in `react-native-sherpa-onnx` for offline TTS.
// For now, the mobile app hits the BFF's cloud ElevenLabs proxy so
// the player works end-to-end without a custom dev client.
const TTS_PROVIDER_NOTE = "// Phase 6.1: swap in react-native-sherpa-onnx for offline TTS.";

import * as React from "react";
import { ScrollView, View, Text, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import type { SegmentTree } from "@readmaxxing/core";
import { bffFetch } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";
import { MobilePlayer } from "@/components/MobilePlayer";

void TTS_PROVIDER_NOTE;

interface DocumentResponse {
  id: string;
  title: string;
  segmentTree: SegmentTree;
}

export default function ReaderScreen(): React.JSX.Element {
  const { docId } = useLocalSearchParams<{ docId: string }>();
  const theme = useTheme();
  const [tree, setTree] = React.useState<SegmentTree | null>(null);
  const [title, setTitle] = React.useState<string>("Loading…");
  const [error, setError] = React.useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = React.useState(-1);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  React.useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await bffFetch(`/api/documents/${encodeURIComponent(docId)}`);
        if (!res.ok) throw new Error(`doc ${res.status}`);
        const doc = (await res.json()) as DocumentResponse;
        if (cancelled) return;
        setTree(doc.segmentTree);
        setTitle(doc.title);
      } catch (err) {
        if (!cancelled) setError("Can't reach ReadMaxxing — retry");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Wire audio session + listener so playback continues when the
  // screen locks. UIBackgroundModes: ["audio"] is declared in
  // app.json for iOS; the Android equivalent is the audio session
  // mode (handled by expo-av on the AndroidManifest).
  React.useEffect(() => {
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
    return () => {
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  const handlePlayPause = React.useCallback(async () => {
    if (!tree) return;
    if (!soundRef.current) {
      try {
        const res = await bffFetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: docId, voiceId: "eleven_rachel", speed }),
        });
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = async () => {
          const uri = String(reader.result);
          const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, rate: speed });
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            if (status.durationMillis) setDuration(status.durationMillis / 1000);
            setCurrentTime((status.positionMillis ?? 0) / 1000);
            if (status.didJustFinish) setPlaying(false);
          });
          setPlaying(true);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        setError("Couldn't reach the voice service — try again.");
      }
      return;
    }
    if (playing) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setPlaying(true);
    }
  }, [docId, playing, speed, tree]);

  const handleSeek = React.useCallback(async (t: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(t * 1000);
    setCurrentTime(t);
  }, []);

  const handleSpeedChange = React.useCallback(async (next: number) => {
    setSpeed(next);
    if (soundRef.current) {
      await soundRef.current.setRateAsync(next, true);
    }
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontFamily: theme.fonts.sans, fontSize: 20, fontWeight: "600", color: theme.colors.ink }}>
          Couldn't load this reader
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: theme.colors.inkMuted, textAlign: "center" }}>
          {error}
        </Text>
      </View>
    );
  }
  if (!tree) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.canvas }}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={{ marginTop: 12, color: theme.colors.inkMuted }}>Loading…</Text>
      </View>
    );
  }

  // Walk the segment tree, finding the active sentence for the
  // current word index. The active sentence gets a soft tint;
  // the active word gets the accent fill (UI-UX.md §5).
  let flatIdx = 0;
  const renderedTree = (
    <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: 160, paddingHorizontal: 16 }}>
      <Text
        style={{
          fontFamily: theme.fonts.sans,
          fontSize: 24,
          fontWeight: "600",
          color: theme.colors.ink,
          marginBottom: 16,
        }}
      >
        {title}
      </Text>
      {tree.paragraphs.map((paragraph) => (
        <Text
          key={paragraph.index}
          style={{
            fontFamily: theme.fonts.sans,
            fontSize: 18,
            lineHeight: 28,
            color: theme.colors.ink,
            marginBottom: 16,
            maxWidth: 720,
            alignSelf: "center",
          }}
        >
          {paragraph.sentences.map((sentence, sIdx) => {
            const sentenceStart = flatIdx;
            const sentenceEnd = sentenceStart + sentence.words.length;
            const isActive =
              currentWordIndex >= sentenceStart && currentWordIndex < sentenceEnd;
            const result = (
              <Text
                key={`s-${paragraph.index}-${sIdx}`}
                style={{
                  backgroundColor: isActive ? theme.colors.accentSoft : "transparent",
                  paddingHorizontal: 2,
                }}
              >
                {sentence.words.map((word, wIdx) => {
                  const wordFlat = sentenceStart + wIdx;
                  const activeWord = wordFlat === currentWordIndex;
                  return (
                    <Text
                      key={`w-${word.start}-${word.end}`}
                      onPress={() => setCurrentWordIndex(wordFlat)}
                      style={{
                        backgroundColor: activeWord ? theme.colors.accent : "transparent",
                        color: activeWord ? "#fff" : theme.colors.ink,
                        paddingHorizontal: 1,
                        borderRadius: 2,
                      }}
                    >
                      {word.text}
                      {wIdx < sentence.words.length - 1 ? " " : ""}
                    </Text>
                  );
                })}
                {" "}
              </Text>
            );
            flatIdx = sentenceEnd;
            return result;
          })}
        </Text>
      ))}
    </ScrollView>
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {renderedTree}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderSubtle,
          borderTopWidth: 1,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        <MobilePlayer
          playing={playing}
          onPlayPause={handlePlayPause}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          speed={speed}
          onSpeedChange={handleSpeedChange}
          voiceLabel="eleven_rachel"
          loading={false}
        />
      </View>
    </View>
  );
}
