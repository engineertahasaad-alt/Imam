import { Accelerometer } from "expo-sensors";
import { Platform } from "react-native";

export type BodyPosition = "STANDING" | "RUKU" | "SUJOOD" | "SITTING" | "UNKNOWN";

export interface CalibrationProfile {
  standing: [number, number, number];
  ruku: [number, number, number];
  sujood: [number, number, number];
  sitting: [number, number, number];
  calibratedAt: number;
  pocketSide: "left" | "right" | "unknown";
}

export interface DetectionEvent {
  type: "POSITION_CHANGE" | "RAKAH_COMPLETE" | "PRAYER_COMPLETE" | "ERROR";
  position?: BodyPosition;
  rakaatCount?: number;
  confidence?: number;
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

export class MotionEngine {
  private subscription: ReturnType<typeof Accelerometer.addListener> | null = null;

  // Smoothed sensor values (low-pass filter)
  private gx = 0;
  private gy = 0;
  private gz = 0;
  private readonly alpha = 0.15;

  // Position debouncing
  private currentPosition: BodyPosition = "UNKNOWN";
  private pendingPosition: BodyPosition = "UNKNOWN";
  private pendingStartTime = 0;
  private readonly MIN_HOLD_MS = 1200;

  // FSM
  private fsmState: FSMState = "IDLE";
  private rakaatCount = 0;
  private startTime = 0;

  // Calibration
  private calibration: CalibrationProfile | null = null;

  // Callback
  private onEvent: ((event: DetectionEvent) => void) | null = null;

  // Calibration recording
  private isRecording = false;
  private recordedSamples: Array<[number, number, number]> = [];
  private recordingDuration = 3000;
  private recordingTimer: ReturnType<typeof setTimeout> | null = null;
  private onRecordingComplete: ((avg: [number, number, number]) => void) | null = null;

  constructor(onEvent: (event: DetectionEvent) => void) {
    this.onEvent = onEvent;
  }

  setCalibration(profile: CalibrationProfile) {
    this.calibration = profile;
  }

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
    this.currentPosition = "UNKNOWN";

    Accelerometer.setUpdateInterval(200);
    this.subscription = Accelerometer.addListener(({ x, y, z }) => {
      this.gx = this.alpha * x + (1 - this.alpha) * this.gx;
      this.gy = this.alpha * y + (1 - this.alpha) * this.gy;
      this.gz = this.alpha * z + (1 - this.alpha) * this.gz;
      this.processGravity();
    });
  }

  stop() {
    this.subscription?.remove();
    this.subscription = null;
    this.fsmState = "IDLE";
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  startRecording(
    durationMs: number,
    onComplete: (avg: [number, number, number]) => void
  ) {
    this.isRecording = true;
    this.recordedSamples = [];
    this.onRecordingComplete = onComplete;

    if (!this.subscription) {
      Accelerometer.setUpdateInterval(100);
      this.subscription = Accelerometer.addListener(({ x, y, z }) => {
        this.gx = this.alpha * x + (1 - this.alpha) * this.gx;
        this.gy = this.alpha * y + (1 - this.alpha) * this.gy;
        this.gz = this.alpha * z + (1 - this.alpha) * this.gz;
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
    if (this.subscription && this.fsmState === "IDLE") {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  private averageSamples(
    samples: Array<[number, number, number]>
  ): [number, number, number] {
    if (samples.length === 0) return [0, 0, -1];
    const sum = samples.reduce(
      (acc, s) => [acc[0] + s[0], acc[1] + s[1], acc[2] + s[2]] as [number, number, number],
      [0, 0, 0] as [number, number, number]
    );
    return [
      sum[0] / samples.length,
      sum[1] / samples.length,
      sum[2] / samples.length,
    ];
  }

  private cosineSimilarity(
    a: [number, number, number],
    b: [number, number, number]
  ): number {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const magA = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
    const magB = Math.sqrt(b[0] ** 2 + b[1] ** 2 + b[2] ** 2);
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }

  private classifyPosition(): { position: BodyPosition; confidence: number } {
    const g: [number, number, number] = [this.gx, this.gy, this.gz];

    if (this.calibration) {
      const scores = {
        STANDING: this.cosineSimilarity(g, this.calibration.standing),
        RUKU: this.cosineSimilarity(g, this.calibration.ruku),
        SUJOOD: this.cosineSimilarity(g, this.calibration.sujood),
        SITTING: this.cosineSimilarity(g, this.calibration.sitting),
      };

      const entries = Object.entries(scores) as Array<[BodyPosition, number]>;
      const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
      const confidence = (best[1] + 1) / 2;

      if (best[1] > 0.8) {
        return { position: best[0], confidence };
      }
      return { position: "UNKNOWN", confidence };
    }

    return this.classifyFromAngle(g);
  }

  private classifyFromAngle(g: [number, number, number]): {
    position: BodyPosition;
    confidence: number;
  } {
    const mag = Math.sqrt(g[0] ** 2 + g[1] ** 2 + g[2] ** 2);
    if (mag < 0.3) return { position: "UNKNOWN", confidence: 0 };

    const ay = Math.abs(g[1]) / mag;
    const az = Math.abs(g[2]) / mag;

    if (ay > 0.85) return { position: "STANDING", confidence: ay };
    if (az > 0.80) return { position: "SUJOOD", confidence: az };
    if (ay > 0.45) {
      return az > 0.45
        ? { position: "SITTING", confidence: 0.7 }
        : { position: "RUKU", confidence: 0.72 };
    }

    return { position: "UNKNOWN", confidence: 0 };
  }

  private processGravity() {
    if (this.fsmState === "IDLE") return;

    const { position, confidence } = this.classifyPosition();
    const now = Date.now();

    if (position !== this.pendingPosition) {
      this.pendingPosition = position;
      this.pendingStartTime = now;
      return;
    }

    if (now - this.pendingStartTime < this.MIN_HOLD_MS) return;

    if (position !== this.currentPosition && position !== "UNKNOWN") {
      this.currentPosition = position;
      this.updateFSM(position, confidence);
    }
  }

  private updateFSM(position: BodyPosition, confidence: number) {
    const now = Date.now();

    switch (this.fsmState) {
      case "STANDING":
        if (position === "RUKU") {
          this.fsmState = "RUKU";
          this.onEvent?.({
            type: "POSITION_CHANGE",
            position: "RUKU",
            confidence,
            timestamp: now,
          });
        }
        break;

      case "RUKU":
        if (position === "STANDING") {
          this.fsmState = "STANDING_RETURN";
          this.onEvent?.({
            type: "POSITION_CHANGE",
            position: "STANDING",
            confidence,
            timestamp: now,
          });
        }
        break;

      case "STANDING_RETURN":
        if (position === "SUJOOD") {
          this.fsmState = "SUJOOD_1";
          this.onEvent?.({
            type: "POSITION_CHANGE",
            position: "SUJOOD",
            confidence,
            timestamp: now,
          });
        } else if (position === "RUKU") {
          this.fsmState = "RUKU";
        }
        break;

      case "SUJOOD_1":
        if (position === "SITTING" || position === "STANDING") {
          this.fsmState = "BETWEEN_SAJDAHS";
          this.onEvent?.({
            type: "POSITION_CHANGE",
            position: "SITTING",
            confidence,
            timestamp: now,
          });
        }
        break;

      case "BETWEEN_SAJDAHS":
        if (position === "SUJOOD") {
          this.fsmState = "SUJOOD_2";
          this.onEvent?.({
            type: "POSITION_CHANGE",
            position: "SUJOOD",
            confidence,
            timestamp: now,
          });
        }
        break;

      case "SUJOOD_2":
        if (position === "STANDING" || position === "SITTING") {
          this.rakaatCount++;
          this.onEvent?.({
            type: "RAKAH_COMPLETE",
            rakaatCount: this.rakaatCount,
            confidence,
            timestamp: now,
          });

          if (position === "SITTING") {
            this.fsmState = "TASHAHUD";
          } else {
            this.fsmState = "STANDING";
          }
        }
        break;

      case "TASHAHUD":
        if (position === "STANDING") {
          this.fsmState = "STANDING";
        }
        break;
    }
  }

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

  getPositionLabel(position: BodyPosition): string {
    switch (position) {
      case "STANDING":
        return "Standing (Qiyam)";
      case "RUKU":
        return "Bowing (Ruku)";
      case "SUJOOD":
        return "Prostrating (Sujood)";
      case "SITTING":
        return "Sitting";
      default:
        return "Detecting...";
    }
  }
}
