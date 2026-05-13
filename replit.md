# Imam

Islamic prayer tracking mobile app that detects actual prayer movements using smartphone sensors (accelerometer/gyroscope), calculates offline prayer times, sends smart reminders, and tracks streaks/analytics — fully offline, no camera or microphone.

## Stack

- **Framework**: Expo SDK 54 / React Native 0.81.5 with expo-router v6
- **Sensors**: expo-sensors (Accelerometer + Gyroscope)
- **Haptics**: expo-haptics
- **Storage**: AsyncStorage
- **Notifications**: expo-notifications (wrapped in try/catch — crashes on Android Expo Go SDK53)

## Architecture

```
artifacts/imam/
├── app/
│   ├── (tabs)/          # Main tab screens: index (Home), analytics, settings
│   └── onboarding/      # Welcome → Setup → Calibration flow
├── components/
│   └── DetectionModal   # Live prayer detection UI (sensor feedback + FSM progress)
├── context/
│   └── AppContext        # Global state: settings, prayer times, streak, calibration
├── lib/
│   ├── motionEngine.ts  # Sensor FSM engine (core detection logic)
│   ├── haptics.ts       # Vibration helpers (correct / wrong / complete)
│   ├── storage.ts       # AsyncStorage helpers + types
│   └── prayerTimes.ts   # Offline prayer time calculation
└── hooks/
    └── useColors.ts     # Theme colors (dark: #0d1321 bg, #34d399 primary, #f59e0b gold)
```

## Detection Logic

**MotionEngine** (`lib/motionEngine.ts`):
- Sliding-window majority vote (WINDOW_SIZE=10) on accelerometer + gyroscope data
- Classifies: STANDING | RUKU | SUJOOD | SITTING | UNKNOWN
- With calibration: cosine-similarity against saved vectors; without: pitch-angle heuristics
- **3-second hold required** before any FSM transition is confirmed (prevents false positives)
- **Wrong posture vibrates every 2 seconds** until correct posture is held
- FSM states: IDLE → STANDING → RUKU → STANDING_RETURN → SUJOOD_1 → BETWEEN_SAJDAHS → SUJOOD_2 → TASHAHUD

**DetectionEvent types**:
- `STABILITY_UPDATE` — throttled heartbeat (400ms), includes holdProgress 0–1
- `POSTURE_VALIDATION` — `{isCorrect, isConfirmed, holdProgress}` on every position change and during 3s hold
- `POSITION_CHANGE` — FSM state changed (after confirmed hold)
- `RAKAH_COMPLETE` — rak'ah count incremented
- `PRAYER_COMPLETE` — full prayer done

## Settings

`AppSettings` in `context/AppContext`:
- `sensitivity`: 1–5 (minVotes = 10-sensitivity, minPositionHoldMs = 2400-sensitivity×400)
- `vibrationEnabled`: boolean
- `vibrationStrength`: "low" | "medium" | "high"
- `prayerTimeOffsetMinutes`: ±30

## User Preferences

- App name: **Imam** — folder: `artifacts/imam`
- Colors: dark bg `#0d1321`, primary emerald `#34d399`, gold `#f59e0b`
- No camera, no microphone, no cloud — fully on-device
- expo-notifications crashes on Android Expo Go SDK53 — already wrapped in try/catch
- Pre-existing TS error in `hooks/useColors.ts` — not blocking, unrelated to core features
