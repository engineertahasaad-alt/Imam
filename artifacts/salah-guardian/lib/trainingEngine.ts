import { CalibrationData } from "./storage";
import {
  MovementFeatures,
  RawSample,
  SessionQuality,
  TrainingSession,
} from "./trainingStorage";

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
  return Math.max(-1, Math.min(1, dot / (ma * mb)));
}

export function extractFeatures(
  samples: RawSample[],
  label: MovementFeatures["label"]
): MovementFeatures {
  const empty: MovementFeatures = {
    label, duration: 0, avgVector: [0, 0, -1],
    peakAcceleration: 0, motionVariance: 0,
    stabilityScore: 0, rotationIntensity: 0, sampleCount: 0,
  };
  if (samples.length < 5) return empty;

  const drop    = Math.floor(samples.length * 0.20);
  const dropEnd = Math.floor(samples.length * 0.10);
  const t       = samples.slice(drop, samples.length - dropEnd);
  if (t.length < 3) return empty;

  const duration = t[t.length - 1].ts - t[0].ts;

  const sumA = t.reduce(
    (acc, s) => [acc[0] + s.ax, acc[1] + s.ay, acc[2] + s.az] as [number, number, number],
    [0, 0, 0] as [number, number, number]
  );
  const avgVector: [number, number, number] = [
    sumA[0] / t.length, sumA[1] / t.length, sumA[2] / t.length,
  ];

  const magnitudes      = t.map(s => mag3(s.ax, s.ay, s.az));
  const peakAcceleration = Math.max(...magnitudes);
  const avgMag          = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const motionVariance  = magnitudes.reduce((acc, m) => acc + (m - avgMag) ** 2, 0) / magnitudes.length;

  const gyroMags         = t.map(s => mag3(s.gx, s.gy, s.gz));
  const stableCount      = gyroMags.filter(g => g < 0.30).length;
  const stabilityScore   = stableCount / t.length;
  const rotationIntensity = gyroMags.reduce((a, b) => a + b, 0) / gyroMags.length;

  return {
    label, duration, avgVector,
    peakAcceleration, motionVariance,
    stabilityScore, rotationIntensity,
    sampleCount: t.length,
  };
}

export function scoreSession(
  features: MovementFeatures[]
): { score: number; quality: SessionQuality } {
  if (features.length < 3) return { score: 0.10, quality: "noisy" };

  const hasStanding = features.some(f => f.label === "STANDING");
  const hasRuku     = features.some(f => f.label === "RUKU");
  const hasSujood   = features.some(f => f.label === "SUJOOD");
  if (!hasStanding || !hasRuku || !hasSujood) return { score: 0.20, quality: "noisy" };

  const avgStability = features.reduce((a, f) => a + f.stabilityScore, 0) / features.length;

  const vecs = features.map(f => f.avgVector);
  let minSpread = 1;
  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) {
      const spread = 1 - Math.abs(cosine(vecs[i], vecs[j]));
      if (spread < minSpread) minSpread = spread;
    }
  }

  const avgVariance   = features.reduce((a, f) => a + f.motionVariance, 0) / features.length;
  const varianceScore = Math.max(0, 1 - avgVariance * 6);

  const avgSamples  = features.reduce((a, f) => a + f.sampleCount, 0) / features.length;
  const sampleScore = Math.min(1, avgSamples / 30);

  const score =
    0.35 * avgStability +
    0.30 * Math.min(1, minSpread * 3) +
    0.20 * varianceScore +
    0.15 * sampleScore;

  const quality: SessionQuality =
    score >= 0.72 ? "excellent" :
    score >= 0.52 ? "good" :
    score >= 0.35 ? "weak" : "noisy";

  return { score, quality };
}

export function buildImprovedCalibration(
  sessions: TrainingSession[],
  pocketSide: "left" | "right" | "unknown" = "unknown"
): CalibrationData | null {
  const usable = sessions.filter(
    s => s.quality !== "noisy" && s.qualityScore >= 0.35
  );
  if (usable.length === 0) return null;

  type PosKey = "standing" | "ruku" | "sujood" | "sitting";
  const labelMap: Record<string, PosKey> = {
    STANDING: "standing", RUKU: "ruku", SUJOOD: "sujood", SITTING: "sitting",
  };

  const sums: Record<PosKey, [number, number, number]> = {
    standing: [0, 0, 0], ruku: [0, 0, 0], sujood: [0, 0, 0], sitting: [0, 0, 0],
  };
  const weights: Record<PosKey, number> = {
    standing: 0, ruku: 0, sujood: 0, sitting: 0,
  };

  for (const session of usable) {
    const w = session.qualityScore;
    for (const f of session.features) {
      const key = labelMap[f.label];
      if (!key) continue;
      sums[key][0] += f.avgVector[0] * w;
      sums[key][1] += f.avgVector[1] * w;
      sums[key][2] += f.avgVector[2] * w;
      weights[key] += w;
    }
  }

  const avg = (k: PosKey): [number, number, number] => {
    const w = weights[k];
    if (w === 0) return [0, 0, -1];
    return [sums[k][0] / w, sums[k][1] / w, sums[k][2] / w];
  };

  return {
    standing:     avg("standing"),
    ruku:         avg("ruku"),
    sujood:       avg("sujood"),
    sitting:      avg("sitting"),
    calibratedAt: Date.now(),
    pocketSide,
  };
}
