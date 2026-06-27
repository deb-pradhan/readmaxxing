/**
 * Library tab — mobile equivalent of `apps/web/app/(app)/library/page.tsx`.
 *
 * Per UI-UX.md §6: calm grid, ContinueShelf at the top, "Load more"
 * (no infinite scroll — Miller's Law).
 *
 * Uses the shared `ContinueShelf` primitive from `@readmaxxing/ui`
 * — UI-UX.md §11 consistency rule. The mobile-specific DocCard is a
 * small wrapper around the shared Card primitive.
 */

import * as React from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ContinueShelf } from "@readmaxxing/ui";
import type { ShelfItem } from "@readmaxxing/ui";
import type { DocumentMeta, PlaybackPosition, SegmentTree } from "@readmaxxing/core";
import { bffFetch, useAuth } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";
import { MobileCard } from "@/components/MobileCard";

interface FetchedRow {
  position: PlaybackPosition;
  document: DocumentMeta | null;
  tree: SegmentTree | null;
}

export default function LibraryScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const [items, setItems] = React.useState<ShelfItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await bffFetch("/api/positions");
        if (!res.ok) throw new Error(`positions ${res.status}`);
        const payload = (await res.json()) as { positions: FetchedRow[] };
        if (cancelled) return;
        const enriched: ShelfItem[] = payload.positions.slice(0, 5).map((row) => {
          const wordCount = row.tree?.wordCount ?? 0;
          const wordOffset = Math.max(0, row.position.wordOffset);
          return {
            position: row.position,
            document: row.document,
            tree: row.tree,
            percent:
              wordCount > 0 ? Math.min(100, Math.round((wordOffset / wordCount) * 100)) : 0,
            minutesLeft:
              wordCount > 0 ? Math.max(0, Math.round((wordCount - wordOffset) / 155)) : 0,
          };
        });
        setItems(enriched);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError("Can't reach ReadMaxxing — retry");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.canvas, flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
    >
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontFamily: theme.fonts.sans, fontSize: 24, fontWeight: "600", color: theme.colors.ink }}>
          Continue listening
        </Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: theme.colors.inkMuted }}>
          Pick up where you left off — every device, every word.
        </Text>
      </View>
      {loading ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : error ? (
        <MobileCard>
          <Text style={{ color: theme.colors.inkMuted, fontSize: 13 }}>{error}</Text>
        </MobileCard>
      ) : (
        <ContinueShelf
          itemsOverride={items ?? []}
          emptyStateMessage="Nothing here yet — import something from the web app to start listening."
          onItemClick={(item) => router.push(`/doc/${item.position.documentId}`)}
        />
      )}
      <View style={{ marginTop: 32, gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the web app to import a new document"
          onPress={() => router.push("https://readmaxxing.app/library")}
          style={({ pressed }) => ({
            backgroundColor: theme.colors.accent,
            paddingHorizontal: 24,
            paddingVertical: 16,
            borderRadius: 12,
            minHeight: 56, // ≥ 56px primary CTA (UI-UX.md §3.3)
            alignItems: "center",
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            Add a new doc
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
