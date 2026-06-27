/**
 * Local ambient type stubs for the mobile app's heavy native deps.
 *
 * The Expo / React Native runtime is heavy and the install can fail
 * in restricted environments (the user's brief explicitly notes this).
 * We ship minimal ambient types so `tsc --noEmit` passes without the
 * full dep tree. The stubs match the API surface the source code
 * actually uses; runtime behavior is the user's responsibility once
 * they run `pnpm install` for real and `expo prebuild`.
 */

declare module "react-native" {
  // Loose types — the real RN types ship with the package.
  export function useColorScheme(): "light" | "dark" | null | undefined;
  export const View: React.ComponentType<{
    style?: unknown;
    children?: React.ReactNode;
    [k: string]: unknown;
  }>;
  export const Text: React.ComponentType<{
    style?: unknown;
    children?: React.ReactNode;
    onPress?: () => void;
    [k: string]: unknown;
  }>;
  export const ScrollView: React.ComponentType<{
    style?: unknown;
    contentContainerStyle?: unknown;
    children?: React.ReactNode;
    [k: string]: unknown;
  }>;
  export const Pressable: React.ComponentType<{
    onPress?: () => void;
    style?: unknown | ((state: { pressed: boolean }) => unknown);
    children?: React.ReactNode;
    disabled?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { selected?: boolean };
    [k: string]: unknown;
  }>;
  export const ActivityIndicator: React.ComponentType<{ color?: string }>;
  export const FlatList: React.ComponentType<{
    data: unknown[];
    keyExtractor: (item: unknown) => string;
    renderItem: (info: { item: unknown }) => React.ReactNode;
    ItemSeparatorComponent?: React.ComponentType;
    scrollEnabled?: boolean;
  }>;
  export const PanResponder: {
    create(config: unknown): {
      panHandlers: Record<string, unknown>;
    };
  };
  export type GestureResponderEvent = { nativeEvent: { locationX: number } };
  export type ViewProps = { children?: React.ReactNode; style?: unknown; [k: string]: unknown };
}

declare module "expo-secure-store" {
  const SecureStore: {
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
    deleteItemAsync(key: string): Promise<void>;
  };
  export default SecureStore;
}

declare module "expo-av" {
  export const Audio: {
    setAudioModeAsync(opts: Record<string, unknown>): Promise<void>;
    requestPermissionsAsync(): Promise<{ granted: boolean }>;
    Recording: {
      createAsync(opts: unknown): Promise<{ recording: Recording }>;
    };
    Sound: {
      createAsync(
        source: { uri: string },
        opts: { shouldPlay?: boolean; rate?: number },
      ): Promise<{ sound: Sound }>;
    };
  };
  export interface Recording {
    stopAndUnloadAsync(): Promise<void>;
    getURI(): string | null;
  }
  export interface Sound {
    setOnPlaybackStatusUpdate(cb: (status: PlaybackStatus) => void): void;
    playAsync(): Promise<void>;
    pauseAsync(): Promise<void>;
    setPositionAsync(ms: number): Promise<void>;
    setRateAsync(rate: number, preservePitch: boolean): Promise<void>;
    unloadAsync(): Promise<void>;
  }
  export interface PlaybackStatus {
    isLoaded: boolean;
    durationMillis?: number;
    positionMillis?: number;
    didJustFinish?: boolean;
  }
}

declare module "expo-linking" {
  export function addEventListener(
    type: "url",
    cb: (event: { url: string }) => void,
  ): { remove(): void };
}

declare module "expo-router" {
  export const Stack: React.ComponentType<{
    screenOptions?: unknown;
    children?: React.ReactNode;
  }>;
  export const Tabs: React.ComponentType<{
    screenOptions?: unknown;
    children?: React.ReactNode;
  }>;
  export function useRouter(): { push(href: string): void };
  export function useLocalSearchParams<T = Record<string, string>>(): T;
}

declare module "expo-router/entry" {
  const entry: string;
  export default entry;
}
