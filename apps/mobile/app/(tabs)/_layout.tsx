/**
 * Bottom tab navigator — the mobile app's primary navigation.
 *
 * Per UI-UX.md §3.3 (Fitts's Law): tabs are reachable with the thumb
 * arc. We use the bottom tabs pattern with ≥ 44×44 targets. Order:
 *   Library → Podcasts → Assistant → Settings
 * (No "Continue" tab — the ContinueShelf is at the top of Library.)
 */

import { Tabs } from "expo-router";
import { useTheme } from "@/components/ThemeProvider";

export default function TabsLayout(): React.JSX.Element {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.surface },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderSubtle,
          height: 64, // ≥ 64px target height (UI-UX.md §3.3)
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Library",
          tabBarAccessibilityLabel: "Library tab",
          tabBarIcon: ({ color, size }) => <TabIcon glyph="📚" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="podcasts"
        options={{
          title: "Podcasts",
          tabBarAccessibilityLabel: "Podcasts tab",
          tabBarIcon: ({ color, size }) => <TabIcon glyph="🎙" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "Assistant",
          tabBarAccessibilityLabel: "Voice assistant tab",
          tabBarIcon: ({ color, size }) => <TabIcon glyph="✨" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarAccessibilityLabel: "Settings tab",
          tabBarIcon: ({ color, size }) => <TabIcon glyph="⚙" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ glyph, color, size }: { glyph: string; color: string; size: number }): React.JSX.Element {
  return (
    <span style={{ fontSize: size, color, lineHeight: size + 4 }} aria-hidden>
      {glyph}
    </span>
  );
}
