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
  type:
    | "POSITION_CHANGE"
    | "POSTURE_VALIDATION"
    | "RAKAH_COMPLETE"
    | "PRAYER_COMPLETE"
    | "ERROR"
    | "STABILITY_UPDATE";
  position?: BodyPosition;
  expectedPosition?: BodyPosition;
  nextExpectedPosition?: BodyPosition;
  isCorrect?: boolean;
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

// ─── Fixed sensor constants ──────────────────────────────────────────────────
const SENSOR_INTERVAL_MS    = 80;
const ACCEL_ALPHA           = 0.18;
const GYRO_ALPHA            = 0.25;
const WINDOW_SIZE           = 10;
const GYRO_STABLE_THRESHOLD = 0.30;
const MAG_MIN               = 0.80;
const MAG_MAX               = 1.25;
const COSINE_BASE_THRESHOLD = 0.72;
const COSINE_HARD_THRESHOLD = 0.88;
const STABILITY_EMIT_MS     = 400;
const FSM_STUCK_TIMEOUT_MS  = 45_000;
const WRONG_REPEAT_MS       = 5_000;   // re-warn if stuck in wrong pos this long
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function mag3(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}
function cosine(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const ma  = mag3(a[0], a[1], a[2]);
  const mb  = mag3(b[0], b[1], b[2]);
  if (ma < 1e-6 || mb < 1e-6) return 0;
  return clamp(dot / (ma * mb), -1, 1);
}

export class MotionEngine {
  // ── Sensor subscriptions ─────────────────────────────────────────────────
  private accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
  private gyroSub:  ReturnType<typeof Gyroscope.addListener>    | null = null;

  // ── Smoothed gravity (low-pass) ──────────────────────────────────────────
  private gx = 0; private gy = 0; private gz = 0;

  // ── Smoothed gyroscope (angular velocity rad/s) ──────────────────────────
  private wx = 0; private wy = 0; private wz = 0;

  // ── Derived stability 0–1 ───────────────────────────────────────────────
  private stability = 1;

  // ── Sliding window of position votes ────────────────────────────────────
  private window:     BodyPosition[] = [];
  private windowConf: number[]       = [];

  // ── Confirmed + candidate positions ─────────────────────────────────────
  private currentPosition:        BodyPosition = "UNKNOWN";
  private lastValidationPosition: BodyPosition = "UNKNOWN";

  // ── FSM ──────────────────────────────────────────────────────────────────
  private fsmState:         FSMState = "IDLE";
  private rakaatCount       = 0;
  private startTime         = 0;
  private fsmStateEnteredAt = 0;

  // ── Timers ───────────────────────────────────────────────────────────────
  private stuckGuardTimer:    ReturnType<typeof setInterval>  | null = null;
  private wrongPositionTimer: ReturnType<typeof setTimeout>   | null = null;

  // ── Calibration & adaptive threshold ────────────────────────────────────
  private calibration:      CalibrationProfile | null = null;
  private adaptedThreshold  = COSINE_BASE_THRESHOLD;

  // ── Sensitivity-derived tunables ─────────────────────────────────────────
  /** Votes required out of WINDOW_SIZE (sensitivity 1→9, 5→5) */
  private minVotes:          number;
  /** Min ms a position must be held before it can change */
  private minPositionHoldMs: number;
  /** Last time position was confirmed */
  private positionConfirmedAt = 0;

  // ── Calibration recording ────────────────────────────────────────────────
  private isRecording         = false;
  private recordedSamples:    Array<[number, number, number]> = [];
  private recordingTimer:     ReturnType<typeof setTimeout>   | null = null;
  private onRecordingComplete: ((avg: [number, number, number]) => void) | null = null;

  // ── Throttle ────────────────────────────────────────────────────────────
  private lastStabilityEmit = 0;

  // ── Callback ─────────────────────────────────────────────────────────────
  private onEvent: ((event: DetectionEvent) => void) | null = null;

  /**
   * @param onEvent   event callback
   * @param sensitivity  1 (most stable) → 5 (most responsive), default 3
   */
  constructor(
    onEvent: (event: DetectionEvent) => void,
    sensitivity: number = 3
  ) {
    this.onEvent = onEvent;
    const s = clamp(Math.round(sensitivity), 1, 5);
    // More sensitivity → fewer votes needed → faster response
    this.minVotes          = 10 - s;                      // 1→9, 3→7, 5→5
    // More sensitivity → shorter hold time → faster transitions
    this.minPositionHoldMs = 2400 - s * 400;              // 1→2000ms, 3→1000ms, 5→400ms
  }

  // ── Calibration ──────────────────────────────────────────────────────────

  setCalibration(profile: CalibrationProfile) {
    this.calibration     = profile;
    this.adaptedThreshold = this.computeAdaptiveThreshold(profile);
  }

  private computeAdaptiveThreshold(profile: CalibrationProfile): number {
    const vecs: [number, number, number][] = [
      profile.standing, profile.ruku, profile.sujood, profile.sitting,
    ];
    let minSim = 1;
    for (let i = 0; i < vecs.length; i++)
      for (let j = i + 1; j < vecs.length; j++) {
        const s = cosine(vecs[i], vecs[j]);
        if (s < minSim) minSim = s;
      }
    const spread = clamp(1 - minSim, 0, 1);
    return COSINE_BASE_THRESHOLD + spread * (COSINE_HARD_THRESHOLD - COSINE_BASE_THRESHOLD);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    if (Platform.OS === "web") {
      this.onEvent?.({ type: "ERROR", timestamp: Date.now(), message: "Sensor detection not available on web" });
      return;
    }
    this.fsmState           = "STANDING";
    this.rakaatCount        = 0;
    this.startTime          = Date.now();
    this.fsmStateEnteredAt  = Date.now();
    this.positionConfirmedAt = 0;
    this.currentPosition    = "UNKNOWN";
    this.lastValidationPosition = "UNKNOWN";
    this.window             = [];
    this.windowConf         = [];
    this.startSensors();
    this.startStuckGuard();
  }

  stop() {
    this.stopSensors();
    this.fsmState = "IDLE";
    if (this.recordingTimer)     { clearTimeout(this.recordingTimer);    this.recordingTimer    = null; }
    if (this.stuckGuardTimer)    { clearInterval(this.stuckGuardTimer);  this.stuckGuardTimer   = null; }
    if (this.wrongPositionTimer) { clearTimeout(this.wrongPositionTimer); this.wrongPositionTimer = null; }
  }

  private startSensors() {
    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    Gyroscope.setUpdateInterval(SENSOR_INTERVAL_MS);

    this.accelSub = Accelerometer.addListener(({ x, y, z }) => {
      this.gx = ACCEL_ALPHA * x + (1 - ACCEL_ALPHA) * this.gx;
      this.gy = ACCEL_ALPHA * y + (1 - ACCEL_ALPHA) * this.gy;
      this.gz = ACCEL_ALPHA * z + (1 - ACCEL_ALPHA) * this.gz;
      this.processSample();
    });

    this.gyroSub = Gyroscope.addListener(({ x, y, z }) => {
      this.wx = GYRO_ALPHA * x + (1 - GYRO_ALPHA) * this.wx;
      this.wy = GYRO_ALPHA * y + (1 - GYRO_ALPHA) * this.wy;
      this.wz = GYRO_ALPHA * z + (1 - GYRO_ALPHA) * this.wz;
      const gyroMag    = mag3(this.wx, this.wy, this.wz);
      const rawStab    = clamp(1 - gyroMag / GYRO_STABLE_THRESHOLD, 0, 1);
      this.stability   = 0.7 * this.stability + 0.3 * rawStab;
    });
  }

  private stopSensors() {
    this.accelSub?.remove(); this.accelSub = null;
    this.gyroSub?.remove();  this.gyroSub  = null;
  }

  private startStuckGuard() {
    this.stuckGuardTimer = setInterval(() => {
      if (
        this.fsmState !== "IDLE" &&
        this.fsmState !== "STANDING" &&
        this.fsmState !== "TASHAHUD" &&
        Date.now() - this.fsmStateEnteredAt > FSM_STUCK_TIMEOUT_MS
      ) {
        this.fsmState           = "STANDING";
        this.fsmStateEnteredAt  = Date.now();
        this.currentPosition    = "UNKNOWN";
        this.window             = [];
      }
    }, 5_000);
  }

  // ── Calibration recording ─────────────────────────────────────────────────

  startRecording(durationMs: number, onComplete: (avg: [number, number, number]) => void) {
    this.isRecording        = true;
    this.recordedSamples    = [];
    this.onRecordingComplete = onComplete;

    if (!this.accelSub) {
      Accelerometer.setUpdateInterval(80);
      this.accelSub = Accelerometer.addListener(({ x, y, z }) => {
        this.gx = ACCEL_ALPHA * x + (1 - ACCEL_ALPHA) * this.gx;
        this.gy = ACCEL_ALPHA * y + (1 - ACCEL_ALPHA) * this.gy;
        this.gz = ACCEL_ALPHA * z + (1 - ACCEL_ALPHA) * this.gz;
        if (this.isRecording) this.recordedSamples.push([this.gx, this.gy, this.gz]);
      });
    }

    this.recordingTimer = setTimeout(() => {
      this.isRecording = false;
      this.onRecordingComplete?.(this.averageSamples(this.recordedSamples));
    }, durationMs);
  }

  stopRecording() {
    this.isRecording = false;
    if (this.recordingTimer) { clearTimeout(this.recordingTimer); this.recordingTimer = null; }
    if (this.accelSub && this.fsmState === "IDLE") { this.accelSub.remove(); this.accelSub = null; }
  }

  private averageSamples(samples: Array<[number, number, number]>): [number, number, number] {
    if (samples.length === 0) return [0, 0, -1];
    const drop    = Math.floor(samples.length * 0.20);
    const dropEnd = Math.floor(samples.length * 0.05);
    const trimmed = samples.slice(drop, samples.length - dropEnd);
    if (trimmed.length === 0) return [0, 0, -1];
    const sum = trimmed.reduce(
      (acc, s) => [acc[0] + s[0], acc[1] + s[1], acc[2] + s[2]] as [number, number, number],
      [0, 0, 0] as [number, number, number]
    );
    return [sum[0] / trimmed.length, sum[1] / trimmed.length, sum[2] / trimmed.length];
  }

  // ── Position classification ────────────────────────────────────────────────

  private classifyPosition(): { position: BodyPosition; confidence: number } {
    const g: [number, number, number] = [this.gx, this.gy, this.gz];
    const m   = mag3(g[0], g[1], g[2]);
    const mh  = m < MAG_MIN || m > MAG_MAX ? 0 : 1 - Math.abs(1 - m);
    return this.calibration
      ? this.classifyWithCalibration(g, mh)
      : this.classifyFromAngles(g, m, mh);
  }

  private classifyWithCalibration(
    g: [number, number, number],
    magHealth: number
  ): { position: BodyPosition; confidence: number } {
    const cal = this.calibration!;
    const scores: Record<string, number> = {
      STANDING: cosine(g, cal.standing),
      RUKU:     cosine(g, cal.ruku),
      SUJOOD:   cosine(g, cal.sujood),
      SITTING:  cosine(g, cal.sitting),
    };
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestPos, bestSim] = entries[0];
    const [, secondSim]      = entries[1];
    const margin      = bestSim - secondSim;
    const simFactor   = clamp((bestSim - this.adaptedThreshold) / (1 - this.adaptedThreshold), 0, 1);
    const marginFactor = clamp(margin / 0.20, 0, 1);
    const confidence  = 0.50 * simFactor + 0.25 * marginFactor + 0.15 * magHealth + 0.10 * this.stability;
    if (bestSim < this.adaptedThreshold) return { position: "UNKNOWN", confidence: 0 };
    return { position: bestPos as BodyPosition, confidence: clamp(confidence, 0, 1) };
  }

  private classifyFromAngles(
    g: [number, number, number],
    m: number,
    magHealth: number
  ): { position: BodyPosition; confidence: number } {
    if (m < 0.3) return { position: "UNKNOWN", confidence: 0 };
    const [gx, gy, gz] = g;
    const pitchRad = Math.atan2(Math.sqrt(gx * gx + gz * gz), Math.abs(gy));
    const pitchDeg = (pitchRad * 180) / Math.PI;

    let position: BodyPosition;
    let rawConf: number;

    if (pitchDeg < 25) {
      position = "STANDING"; rawConf = Math.abs(gy) / m;
    } else if (pitchDeg < 55) {
      position = "SITTING"; rawConf = 0.65;
    } else if (pitchDeg < 78) {
      position = "RUKU";
      rawConf = clamp((pitchDeg - 55) / 23, 0, 1) * 0.85 + 0.15;
    } else {
      position = "SUJOOD"; rawConf = (Math.abs(gz) + Math.abs(gx)) / m;
    }

    if (pitchDeg > 68 && gz < -0.5) { position = "SUJOOD"; rawConf = Math.abs(gz) / m; }

    return {
      position,
      confidence: clamp(0.65 * rawConf + 0.20 * magHealth + 0.15 * this.stability, 0, 1),
    };
  }

  // ── Expected position from FSM ────────────────────────────────────────────

  /**
   * Returns the body position the user should currently be holding,
   * based on the FSM state. Used for validation ("are you in the right posture?").
   */
  getExpectedPosition(): BodyPosition {
    switch (this.fsmState) {
      case "STANDING":        return "STANDING";
      case "RUKU":            return "RUKU";
      case "STANDING_RETURN": return "STANDING";
      case "SUJOOD_1":        return "SUJOOD";
      case "BETWEEN_SAJDAHS": return "SITTING";
      case "SUJOOD_2":        return "SUJOOD";
      case "TASHAHUD":        return "SITTING";
      default:                return "UNKNOWN";
    }
  }

  /**
   * Returns the body position that should come NEXT in the prayer sequence.
   * Used to guide the user ("move to X next").
   */
  getNextExpectedPosition(): BodyPosition {
    switch (this.fsmState) {
      case "STANDING":        return "RUKU";
      case "RUKU":            return "STANDING";
      case "STANDING_RETURN": return "SUJOOD";
      case "SUJOOD_1":        return "SITTING";
      case "BETWEEN_SAJDAHS": return "SUJOOD";
      case "SUJOOD_2":        return "STANDING";
      case "TASHAHUD":        return "STANDING";
      default:                return "UNKNOWN";
    }
  }

  // ── Sliding-window majority voting ────────────────────────────────────────

  private processSample() {
    if (this.fsmState === "IDLE") return;

    const gyroMag = mag3(this.wx, this.wy, this.wz);
    if (gyroMag > GYRO_STABLE_THRESHOLD * 2.5) {
      this.window.push("UNKNOWN");
      if (this.window.length > WINDOW_SIZE) this.window.shift();
      return;
    }

    const { position, confidence } = this.classifyPosition();
    this.window.push(position);
    this.windowConf.push(confidence);
    if (this.window.length > WINDOW_SIZE) { this.window.shift(); this.windowConf.shift(); }

    const votes: Partial<Record<BodyPosition, number>> = {};
    for (const p of this.window) votes[p] = (votes[p] ?? 0) + 1;

    let winnerPos: BodyPosition = "UNKNOWN";
    let winnerVotes = 0;
    for (const [p, v] of Object.entries(votes) as Array<[BodyPosition, number]>) {
      if (v > winnerVotes) { winnerVotes = v; winnerPos = p; }
    }

    const windowFull  = this.window.length >= WINDOW_SIZE;
    const hasMajority = windowFull && winnerVotes >= this.minVotes;
    const avgConf     = this.windowConf
      .filter((_, i) => this.window[i] === winnerPos)
      .reduce((s, c) => s + c, 0) / Math.max(winnerVotes, 1);

    // ── Throttled stability update for UI ──────────────────────────────────
    const now = Date.now();
    if (now - this.lastStabilityEmit > STABILITY_EMIT_MS) {
      this.lastStabilityEmit = now;
      this.onEvent?.({
        type: "STABILITY_UPDATE",
        stability: this.stability,
        confidence: avgConf,
        position: winnerPos,
        expectedPosition: this.getExpectedPosition(),
        nextExpectedPosition: this.getNextExpectedPosition(),
        fsmState: this.fsmState,
        timestamp: now,
      });
    }

    if (!hasMajority || winnerPos === "UNKNOWN") return;

    // ── Hysteresis: don't allow position change faster than minPositionHoldMs
    const sinceLastChange = now - this.positionConfirmedAt;
    if (winnerPos !== this.currentPosition && sinceLastChange < this.minPositionHoldMs) return;

    if (winnerPos !== this.currentPosition) {
      this.currentPosition     = winnerPos;
      this.positionConfirmedAt = now;

      // ── Posture validation ──────────────────────────────────────────────
      const expected  = this.getExpectedPosition();
      const nextExp   = this.getNextExpectedPosition();
      const isCorrect = winnerPos === expected || winnerPos === nextExp;

      this.emitPostureValidation(winnerPos, expected, nextExp, isCorrect, avgConf, now);
      this.updateFSM(winnerPos, avgConf);
    }
  }

  private emitPostureValidation(
    position: BodyPosition,
    expected: BodyPosition,
    nextExpected: BodyPosition,
    isCorrect: boolean,
    confidence: number,
    now: number
  ) {
    this.lastValidationPosition = position;

    // Clear any existing wrong-position repeat timer
    if (this.wrongPositionTimer) { clearTimeout(this.wrongPositionTimer); this.wrongPositionTimer = null; }

    this.onEvent?.({
      type: "POSTURE_VALIDATION",
      position,
      expectedPosition: expected,
      nextExpectedPosition: nextExpected,
      isCorrect,
      confidence,
      fsmState: this.fsmState,
      timestamp: now,
    });

    // If wrong, schedule a repeat warning
    if (!isCorrect) {
      this.scheduleWrongRepeat(position, expected, nextExpected, confidence);
    }
  }

  private scheduleWrongRepeat(
    position: BodyPosition,
    expected: BodyPosition,
    nextExpected: BodyPosition,
    confidence: number
  ) {
    this.wrongPositionTimer = setTimeout(() => {
      this.wrongPositionTimer = null;
      // Only re-warn if still in the same wrong position
      if (this.currentPosition === position && this.fsmState !== "IDLE") {
        this.onEvent?.({
          type: "POSTURE_VALIDATION",
          position,
          expectedPosition: expected,
          nextExpectedPosition: nextExpected,
          isCorrect: false,
          confidence,
          fsmState: this.fsmState,
          timestamp: Date.now(),
          message: "still in wrong posture",
        });
        this.scheduleWrongRepeat(position, expected, nextExpected, confidence);
      }
    }, WRONG_REPEAT_MS);
  }

  // ── Finite state machine ──────────────────────────────────────────────────

  private transitionFSM(newState: FSMState) {
    this.fsmState          = newState;
    this.fsmStateEnteredAt = Date.now();
  }

  private updateFSM(position: BodyPosition, confidence: number) {
    const now = Date.now();

    switch (this.fsmState) {
      case "STANDING":
        if (position === "RUKU") {
          this.transitionFSM("RUKU");
          this.onEvent?.({ type: "POSITION_CHANGE", position: "RUKU", confidence, fsmState: "RUKU", timestamp: now });
        }
        break;

      case "RUKU":
        if (position === "STANDING") {
          this.transitionFSM("STANDING_RETURN");
          this.onEvent?.({ type: "POSITION_CHANGE", position: "STANDING", confidence, fsmState: "STANDING_RETURN", timestamp: now });
        } else if (position === "SUJOOD") {
          // Fast prayer — skip i'tidal
          this.transitionFSM("SUJOOD_1");
          this.onEvent?.({ type: "POSITION_CHANGE", position: "SUJOOD", confidence, fsmState: "SUJOOD_1", timestamp: now });
        }
        break;

      case "STANDING_RETURN":
        if (position === "SUJOOD") {
          this.transitionFSM("SUJOOD_1");
          this.onEvent?.({ type: "POSITION_CHANGE", position: "SUJOOD", confidence, fsmState: "SUJOOD_1", timestamp: now });
        } else if (position === "RUKU") {
          this.transitionFSM("RUKU");
        }
        break;

      case "SUJOOD_1":
        if (position === "SITTING" || position === "STANDING") {
          this.transitionFSM("BETWEEN_SAJDAHS");
          this.onEvent?.({ type: "POSITION_CHANGE", position: "SITTING", confidence, fsmState: "BETWEEN_SAJDAHS", timestamp: now });
        }
        break;

      case "BETWEEN_SAJDAHS":
        if (position === "SUJOOD") {
          this.transitionFSM("SUJOOD_2");
          this.onEvent?.({ type: "POSITION_CHANGE", position: "SUJOOD", confidence, fsmState: "SUJOOD_2", timestamp: now });
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
          this.transitionFSM(position === "SITTING" ? "TASHAHUD" : "STANDING");
        }
        break;

      case "TASHAHUD":
        if (position === "STANDING") {
          this.transitionFSM("STANDING");
          this.onEvent?.({ type: "POSITION_CHANGE", position: "STANDING", confidence, fsmState: "STANDING", timestamp: now });
        }
        break;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  completePrayer(confidence: number) {
    const duration = Date.now() - this.startTime;
    this.stop();
    this.onEvent?.({ type: "PRAYER_COMPLETE", rakaatCount: this.rakaatCount, confidence, timestamp: Date.now() });
    return duration;
  }

  getRakaatCount()       { return this.rakaatCount; }
  getFSMState()          { return this.fsmState; }
  getCurrentPosition()   { return this.currentPosition; }
  getStability()         { return this.stability; }

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
