import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import type { BodyPosition } from "./motionEngine";

const IS_NATIVE = Platform.OS !== "web";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function heavy() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}
async function medium() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
async function rigid() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
}

// ── Beep sound (expo-audio) ───────────────────────────────────────────────────

let _beepPlayer: AudioPlayer | null = null;
let _beepReady = false;

async function getBeepPlayer(): Promise<AudioPlayer | null> {
  if (_beepPlayer && _beepReady) return _beepPlayer;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
    });
    const player = createAudioPlayer(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../assets/audio/beep.wav")
    );
    player.volume = 1.0;
    player.loop = false;
    _beepPlayer = player;
    _beepReady = true;
    return player;
  } catch {
    return null;
  }
}

/** Pre-load the beep sound so it's ready instantly when needed. */
export function preloadBeep() {
  if (IS_NATIVE) getBeepPlayer();
}

/** Play a short beep to signal a wrong posture (alongside vibration). */
export async function playWrongBeep(enabled: boolean) {
  if (!IS_NATIVE || !enabled) return;
  try {
    const player = await getBeepPlayer();
    if (!player) return;
    player.seekTo(0);
    player.play();
  } catch { /* ignore */ }
}

// ── Two primary patterns ─────────────────────────────────────────────────────

/**
 * CORRECT posture confirmed — short sharp double-tap.
 */
export async function vibrateCorrect(
  enabled: boolean,
  strength: "low" | "medium" | "high" = "high"
) {
  if (!IS_NATIVE || !enabled) return;
  try {
    switch (strength) {
      case "low":
        await heavy();
        break;
      case "medium":
        await heavy();
        await sleep(60);
        await heavy();
        break;
      case "high":
        await heavy();
        await sleep(50);
        await heavy();
        await sleep(50);
        await medium();
        break;
    }
  } catch { /* ignore */ }
}

/**
 * WRONG posture detected — beep + slower triple warning vibration.
 */
export async function vibrateWrong(
  enabled: boolean,
  strength: "low" | "medium" | "high" = "high"
) {
  if (!IS_NATIVE || !enabled) return;
  try {
    // Play beep and vibration simultaneously
    playWrongBeep(enabled);
    switch (strength) {
      case "low":
        await heavy();
        await sleep(130);
        await heavy();
        break;
      case "medium":
        await heavy();
        await sleep(120);
        await heavy();
        await sleep(120);
        await heavy();
        break;
      case "high":
        await heavy();
        await sleep(110);
        await heavy();
        await sleep(110);
        await heavy();
        await sleep(110);
        await heavy();
        break;
    }
  } catch { /* ignore */ }
}

// ── Position-specific patterns ───────────────────────────────────────────────

export async function vibratePosition(
  position: BodyPosition,
  enabled: boolean
) {
  if (!IS_NATIVE || !enabled) return;
  try {
    switch (position) {
      case "RUKU":
        await heavy();
        break;
      case "SUJOOD":
        await heavy();
        await sleep(110);
        await medium();
        break;
      case "STANDING":
        await medium();
        break;
      case "SITTING":
        await rigid();
        break;
      default:
        break;
    }
  } catch { /* ignore */ }
}

// ── Event patterns ───────────────────────────────────────────────────────────

/** Double heavy thud — one rak'ah counted. */
export async function vibrateRakaatComplete(enabled: boolean) {
  if (!IS_NATIVE || !enabled) return;
  try {
    await heavy();
    await sleep(130);
    await heavy();
  } catch { /* ignore */ }
}

/** Triple heavy thud — prayer marked complete. */
export async function vibratePrayerComplete(enabled: boolean) {
  if (!IS_NATIVE || !enabled) return;
  try {
    await heavy();
    await sleep(120);
    await heavy();
    await sleep(120);
    await heavy();
  } catch { /* ignore */ }
}

/** Single heavy — for start/confirm action buttons. */
export async function vibrateAction(enabled: boolean) {
  if (!IS_NATIVE || !enabled) return;
  try {
    await heavy();
  } catch { /* ignore */ }
}

/** Success notification (calibration step complete, etc.) */
export async function vibrateSuccess(enabled: boolean) {
  if (!IS_NATIVE || !enabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch { /* ignore */ }
}
