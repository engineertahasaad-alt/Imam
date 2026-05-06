import { Accelerometer, Gyroscope } from "expo-sensors";
import { Platform } from "react-native";

export type BodyPosition =
  | "STANDING"
  | "RUKU"
  | "SUJOOD"
  | "SITTING"
  | "UNKNOWN";

export interface CalibrationProfile {
  standing: [number, number, number];
  ruku: [number, number, number];
  sujood: [number, number, number];
  sitting: [number, number, number];
  calibratedAt: number;
  pocketSide: "left" | "right" | "unknown";
}

export interface DetectionEvent {
  type: "POSITION_CHANGE" | "RAKAH_COMPLETE" | "PRAYER_COMPLETE" | "ERROR" | "STABILITY_UPDATE";
  position?: BodyPosition;
  rakaatCount?: number;
  confidence?: number;
  stability?: number;
  fsmState?: string;
  timestamp: number;
  message?: string;
}

type FSMState =
  | "IDLE"
  | "STANDING"
  | "RUKU"
  | "STANDING_RETURN"
  | "SUJOOD_1"
  | "BETWEEN_SAJDAHS"
  | "SUJOOD_2"
  | "TASHAHUD";

// ─── Tuning constants ────────────────────────────────────────────
const SENSOR_INTERVAL_MS = 80;          // ~12.5 Hz sensor polling
const ACCEL_ALPHA = 0.18;               // low-pass for gravity
const GYRO_ALPHA = 0.25;                // low-pass for angular rate
const WINDOW_SIZE = 10;                 // sliding window length
const MIN_VOTES = 7;                    // votes needed (70% majority)
const GYRO_STABLE_THRESHOLD = 0.30;    // rad/s — below = phone is still
const MAG_MIN = 0.80;                  // minimum g-vector magnitude
const MAG_MAX = 1.25;                  // maximum g-vector magnitude
const COSINE_SOFT_THRESHOLD = 0.72;    // soft match (low confidence)
const COSINE_HARD_THRESHOLD = 0.88;    // hard match (high confidence)
const STABILITY_EMIT_INTERVAL = 400;   // ms between stability UI updates
const FSM_STUCK_TIMEOUT = 45_000;      // ms before stuck-state reset
// ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function magnitude(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

function cosine(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const ma = magnitude(a[0], a[1], a[2]);
  const mb = magnitude(b[0], b[1], b[2]);
  if (ma < 1e-6 || mb < 1e-6) return 0;
  return clamp(dot / (ma * mb), -1, 1);
}

export class MotionEngine {
  // ── Sensor subscriptions ────────────────────────────────────────
  private accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
  private gyroSub: ReturnType<typeof Gyroscope.addListener> | null = null;

  // ── Smoothed gravity vector (low-pass) ──────────────────────────
  private gx = 0; private gy = 0; private gz = 0;

  // ── Smoothed gyroscope (angular velocity, rad/s) ────────────────
  private wx = 0; private wy = 0; private wz = 0;

  // ── Derived stability (0 = moving fast, 1 = perfectly still) ───
  private stability = 1;

  // ── Sliding window of recent position votes ──────────────────────
  private window: BodyPosition[] = [];
  private windowConf: number[] = [];

  // ── Confirmed position + raw candidate ──────────────────────────
  private currentPosition: BodyPosition = "UNKNOWN";
  private pendingPosition: BodyPosition = "UNKNOWN";
  private pendingVotes = 0;

  // ── FSM ──────────────────────────────────────────────────────────
  private fsmState: FSMState = "IDLE";
  private rakaatCount = 0;
  private startTime = 0;
  private fsmStateEnteredAt = 0;
  private stuckGuardTimer: ReturnType<typeof setInterval> | null = null;

  // ── Calibration ──────────────────────────────────────────────────
  private calibration: CalibrationProfile | null = null;

  // ── Adaptive cosine threshold ───────────────────────────────────
  private adaptedThreshold = COSINE_SOFT_THRESHOLD;

  // ── Calibration recording ────────────────────────────────────────
  private isRecording = false;
  private recordedSamples: Array<[number, number, number]> = [];
  private recordingTimer: ReturnType<typeof setTimeout> | null = null;
  private onRecordingComplete: ((avg: [number, number, number]) => void) | null = null;

  // ── Stability emit throttle ──────────────────────────────────────
  private lastStabilityEmit = 0;

  // ── Callback ─────────────────────────────────────────────────────
  private onEvent: ((event: DetectionEvent) => void) | null = null;

  constructor(onEvent: (event: DetectionEvent) => void) {
    this.onEvent = onEvent;
  }

  setCalibration(profile: CalibrationProfile) {
    this.calibration = profile;
    this.adaptedThreshold = this.computeAdaptiveThreshold(profile);
  }

  /** Compute an adaptive threshold from how distinct the calibration vectors are */
  private computeAdaptiveThreshold(profile: CalibrationProfile): number {
    const positions: [number, number, number][] = [
      profile.standing,
      profile.ruku,
      profile.sujood,
      profile.sitting,
    ];
    let minSim = 1;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const sim = cosine(positions[i], positions[j]);
        if (sim < minSim) minSim = sim;
      }
    }
    // If vectors are well-separated (minSim < 0.5), we can afford a higher threshold.
    // If they're close together, lower the threshold to still classify.
    const spread = clamp(1 - minSim, 0, 1); // 0 = identical, 1 = opposite
    return COSINE_SOFT_THRESHOLD + spread * (COSINE_HARD_THRESHOLD - COSINE_SOFT_THRESHOLD);
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  start() {
    if (Platform.OS === "web") {
      this.onEvent?.({
        type: "ERROR",
        timestamp: Date.now(),
        message: "Sensor detection not available on web",
      });
      return;
    }

    this.fsmState = "STANDING";
    this.rakaatCount = 0;
    this.startTime = Date.now();
    this.fsmStateEnteredAt = Date.now();
    this.currentPosition = "UNKNOWN";
    this.window = [];
    this.windowConf = [];
    this.pendingPosition = "UNKNOWN";
    this.pendingVotes = 0;

    this.startSensors();
    this.startStuckGuard();
  }

  stop() {
    this.stopSensors();
    this.fsmState = "IDLE";
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (this.stuckGuardTimer) {
      clearInterval(this.stuckGuardTimer);
      this.stuckGuardTimer = null;
    }
  }

  private startSensors() {
    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    Gyroscope.setUpdateInterval(SENSOR_INTERVAL_MS);

    this.accelSub = Accelerometer.addListener(({ x, y, z }) => {
      // Low-pass filter gravity
      this.gx = ACCEL_ALPHA * x + (1 - ACCEL_ALPHA) * this.gx;
      this.gy = ACCEL_ALPHA * y + (1 - ACCEL_ALPHA) * this.gy;
      this.gz = ACCEL_ALPHA * z + (1 - ACCEL_ALPHA) * this.gz;
      this.processSample();
    });

    this.gyroSub = Gyroscope.addListener(({ x, y, z }) => {
      // Low-pass filter angular velocity
      this.wx = GYRO_ALPHA * x + (1 - GYRO_ALPHA) * this.wx;
      this.wy = GYRO_ALPHA * y + (1 - GYRO_ALPHA) * this.wy;
      this.wz = GYRO_ALPHA * z + (1 - GYRO_ALPHA) * this.wz;
      // Update stability
      const gyroMag = magnitude(this.wx, this.wy, this.wz);
      const rawStability = clamp(1 - gyroMag / GYRO_STABLE_THRESHOLD, 0, 1);
      this.stability = 0.7 * this.stability + 0.3 * rawStability;
    });
  }

  private stopSensors() {
    this.accelSub?.remove();
    this.gyroSub?.remove();
    this.accelSub = null;
    this.gyroSub = null;
  }

  /** Guard timer: if FSM is stuck in a non-STANDING state too long, reset */
  private startStuckGuard() {
    this.stuckGuardTimer = setInterval(() => {
      if (
        this.fsmState !== "IDLE" &&
        this.fsmState !== "STANDING" &&
        this.fsmState !== "TASHAHUD" &&
        Date.now() - this.fsmStateEnteredAt > FSM_STUCK_TIMEOUT
      ) {
        // Soft-reset to STANDING without counting a rak'ah
        this.fsmState = "STANDING";
        this.fsmStateEnteredAt = Date.now();
        this.currentPosition = "UNKNOWN";
        this.window = [];
      }
    }, 5000);
  }

  // ── Calibration recording ────────────────────────────────────────

  startRecording(
    durationMs: number,
    onComplete: (avg: [number, number, number]) => void
  ) {
    this.isRecording = true;
    this.recordedSamples = [];
    this.onRecordingComplete = onComplete;

    if (!this.accelSub) {
      Accelerometer.setUpdateInterval(80);
      this.accelSub = Accelerometer.addListener(({ x, y, z }) => {
        this.gx = ACCEL_ALPHA * x + (1 - ACCEL_ALPHA) * this.gx;
        this.gy = ACCEL_ALPHA * y + (1 - ACCEL_ALPHA) * this.gy;
        this.gz = ACCEL_ALPHA * z + (1 - ACCEL_ALPHA) * this.gz;
        if (this.isRecording) {
          this.recordedSamples.push([this.gx, this.gy, this.gz]);
        }
      });
    }

    this.recordingTimer = setTimeout(() => {
      this.isRecording = false;
      const avg = this.averageSamples(this.recordedSamples);
      this.onRecordingComplete?.(avg);
    }, durationMs);
  }

  stopRecording() {
    this.isRecording = false;
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (this.accelSub && this.fsmState === "IDLE") {
      this.accelSub.remove();
      this.accelSub = null;
    }
  }

  private averageSamples(
    samples: Array<[number, number, number]>
  ): [number, number, number] {
    if (samples.length === 0) return [0, 0, -1];
    // Drop first 20% of samples (settle time) and last 5% (finger release)
    const drop = Math.floor(samples.length * 0.2);
    const trimmed = samples.slice(drop, samples.length - Math.floor(samples.length * 0.05));
    if (trimmed.length === 0) return [0, 0, -1];
    const sum = trimmed.reduce(
      (acc, s) =>
        [acc[0] + s[0], acc[1] + s[1], acc[2] + s[2]] as [number, number, number],
      [0, 0, 0] as [number, number, number]
    );
    return [
      sum[0] / trimmed.length,
      sum[1] / trimmed.length,
      sum[2] / trimmed.length,
    ];
  }

  // ── Position classification ──────────────────────────────────────

  private classifyPosition(): { position: BodyPosition; confidence: number } {
    const g: [number, number, number] = [this.gx, this.gy, this.gz];
    const mag = magnitude(g[0], g[1], g[2]);

    // Magnitude health check: must be close to 1g
    const magHealth = mag < MAG_MIN || mag > MAG_MAX
      ? 0
      : 1 - Math.abs(1 - mag);

    if (this.calibration) {
      return this.classifyWithCalibration(g, magHealth);
    }
    return this.classifyFromAngles(g, mag, magHealth);
  }

  private classifyWithCalibration(
    g: [number, number, number],
    magHealth: number
  ): { position: BodyPosition; confidence: number } {
    const cal = this.calibration!;
    const scores: Record<BodyPosition, number> = {
      STANDING: cosine(g, cal.standing),
      RUKU: cosine(g, cal.ruku),
      SUJOOD: cosine(g, cal.sujood),
      SITTING: cosine(g, cal.sitting),
      UNKNOWN: -1,
    };

    const entries = (
      Object.entries(scores) as Array<[BodyPosition, number]>
    ).filter(([k]) => k !== "UNKNOWN");

    entries.sort((a, b) => b[1] - a[1]);
    const [bestPos, bestSim] = entries[0];
    const [, secondSim] = entries[1];

    // Margin between top-2 scores — wider margin = more confident
    const margin = bestSim - secondSim;
    const marginFactor = clamp(margin / 0.2, 0, 1);

    // Raw similarity mapped to 0-1
    const simFactor = clamp((bestSim - this.adaptedThreshold) / (1 - this.adaptedThreshold), 0, 1);

    // Combined confidence
    const confidence =
      0.50 * simFactor +
      0.25 * marginFactor +
      0.15 * magHealth +
      0.10 * this.stability;

    if (bestSim < this.adaptedThreshold) {
      return { position: "UNKNOWN", confidence: 0 };
    }

    return { position: bestPos, confidence: clamp(confidence, 0, 1) };
  }

  /**
   * Angle-based fallback: uses pitch/roll computed from gravity vector.
   *
   * Coordinate assumption (phone in pocket, portrait orientation):
   *   y-axis ≈ phone's long axis (up when upright)
   *   z-axis ≈ phone face direction
   *   x-axis ≈ lateral
   *
   * STANDING : gravity mostly along -y (|gy| dominant, gy < 0)
   * RUKU     : gravity shifts to z (body bends ~90°, |gz| dominant)
   * SUJOOD   : similar to ruku but further tilt, often gz > 0 when face-down
   * SITTING  : between standing and ruku, mixed y/z
   */
  private classifyFromAngles(
    g: [number, number, number],
    mag: number,
    magHealth: number
  ): { position: BodyPosition; confidence: number } {
    if (mag < 0.3) return { position: "UNKNOWN", confidence: 0 };

    const [gx, gy, gz] = g;

    // Normalized fractions of each axis contribution
    const fx = Math.abs(gx) / mag; // lateral
    const fy = Math.abs(gy) / mag; // vertical (up/down)
    const fz = Math.abs(gz) / mag; // front/back

    // Pitch angle: angle of the phone's long axis from vertical
    // 0° = upright (standing), 90° = horizontal (bowing)
    const pitchRad = Math.atan2(Math.sqrt(gx * gx + gz * gz), Math.abs(gy));
    const pitchDeg = (pitchRad * 180) / Math.PI;

    let position: BodyPosition;
    let rawConf: number;

    if (pitchDeg < 25) {
      // Nearly vertical → STANDING
      position = "STANDING";
      rawConf = fy;
    } else if (pitchDeg < 55) {
      // Partial tilt → SITTING
      position = "SITTING";
      rawConf = 0.65;
    } else if (pitchDeg < 78) {
      // Significant forward tilt → RUKU
      position = "RUKU";
      rawConf = clamp((pitchDeg - 55) / 23, 0, 1) * 0.85 + 0.15;
    } else {
      // Almost flat or face-down → SUJOOD
      position = "SUJOOD";
      rawConf = fz + fx;
    }

    // Additional: if gz is strongly negative and pitchDeg > 75, lean toward SUJOOD
    if (pitchDeg > 68 && gz < -0.5) {
      position = "SUJOOD";
      rawConf = Math.abs(gz) / mag;
    }

    const confidence =
      0.65 * rawConf + 0.20 * magHealth + 0.15 * this.stability;

    return { position, confidence: clamp(confidence, 0, 1) };
  }

  // ── Sliding-window majority voting ───────────────────────────────

  private processSample() {
    if (this.fsmState === "IDLE") return;

    // Motion gate: if phone is actively rotating, skip classification
    const gyroMag = magnitude(this.wx, this.wy, this.wz);
    if (gyroMag > GYRO_STABLE_THRESHOLD * 2.5) {
      // Definitely moving — push UNKNOWN into window to dilute votes
      this.window.push("UNKNOWN");
      if (this.window.length > WINDOW_SIZE) this.window.shift();
      return;
    }

    const { position, confidence } = this.classifyPosition();

    // Push into sliding window
    this.window.push(position);
    this.windowConf.push(confidence);
    if (this.window.length > WINDOW_SIZE) {
      this.window.shift();
      this.windowConf.shift();
    }

    // Count votes for each position in window
    const votes: Partial<Record<BodyPosition, number>> = {};
    for (const p of this.window) {
      votes[p] = (votes[p] ?? 0) + 1;
    }

    // Find winner
    let winnerPos: BodyPosition = "UNKNOWN";
    let winnerVotes = 0;
    for (const [p, v] of Object.entries(votes) as Array<[BodyPosition, number]>) {
      if (v > winnerVotes) {
        winnerVotes = v;
        winnerPos = p;
      }
    }

    // Require a majority in the window
    const windowFull = this.window.length >= WINDOW_SIZE;
    const hasMajority = windowFull && winnerVotes >= MIN_VOTES;

    // Average confidence for the winning position
    const avgConf = this.windowConf
      .filter((_, i) => this.window[i] === winnerPos)
      .reduce((s, c) => s + c, 0) /
      Math.max(winnerVotes, 1);

    // Emit stability updates to the UI (throttled)
    const now = Date.now();
    if (now - this.lastStabilityEmit > STABILITY_EMIT_INTERVAL) {
      this.lastStabilityEmit = now;
      this.onEvent?.({
        type: "STABILITY_UPDATE",
        stability: this.stability,
        confidence: avgConf,
        position: winnerPos,
        fsmState: this.fsmState,
        timestamp: now,
      });
    }

    if (!hasMajority || winnerPos === "UNKNOWN") return;

    // Confirmed position — only trigger FSM if it changed
    if (winnerPos !== this.currentPosition) {
      this.currentPosition = winnerPos;
      this.updateFSM(winnerPos, avgConf);
    }
  }

  // ── Finite state machine ─────────────────────────────────────────

  private transitionFSM(newState: FSMState) {
    this.fsmState = newState;
    this.fsmStateEnteredAt = Date.now();
  }

  private updateFSM(position: BodyPosition, confidence: number) {
    const now = Date.now();

    switch (this.fsmState) {
      case "STANDING":
        if (position === "RUKU") {
          this.transitionFSM("RUKU");
          this.emit("POSITION_CHANGE", { position: "RUKU", confidence, timestamp: now });
        }
        break;

      case "RUKU":
        if (position === "STANDING") {
          this.transitionFSM("STANDING_RETURN");
          this.emit("POSITION_CHANGE", { position: "STANDING", confidence, timestamp: now });
        } else if (position === "SUJOOD") {
          // Skipped standing-return (fast prayer) — still allow
          this.transitionFSM("SUJOOD_1");
          this.emit("POSITION_CHANGE", { position: "SUJOOD", confidence, timestamp: now });
        }
        break;

      case "STANDING_RETURN":
        if (position === "SUJOOD") {
          this.transitionFSM("SUJOOD_1");
          this.emit("POSITION_CHANGE", { position: "SUJOOD", confidence, timestamp: now });
        } else if (position === "RUKU") {
          // False return — went back to ruku
          this.transitionFSM("RUKU");
        }
        break;

      case "SUJOOD_1":
        if (position === "SITTING" || position === "STANDING") {
          this.transitionFSM("BETWEEN_SAJDAHS");
          this.emit("POSITION_CHANGE", { position: "SITTING", confidence, timestamp: now });
        }
        break;

      case "BETWEEN_SAJDAHS":
        if (position === "SUJOOD") {
          this.transitionFSM("SUJOOD_2");
          this.emit("POSITION_CHANGE", { position: "SUJOOD", confidence, timestamp: now });
        }
        break;

      case "SUJOOD_2":
        if (position === "STANDING" || position === "SITTING") {
          this.rakaatCount++;
          this.onEvent?.({
            type: "RAKAH_COMPLETE",
            rakaatCount: this.rakaatCount,
            confidence,
            fsmState: position === "SITTING" ? "TASHAHUD" : "STANDING",
            timestamp: now,
          });

          if (position === "SITTING") {
            this.transitionFSM("TASHAHUD");
          } else {
            this.transitionFSM("STANDING");
          }
        }
        break;

      case "TASHAHUD":
        if (position === "STANDING") {
          this.transitionFSM("STANDING");
          this.emit("POSITION_CHANGE", { position: "STANDING", confidence, timestamp: now });
        }
        break;
    }
  }

  private emit(
    type: DetectionEvent["type"],
    rest: Omit<DetectionEvent, "type">
  ) {
    this.onEvent?.({ type, ...rest });
  }

  // ── Public API ───────────────────────────────────────────────────

  completePrayer(confidence: number) {
    const duration = Date.now() - this.startTime;
    this.stop();
    this.onEvent?.({
      type: "PRAYER_COMPLETE",
      rakaatCount: this.rakaatCount,
      confidence,
      timestamp: Date.now(),
    });
    return duration;
  }

  getRakaatCount() {
    return this.rakaatCount;
  }

  getFSMState() {
    return this.fsmState;
  }

  getCurrentPosition() {
    return this.currentPosition;
  }

  getStability() {
    return this.stability;
  }

  getPositionLabel(position: BodyPosition): string {
    switch (position) {
      case "STANDING": return "Standing (Qiyam)";
      case "RUKU":     return "Bowing (Ruku)";
      case "SUJOOD":   return "Prostrating (Sujood)";
      case "SITTING":  return "Sitting (Jalsa)";
      default:         return "Detecting...";
    }
  }
}
