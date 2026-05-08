/**
 * Pocket-side auto-detector.
 *
 * Physics: When the user bows for Ruku, the phone rotates forward in the
 * sagittal plane. The cross-product of the standing and ruku gravity vectors
 * yields the rotation axis. The lateral (X) component of that axis has a sign
 * that flips depending on which pocket the phone is in, because the phone's
 * X-axis faces opposite directions in the two pockets.
 *
 * We also check the X component of the ruku and sujood vectors directly —
 * both should be consistent (same sign) if calibration was done correctly.
 */

export type PocketSide = "left" | "right" | "unknown";

export interface PocketDetectionResult {
  side:       PocketSide;
  /** How reliable the detection is */
  confidence: "high" | "medium" | "low";
  /** Short human-readable rationale shown in UI */
  reason:     string;
}

/**
 * Infer pocket side from the four calibration gravity vectors.
 * All vectors are in phone-frame accelerometer units (g).
 */
export function detectPocketSide(
  standing: [number, number, number],
  ruku:     [number, number, number],
  sujood:   [number, number, number],
  sitting:  [number, number, number]
): PocketDetectionResult {
  // ── Cross-product signal ───────────────────────────────────────────────────
  // standing × ruku → rotation axis
  const [sx, sy, sz] = standing;
  const [rx, ry, rz] = ruku;

  const axisX = sy * rz - sz * ry;
  // axisY = sz * rx - sx * rz (unused)
  const axisZ = sx * ry - sy * rx;

  // ── Direct lateral signals ─────────────────────────────────────────────────
  // The X-component of gravity during Ruku and Sujood is the clearest
  // left/right discriminator (phone tilts forward, lateral axis exposed).
  const rukoLateral  = ruku[0];
  const sujoLateral  = sujood[0];
  const sitLateral   = sitting[0];

  const signRuku  = Math.sign(rukoLateral);
  const signSujo  = Math.sign(sujoLateral);
  const signSit   = Math.sign(sitLateral);

  // Count agreements across the three lateral signals (excluding zeros)
  const lateralSigns = [signRuku, signSujo, signSit].filter(s => s !== 0);
  const positiveCount = lateralSigns.filter(s => s > 0).length;
  const negativeCount = lateralSigns.filter(s => s < 0).length;
  const dominant = positiveCount > negativeCount ? 1 : negativeCount > positiveCount ? -1 : 0;

  const lateralMagnitude = Math.max(Math.abs(rukoLateral), Math.abs(sujoLateral));

  // ── Cross-product confirmation ─────────────────────────────────────────────
  // axisX of the rotation should agree in sign with the dominant lateral signal.
  // A large axisZ (out-of-plane component) usually means insufficient tilt.
  const crossMagnitude = Math.sqrt(axisX * axisX + axisZ * axisZ);
  const axisReliable   = crossMagnitude > 0.05;

  // ── Decision ──────────────────────────────────────────────────────────────
  if (dominant === 0 || lateralMagnitude < 0.08) {
    return {
      side:       "unknown",
      confidence: "low",
      reason:     "Gravity vectors too similar — couldn't determine pocket side",
    };
  }

  // Convention: positive dominant lateral X → right pocket (screen faces inward
  // toward right thigh; phone's +X points toward the body's right side outward).
  // Negative → left pocket.
  const side: PocketSide = dominant > 0 ? "right" : "left";

  const allAgree  = lateralSigns.every(s => s === dominant);
  const highConf  = allAgree && lateralMagnitude > 0.18 && axisReliable;
  const medConf   = allAgree || (lateralMagnitude > 0.12 && axisReliable);

  const confidence = highConf ? "high" : medConf ? "medium" : "low";

  const reason = highConf
    ? "All positions consistently indicate this pocket"
    : medConf
    ? "Most positions indicate this pocket"
    : "Weak signal — you may want to verify manually";

  return { side, confidence, reason };
}

/** Flip left ↔ right; unknown stays unknown */
export function flipPocketSide(side: PocketSide): PocketSide {
  if (side === "left")  return "right";
  if (side === "right") return "left";
  return "unknown";
}
