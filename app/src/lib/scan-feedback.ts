import { Vibration } from "react-native";

type Player = { seekTo(seconds: number): Promise<void>; play(): void };

/** undefined = not loaded yet, null = sound unavailable on this build. */
let player: Player | null | undefined;

/**
 * Beep + short vibration when a barcode is read, like a shop scanner.
 * The sound is loaded lazily and defensively: on an app build that doesn't
 * include the audio module yet, it just vibrates instead of failing.
 */
export async function scanFeedback() {
  Vibration.vibrate(80);
  try {
    if (player === undefined) {
      const { createAudioPlayer } = await import("expo-audio");
      player = createAudioPlayer(require("../../assets/sounds/beep.wav"));
    }
    if (player) {
      await player.seekTo(0);
      player.play();
    }
  } catch {
    player = null;
  }
}
