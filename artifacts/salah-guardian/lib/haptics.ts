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

/**
 * Distinct vibration for each prayer body position.
 *
 * RUKU    – single heavy thud (bow down)
 * SUJOOD  – heavy + short gap + medium (body settling into prostration)
 * STANDING – medium (standing back up, lighter movement)
 * SITTING  – rigid (firm but brief, seated pause)
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

/**
 * Double heavy thud — one rak'ah counted.
 * Unmistakably different from a single position change.
 */
export async function vibrateRakaatComplete(enabled: boolean) {
  if (!IS_NATIVE || !enabled) return;
  try {
    await heavy();
    await sleep(130);
    await heavy();
  } catch { /* ignore */ }
}

/**
 * Triple heavy thud — prayer marked complete.
 */
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

/**
 * Single heavy tap — for buttons that start/confirm important actions.
 */
export async function vibrateAction(enabled: boolean) {
  if (!IS_NATIVE || !enabled) return;
  try {
    await heavy();
  } catch { /* ignore */ }
}

/**
 * Success notification (calibration step complete, etc.)
 */
export async function vibrateSuccess(enabled: boolean) {
  if (!IS_NATIVE || !enabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch { /* ignore */ }
}
