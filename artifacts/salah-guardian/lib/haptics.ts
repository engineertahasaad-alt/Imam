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

// ── Two primary patterns ────────────────────────────────────────────────────

/**
 * CORRECT posture confirmed — short sharp double-tap.
 * Meaning: "You are in the right prayer position."
 * Strength variants:
 *   low    → single heavy
 *   medium → heavy + 60ms + heavy
 *   high   → heavy + 50ms + heavy + 50ms + medium  (triple rapid)
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
 * WRONG posture detected — slower triple warning.
 * Meaning: "Your posture does NOT match the expected prayer step."
 * Clearly different feel from vibrateCorrect — longer, more insistent.
 * Strength variants:
 *   low    → heavy + 130ms + heavy
 *   medium → heavy + 120ms + heavy + 120ms + heavy
 *   high   → heavy + 110ms + heavy + 110ms + heavy + 110ms + heavy  (quad)
 */
export async function vibrateWrong(
  enabled: boolean,
  strength: "low" | "medium" | "high" = "high"
) {
  if (!IS_NATIVE || !enabled) return;
  try {
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

// ── Position-specific patterns ──────────────────────────────────────────────

/**
 * Distinct haptic per prayer body position:
 *   RUKU    – single heavy (bow down)
 *   SUJOOD  – heavy + gap + medium (two-part, body settling)
 *   STANDING– medium (standing back up)
 *   SITTING – rigid (brief, firm pause)
 */
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

// ── Event patterns ──────────────────────────────────────────────────────────

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
