/**
 * MobileCard — RN-native equivalent of `packages/ui/Card`.
 *
 * The shared `Card` primitive uses Tailwind/CSS classes which don't
 * apply in React Native. Rather than shipping a RN-compatible
 * variant of every UI primitive, we keep this thin wrapper in the
 * mobile app so the visuals match the web app (same border, surface
 * color, padding) but the implementation uses `View`/`StyleSheet`.
 *
 * When we need a richer cross-platform component (e.g. the floating
 * action button) we can promote this to `packages/ui` once the
 * package gains RN support.
 */

import * as React from "react";
import { View, type ViewProps } from "react-native";
import { useTheme } from "./ThemeProvider";

export interface MobileCardProps extends ViewProps {
  padding?: "none" | "sm" | "md" | "lg";
  inverse?: boolean;
}

const PAD: Record<NonNullable<MobileCardProps["padding"]>, number> = {
  none: 0,
  sm: 12,
  md: 16,
  lg: 24,
};

export const MobileCard = React.forwardRef<View, MobileCardProps>(function MobileCard(
  { padding = "md", inverse, style, children, ...rest },
  ref,
) {
  const theme = useTheme();
  const colors = inverse ? theme.colors.surfaceMuted : theme.colors.surface;
  return (
    <View
      ref={ref}
      {...rest}
      style={[
        {
          backgroundColor: colors,
          borderColor: theme.colors.borderSubtle,
          borderWidth: 1,
          borderRadius: 20,
          padding: PAD[padding],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});
