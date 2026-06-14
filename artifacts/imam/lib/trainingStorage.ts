import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RawSample {
  ts: number;
  ax: number; ay: number; az: number;
  gx: number; gy: number; gz: number;
}

export interface MovementFeatures {
  label: "STANDING" | "RUKU" | "SUJOOD" | "SITTING";
  duration: number;
  avgVector: [number, number, number];
  peakAcceleration: number;
  motionVariance: number;
  stabilityScore: number;
  rotationIntensity: number;
  sampleCount: number;
}

export type SessionQuality = "excellent" | "good" | "weak" | "noisy";

export interface TrainingSession {
  id: string;
  timestamp: number;
  quality: SessionQuality;
  qualityScore: number;
  /** Alias for qualityScore (0–100) used by stats UI */
  overallScore: number;
  features: MovementFeatures[];
  sessionDurationMs: number;
}

const TRAINING_KEY = "@salah_guardian:training_sessions";
const MAX_SESSIONS  = 20;

export async function getTrainingSessions(): Promise<TrainingSession[]> {
  try {
    const data = await AsyncStorage.getItem(TRAINING_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveTrainingSession(session: TrainingSession): Promise<void> {
  const existing = await getTrainingSessions();
  const updated  = [...existing, session].slice(-MAX_SESSIONS);
  await AsyncStorage.setItem(TRAINING_KEY, JSON.stringify(updated));
}

export async function clearTrainingSessions(): Promise<void> {
  await AsyncStorage.removeItem(TRAINING_KEY);
}

export async function getSessionCount(): Promise<number> {
  const sessions = await getTrainingSessions();
  return sessions.length;
}
