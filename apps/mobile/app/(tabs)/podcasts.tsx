/**
 * Podcasts tab — mobile equivalent of `apps/web/app/(app)/podcasts/page.tsx`.
 *
 * Lists ≤ 7 episodes per chunk (Miller's Law), style filters, and
 * the same "Create your first podcast" empty state.
 */

import * as React from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator, FlatList } from "react-native";
import { MobileCard } from "@/components/MobileCard";
import { bffFetch } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";

interface EpisodeRow {
  id: string;
  title: string;
  style: string;
  durationSeconds: number;
  createdAt: string;
}

export default function PodcastsScreen(): React.JSX.Element {
  const theme = useTheme();
  const [episodes, setEpisodes] = React.useState<EpisodeRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await bffFetch("/api/ai/podcasts");
        if (!res.ok) throw new Error(`podcasts ${res.status}`);
        const payload = (await res.json()) as { episodes: EpisodeRow[] };
        if (!cancelled) setEpisodes(payload.episodes);
      } catch (err) {
        if (!cancelled) setError("Can't reach ReadMaxxing — retry");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.canvas, flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
    >
      <Text style={{ fontFamily: theme.fonts.sans, fontSize: 24, fontWeight: "600", color: theme.colors.ink, marginBottom: 4 }}>
        Podcasts
      </Text>
      <Text style={{ fontSize: 13, color: theme.colors.inkMuted, marginBottom: 24 }}>
        AI-generated multi-speaker episodes from your docs.
      </Text>
      {loading ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : error ? (
        <MobileCard>
          <Text style={{ color: theme.colors.inkMuted }}>{error}</Text>
        </MobileCard>
      ) : !episodes || episodes.length === 0 ? (
        <MobileCard>
          <Text style={{ fontFamily: theme.fonts.sans, fontSize: 16, fontWeight: "600", color: theme.colors.ink }}>
            Create your first podcast
          </Text>
          <Text style={{ color: theme.colors.inkMuted, marginTop: 4, fontSize: 13 }}>
            Open the web app to turn a doc into a multi-speaker episode.
          </Text>
        </MobileCard>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={episodes.slice(0, 7)}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <MobileCard padding="sm">
              <Text style={{ fontFamily: theme.fonts.sans, fontSize: 16, fontWeight: "600", color: theme.colors.ink }}>
                {item.title}
              </Text>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: theme.colors.inkMuted }}>{item.style}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.inkMuted }}>
                  {Math.round(item.durationSeconds / 60)} min
                </Text>
              </View>
            </MobileCard>
          )}
        />
      )}
    </ScrollView>
  );
}
