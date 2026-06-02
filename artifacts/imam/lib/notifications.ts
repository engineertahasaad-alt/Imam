import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── Notification handler (foreground) ───────────────────────────────────────
if (Platform.OS !== "web") {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    });
  } catch {
    // expo-notifications not fully supported in Expo Go on SDK 53+
  }
}
// ─── Channel IDs ──────────────────────────────────────────────────────────────
// FIX: Added _v2 suffix to force Android to recreate channels with sound.
// Android locks channel settings after first creation — changing sound later is ignored.
// Bumping the version (v2 → v3 etc.) creates fresh channels.
const CHANNEL_VERSION = "v2";
export const CHANNEL_ADHAN = (voice: string) => `adhan_${voice}_${CHANNEL_VERSION}`;
export const CHANNEL_PRAYER = "prayer_reminder_v2";
export const CHANNEL_AZKAR = "azkar_reminder_v2";

// BUG FIX: Android channel sounds must be specified WITHOUT file extension.
// The files are bundled as res/raw/azan1, res/raw/azan2, etc.
const ADHAN_CHANNEL_SOUNDS: Record<string, string> = {
  alafasy: "azan1",
  abdulbasit: "azan2",
  madinah: "azan3",
  makkah: "azan4",
  sudais: "azan5",
  sghamdi: "azan6",
  haifa: "azan7",
  turkey: "azan8",
};