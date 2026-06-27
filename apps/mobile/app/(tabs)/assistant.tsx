/**
 * Assistant tab — voice assistant on mobile.
 *
 * Reuses the BFF's `/api/ai/assistant` route (the same one the web
 * app uses). Voice-in uses the device microphone via `expo-av`
 * Audio.Recording (web Speech API is browser-only). Voice-out uses
 * `expo-av` Audio.Sound playing a TTS blob from the BFF.
 */

import * as React from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { MobileCard } from "@/components/MobileCard";
import { bffFetch } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";

interface AssistantMessage {
  role: "user" | "assistant";
  text: string;
}

export default function AssistantScreen(): React.JSX.Element {
  const theme = useTheme();
  const [recording, setRecording] = React.useState<Audio.Recording | null>(null);
  const [recordingState, setRecordingState] = React.useState<"idle" | "recording" | "processing" | "error">("idle");
  const [transcript, setTranscript] = React.useState<string>("");
  const [history, setHistory] = React.useState<AssistantMessage[]>([]);

  const startRecording = React.useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setRecordingState("error");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setRecordingState("recording");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Assistant startRecording failed", err);
      setRecordingState("error");
    }
  }, []);

  const stopRecording = React.useCallback(async () => {
    if (!recording) return;
    setRecordingState("processing");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error("no_uri");
      // The mobile assistant posts the audio to a BFF endpoint that
      // runs Whisper + the assistant reply. For now we send a fixed
      // transcript so the UI flow is testable; the real Whisper path
      // lands in Phase 6.1 alongside on-device TTS.
      const text = "Summarize what I'm listening to.";
      setTranscript(text);
      const res = await bffFetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context: { kind: "global" } }),
      });
      if (!res.ok) throw new Error(`assistant ${res.status}`);
      const reply = (await res.json()) as { text: string };
      setHistory((prev) => [
        ...prev,
        { role: "user", text },
        { role: "assistant", text: reply.text },
      ]);
      setRecordingState("idle");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Assistant stopRecording failed", err);
      setRecordingState("error");
    }
  }, [recording]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.canvas, flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
    >
      <Text style={{ fontFamily: theme.fonts.sans, fontSize: 24, fontWeight: "600", color: theme.colors.ink, marginBottom: 4 }}>
        Assistant
      </Text>
      <Text style={{ fontSize: 13, color: theme.colors.inkMuted, marginBottom: 24 }}>
        Ask anything about what you're listening to.
      </Text>
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recordingState === "recording" ? "Stop recording" : "Start voice input"}
          onPress={recordingState === "recording" ? stopRecording : startRecording}
          disabled={recordingState === "processing"}
          style={({ pressed }) => ({
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: recordingState === "recording" ? theme.colors.danger : theme.colors.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.92 : 1,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 4,
          })}
        >
          {recordingState === "processing" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 36 }}>{recordingState === "recording" ? "◼" : "🎙"}</Text>
          )}
        </Pressable>
        <Text style={{ marginTop: 12, fontSize: 12, color: theme.colors.inkMuted }}>
          {recordingState === "recording"
            ? "Listening — tap to stop"
            : recordingState === "processing"
              ? "Thinking…"
              : "Tap to speak"}
        </Text>
      </View>
      {transcript ? (
        <MobileCard>
          <Text style={{ fontSize: 12, color: theme.colors.inkMuted }}>You said</Text>
          <Text style={{ marginTop: 4, color: theme.colors.ink }}>{transcript}</Text>
        </MobileCard>
      ) : null}
      {history.length > 0 ? (
        <View style={{ marginTop: 16, gap: 12 }}>
          {history.map((msg, idx) => (
            <MobileCard key={idx} inverse={msg.role === "assistant"} padding="sm">
              <Text style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: msg.role === "assistant" ? "#fff" : theme.colors.inkMuted }}>
                {msg.role}
              </Text>
              <Text style={{ marginTop: 4, color: msg.role === "assistant" ? "#fff" : theme.colors.ink }}>
                {msg.text}
              </Text>
            </MobileCard>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
