import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Remembers when a native feature (camera, photo model) was running, so that
 * if the app is killed by a native crash, the next launch knows which feature
 * did it and can skip it instead of crashing again.
 */
export type GuardedFeature = "camera" | "identify";

const key = (f: GuardedFeature) => `crashguard:${f}`;

/** True if the app died while this feature was running last time. */
export async function crashedLastTime(feature: GuardedFeature): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(feature))) != null;
  } catch {
    return false;
  }
}

/** Call before starting the feature. Resolves once the marker is safely stored. */
export async function markStarting(feature: GuardedFeature) {
  try {
    await AsyncStorage.setItem(key(feature), new Date().toISOString());
  } catch {
    // Storage failing must never block the feature itself.
  }
}

/** Call once the feature has run without crashing. */
export function markSafe(feature: GuardedFeature) {
  AsyncStorage.removeItem(key(feature)).catch(() => {});
}

/** Runs `fn` with the crash marker set around it. */
export async function guarded<T>(feature: GuardedFeature, fn: () => Promise<T>): Promise<T> {
  await markStarting(feature);
  try {
    return await fn();
  } finally {
    markSafe(feature);
  }
}
