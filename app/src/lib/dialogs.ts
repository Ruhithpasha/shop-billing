import { Alert, Platform } from "react-native";

/** Yes/no question that also works in the web build (where Alert is a no-op). */
export function confirm(title: string, message: string, okLabel = "OK"): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: okLabel, onPress: () => resolve(true) },
    ]),
  );
}

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
