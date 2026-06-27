/**
 * MobilePlayer — RN-native equivalent of `packages/ui/Player`.
 *
 * Same controls (play/pause, scrubber, time, speed presets) with the
 * exact same keyboard-equivalent affordances — but rendered with
 * `View`/`Pressable` instead of DOM. Honored:
 *
 *   - Primary play button ≥ 56×56 (UI-UX.md §3.3, §4.2)
 *   - Scrubber uses a horizontal `View` track + thumb; drag is via
 *     `onResponderMove` (Phase 6.1 can promote this to Reanimated).
 *   - Speed presets 1× / 1.25× / 1.5× / 2× / 3× as quick-tap chips.
 *   - Speed 0.5×–4.5× preserved when the consumer wires `setRate` on
 *     the underlying Audio.Sound.
 *   - Status label announced via `accessibilityLiveRegion`.
 *
 * The shared `Player` primitive stays the source of truth for the
 * web app. Mobile ships this thin port so we don't have to fork the
 * design system just for RN.
 */

import * as React from "react";
import { View, Text, Pressable, GestureResponderEvent, PanResponder } from "react-native";
import { useTheme } from "./ThemeProvider";

export interface MobilePlayerProps {
  playing: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
  onSeek: (timeSeconds: number) => void;
  speed: number;
  onSpeedChange: (next: number) => void;
  voiceLabel?: string;
  loading?: boolean;
  /** Human + actionable error message per UI-UX.md §11. */
  errorMessage?: string | null;
  /** Status string for the screen-reader live region. */
  statusLabel?: string;
}

const SPEED_PRESETS = [1, 1.25, 1.5, 2, 3] as const;

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MobilePlayer({
  playing,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  speed,
  onSpeedChange,
  voiceLabel,
  loading = false,
  errorMessage = null,
  statusLabel,
}: MobilePlayerProps): React.JSX.Element {
  const theme = useTheme();
  const trackRef = React.useRef<View | null>(null);
  const [trackWidth, setTrackWidth] = React.useState(0);
  const [trackX, setTrackX] = React.useState(0);

  const scrubberPan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => duration > 0,
      onMoveShouldSetPanResponder: () => duration > 0,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const x = e.nativeEvent.locationX;
        if (trackWidth > 0 && duration > 0) {
          const ratio = Math.max(0, Math.min(1, x / trackWidth));
          onSeek(ratio * duration);
        }
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const x = e.nativeEvent.locationX;
        if (trackWidth > 0 && duration > 0) {
          const ratio = Math.max(0, Math.min(1, x / trackWidth));
          onSeek(ratio * duration);
        }
      },
    }),
  ).current;

  const safe = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Player${voiceLabel ? ` — ${voiceLabel}` : ""}`}
      style={{
        flexDirection: "column",
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.borderSubtle,
        borderTopWidth: 1,
      }}
    >
      <View
        ref={trackRef}
        onLayout={(e) => {
          setTrackWidth(e.nativeEvent.layout.width);
          e.target.measure((_x, _y, width, _h, pageX) => {
            setTrackX(pageX);
          });
        }}
        {...scrubberPan.panHandlers}
        style={{
          height: 32,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.colors.borderSubtle,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            height: 4,
            width: `${safe * 100}%`,
            borderRadius: 2,
            backgroundColor: theme.colors.accent,
          }}
        />
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={`Seek ${Math.round(safe * 100)} percent`}
          style={{
            position: "absolute",
            left: `${safe * 100}%`,
            width: 16,
            height: 16,
            marginLeft: -8,
            borderRadius: 8,
            backgroundColor: theme.colors.accent,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause" : "Play"}
          onPress={onPlayPause}
          style={({ pressed }) => ({
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.colors.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.92 : 1,
            marginRight: 12,
          })}
        >
          <Text style={{ color: "#fff", fontSize: 24 }}>{loading ? "…" : playing ? "⏸" : "▶"}</Text>
        </Pressable>
        <Text style={{ fontVariant: ["tabular-nums"], color: theme.colors.inkMuted, marginRight: 12 }}>
          {fmt(currentTime)} / {fmt(duration)}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", flex: 1, gap: 6, justifyContent: "flex-end" }}>
          {SPEED_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityState={{ selected: speed === preset }}
              onPress={() => onSpeedChange(preset)}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 44,
                paddingHorizontal: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: speed === preset ? theme.colors.accent : theme.colors.border,
                backgroundColor: speed === preset ? theme.colors.accent : theme.colors.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text
                style={{
                  color: speed === preset ? "#fff" : theme.colors.ink,
                  fontVariant: ["tabular-nums"],
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {preset}×
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {voiceLabel ? (
        <Text style={{ marginTop: 4, fontSize: 12, color: theme.colors.inkMuted }}>♪ {voiceLabel}</Text>
      ) : null}
      {errorMessage ? (
        <Text accessibilityLiveRegion="assertive" style={{ marginTop: 8, fontSize: 13, color: theme.colors.danger }}>
          {errorMessage}
        </Text>
      ) : null}
      {statusLabel ? (
        <Text accessibilityLiveRegion="polite" style={{ position: "absolute", opacity: 0 }}>
          {statusLabel}
        </Text>
      ) : null}
    </View>
  );
}
