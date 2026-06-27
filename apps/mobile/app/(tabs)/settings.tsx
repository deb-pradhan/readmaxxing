/**
 * Settings tab — voice + habit settings.
 *
 * Reuses the same `VoicePicker` primitive from `@readmaxxing/ui` so
 * the picker looks identical on web, extension, and mobile (UI-UX.md
 * §11). Writes via `/api/user/preferences` PUT — same BFF route the
 * web app uses; the SSE position sync picks up the change on the
 * next poll.
 */

import * as React from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { type VoicePickerVoice } from "@readmaxxing/ui";
import { MobileCard } from "@/components/MobileCard";
import { MobileVoicePicker } from "@/components/MobileVoicePicker";
import { bffFetch } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";

interface PreferencesResponse {
  defaultVoiceId: string;
  defaultSpeed: number;
  bionic: boolean;
  theme: string;
}

export default function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const [voices, setVoices] = React.useState<VoicePickerVoice[]>([]);
  const [prefs, setPrefs] = React.useState<PreferencesResponse | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [voicesRes, prefsRes] = await Promise.all([
          bffFetch("/api/voices"),
          bffFetch("/api/user/preferences"),
        ]);
        if (!voicesRes.ok || !prefsRes.ok) throw new Error("preload_failed");
        const voicesPayload = (await voicesRes.json()) as { voices: VoicePickerVoice[] };
        const prefsPayload = (await prefsRes.json()) as PreferencesResponse;
        if (cancelled) return;
        setVoices(voicesPayload.voices);
        setPrefs(prefsPayload);
      } catch (err) {
        if (!cancelled) setError("Can't reach ReadMaxxing — retry");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePrefs = React.useCallback(
    async (patch: Partial<PreferencesResponse>) => {
      setSaving(true);
      try {
        const res = await bffFetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`prefs PUT ${res.status}`);
        const next = (await res.json()) as PreferencesResponse;
        setPrefs(next);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.canvas, flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
    >
      <Text style={{ fontFamily: theme.fonts.sans, fontSize: 24, fontWeight: "600", color: theme.colors.ink, marginBottom: 4 }}>
        Settings
      </Text>
      <Text style={{ fontSize: 13, color: theme.colors.inkMuted, marginBottom: 24 }}>
        Synced across every device on the next SSE poll.
      </Text>
      {error ? (
        <MobileCard>
          <Text style={{ color: theme.colors.inkMuted, fontSize: 13 }}>{error}</Text>
        </MobileCard>
      ) : null}
      <MobileCard padding="md">
        <Text style={{ fontFamily: theme.fonts.sans, fontSize: 16, fontWeight: "600", color: theme.colors.ink, marginBottom: 12 }}>
          Default voice
        </Text>
        {prefs ? (
          <MobileVoicePicker
            voices={voices}
            value={prefs.defaultVoiceId}
            onChange={(voiceId) => updatePrefs({ defaultVoiceId: voiceId })}
          />
        ) : null}
      </MobileCard>
      <MobileCard padding="md" >
        <Text style={{ fontFamily: theme.fonts.sans, fontSize: 16, fontWeight: "600", color: theme.colors.ink, marginBottom: 12 }}>
          Default speed
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[0.75, 1, 1.25, 1.5, 2, 3].map((speed) => (
            <Pressable
              key={speed}
              accessibilityRole="button"
              accessibilityState={{ selected: prefs?.defaultSpeed === speed }}
              onPress={() => updatePrefs({ defaultSpeed: speed })}
              disabled={saving}
              style={({ pressed }) => ({
                minWidth: 56,
                minHeight: 44,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: prefs?.defaultSpeed === speed ? theme.colors.accent : theme.colors.border,
                backgroundColor: prefs?.defaultSpeed === speed ? theme.colors.accent : theme.colors.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text style={{
                color: prefs?.defaultSpeed === speed ? "#fff" : theme.colors.ink,
                fontVariant: ["tabular-nums"],
                fontWeight: "600",
              }}>
                {speed}×
              </Text>
            </Pressable>
          ))}
        </View>
      </MobileCard>
    </ScrollView>
  );
}
