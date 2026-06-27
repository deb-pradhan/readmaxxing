/**
 * MobileVoicePicker — RN-native equivalent of `packages/ui/VoicePicker`.
 *
 * The shared VoicePicker uses Tailwind + DOM grid; in RN we use a
 * 2-column flexbox grid. Same props (`voices`, `value`, `onChange`,
 * `isCloned`/`isMarquee` badges), same sort order (cloned first),
 * same accessibility role. The mobile picker stays in sync with the
 * web one because both consume the same BFF `/api/voices` payload.
 */

import * as React from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "./ThemeProvider";
import type { VoicePickerVoice } from "@readmaxxing/ui";

export interface MobileVoicePickerProps {
  voices: VoicePickerVoice[];
  value: string | null;
  onChange: (id: string) => void;
}

export function MobileVoicePicker({ voices, value, onChange }: MobileVoicePickerProps): React.JSX.Element {
  const theme = useTheme();
  // Mirror the web sort: cloned voices first (UI-UX.md §6 — "Your voice" badge).
  const sorted = React.useMemo(
    () => [...voices].sort((a, b) => Number(Boolean(b.isCloned)) - Number(Boolean(a.isCloned))),
    [voices],
  );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {sorted.map((voice) => {
        const selected = voice.id === value;
        return (
          <Pressable
            key={voice.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${voice.name}${voice.isCloned ? " — your voice" : voice.isMarquee ? " — recommended" : ""}`}
            onPress={() => onChange(voice.id)}
            style={({ pressed }) => ({
              flexBasis: "48%",
              flexGrow: 1,
              minHeight: 64,
              padding: 12,
              borderRadius: 10,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? theme.colors.accent : theme.colors.border,
              backgroundColor: theme.colors.surface,
              opacity: pressed ? 0.92 : 1,
              gap: 4,
            })}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: theme.fonts.sans, fontSize: 15, fontWeight: "600", color: theme.colors.ink }}>
                {voice.name}
              </Text>
              {voice.isCloned ? (
                <Text style={{ fontSize: 10, fontWeight: "600", color: theme.colors.accent }}>Your voice</Text>
              ) : voice.isMarquee ? (
                <Text style={{ fontSize: 10, fontWeight: "600", color: theme.colors.accent }}>Recommended</Text>
              ) : null}
            </View>
            {voice.label ? (
              <Text style={{ fontSize: 12, color: theme.colors.inkMuted }}>{voice.label}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
