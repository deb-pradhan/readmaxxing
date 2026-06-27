# @readmaxxing/mobile

Expo + React Native mobile app for ReadMaxxing.

## Quick start

```bash
pnpm install
pnpm --filter @readmaxxing/mobile prebuild
# Then run on a simulator or device:
pnpm --filter @readmaxxing/mobile ios
pnpm --filter @readmaxxing/mobile android
```

The `prebuild` step generates the native `ios/` and `android/` directories from the Expo config (`app.json`).

> The full Expo install is heavy — if you're only working on the BFF + extension, you can skip this app. The web app remains the source of truth for the reading experience.

## What's where

- `app/_layout.tsx` — root layout: `ThemeProvider` + `PrivyProvider` + `Stack`.
- `app/(tabs)/_layout.tsx` — bottom tab navigator (Library, Podcasts, Assistant, Settings).
- `app/(tabs)/index.tsx` — Library tab with `ContinueShelf`.
- `app/(tabs)/podcasts.tsx` — podcast feed.
- `app/(tabs)/assistant.tsx` — voice assistant (microphone → BFF `/api/ai/assistant`).
- `app/(tabs)/settings.tsx` — default voice + speed.
- `app/doc/[docId].tsx` — reader screen (reuses `@readmaxxing/core` SegmentTree).
- `components/MobilePlayer.tsx` — RN-native player primitive.
- `components/MobileCard.tsx` — RN-native card primitive.
- `components/MobileVoicePicker.tsx` — RN-native voice picker.
- `components/ThemeProvider.tsx` — light/dark theme tokens (mirror of web).
- `components/PrivyProvider.tsx` — web → mobile auth hand-off via deep link.
- `lib/auth.ts` — token cache (`expo-secure-store`) + BFF fetch shim.

## Cross-surface consistency (UI-UX.md §11)

- Uses the same `@readmaxxing/core` segment-tree model as the web app.
- Uses the same `@readmaxxing/ui/primitives/ContinueShelf` for the shelf.
- Mirrors the same color tokens (warm-paper light, true-dark, sepia, e-ink) — see `components/ThemeProvider.tsx`.
- Touch targets ≥ 44×44, primary CTA ≥ 56×56 (UI-UX.md §3.3).
- `prefers-reduced-motion` respected via the theme provider.

The web-app-only Tailwind primitives (`Player`, `KaraokeHighlighter`, `ReaderColumn`, `VoicePicker`) are intentionally *not* imported in the mobile app — RN can't run Tailwind classes. Instead the mobile app has RN-native ports (`MobilePlayer`, `MobileCard`, `MobileVoicePicker`) that share the same props + same accent/surface tokens. Promoting these back to `@readmaxxing/ui` happens in a follow-up when the package gains RN support.

## Background audio

Per UI-UX.md §4.10, listening continues when the screen locks. We declare `UIBackgroundModes: ["audio"]` in `app.json` and use `expo-av` Audio.Sound with `staysActiveInBackground: true` on iOS. The Android equivalent is the `Audio` service in the manifest.

## On-device TTS (Phase 6.1 follow-up)

The current build hits the BFF's cloud ElevenLabs proxy. To run offline, swap `expo-av` for `react-native-sherpa-onnx` (the Piper/Kokoro runtime). The reader screen already has the swap-in comment — see `app/doc/[docId].tsx`.

## Notifications

`expo-notifications` is wired at the config level (`app.json:plugins`) but the actual streak reminder schedule is a Phase 6.1 follow-up. The Expo push tokens are kept in `expo-secure-store` once the user signs in.

## Tests

```bash
pnpm --filter @readmaxxing/mobile test
```

Unit tests cover the auth shim + the storage contract. The RN runtime itself isn't tested in CI (the iOS/Android device farms are a Phase 6.1 add).
