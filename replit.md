# Salah Guardian

Islamic prayer tracking mobile app that detects actual prayer movements using smartphone sensors (accelerometer/gyroscope), calculates offline prayer times, sends smart reminders, and tracks streaks/analytics — fully offline, no camera or microphone.

## Run & Operate

- Expo dev server starts automatically via the `artifacts/salah-guardian: expo` workflow
- Scan the QR code in the workflow logs with Expo Go to test on a physical Android/iOS device
- Required env: none (fully local, no backend)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54 + React Native 0.81.5 + Expo Router 6
- Sensors: expo-sensors (Accelerometer + Gyroscope)
- Notifications: expo-notifications
- Location: expo-location
- Storage: @react-native-async-storage/async-storage
- Background: expo-task-manager, expo-background-fetch
- Build tool: Metro bundler

## Where things live

- `artifacts/salah-guardian/` — the full Expo app
  - `app/` — Expo Router screens (onboarding stack + 4-tab main app)
  - `app/onboarding/` — welcome → setup → calibration flow
  - `app/(tabs)/` — index (home), log, stats, settings
  - `context/AppContext.tsx` — global state (settings, prayer times, detection)
  - `lib/prayerCalculator.ts` — offline solar-based prayer time algorithm
  - `lib/motionEngine.ts` — FSM motion detection engine with calibration
  - `lib/storage.ts` — AsyncStorage CRUD (settings, prayer records, calibration)
  - `lib/notifications.ts` — Expo notification scheduling
  - `constants/colors.ts` — Islamic dark/light theme (dark bg #0d1321, emerald primary #34d399, gold #f59e0b)

## Architecture decisions

- **Fully offline**: Prayer times computed locally using spherical solar geometry — no adhan cloud API needed
- **FSM motion engine**: 7-state finite state machine (STANDING → RUKU → STANDING_RETURN → SUJOOD_1 → BETWEEN_SAJDAHS → SUJOOD_2 → TASHAHUD); counts rak'aat automatically
- **Calibration-first**: Cosine similarity against user-recorded reference vectors for each position; falls back to angle-based classification without calibration
- **AsyncStorage over SQLite**: Simpler key-based storage avoids native module issues in Expo Go; structured with prefixed keys for prayers, settings, calibration
- **Foreground detection**: Prayer detection is user-initiated (tap "Start Prayer Detection") to avoid battery drain; notifications handle background reminders

## Product

- Onboarding: welcome (privacy explanation) → location setup (GPS or city presets) → motion calibration (4-position wizard)
- Home tab: next prayer countdown, today's 5 prayers with detection status, streak card, detect prayer button
- Prayer detection: live FSM modal showing body position, rak'ah counter, confidence score
- Log tab: 14-day calendar view with per-prayer completion chips; tap to manually confirm missed prayers
- Stats tab: 7-day bar chart, consistency percentage, per-prayer performance bars
- Settings: location, calculation method (MWL/ISNA/Egypt/Makkah/Karachi/Gulf), notifications, vibration, re-calibrate

## User preferences

- No camera, no microphone, no data collection — sensors only
- Fully offline
- Islamic aesthetic: dark navy background, emerald green + gold accents

## Gotchas

- expo-sensors has no web support — DetectionModal gracefully degrades on web with a message
- Calibration step on web uses hardcoded default vectors (simulated 3-second timer)
- expo-notifications web support is partial — notifications only work on physical device
- Prayer detection accuracy depends on calibration; skip-calibration uses angle-based defaults

## Pointers

- See `.local/skills/expo/SKILL.md` for Expo Go compatibility list and patterns
- Prayer time algorithm reference: spherical solar geometry (same approach as adhan-js)
