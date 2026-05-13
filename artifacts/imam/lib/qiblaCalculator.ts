const MECCA = { lat: 21.4225, lng: 39.8262 };

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Returns the initial bearing (0–360°, clockwise from true North)
 * from the user's location to Mecca.
 */
export function getQiblaBearing(userLat: number, userLng: number): number {
  const φ1 = toRad(userLat);
  const φ2 = toRad(MECCA.lat);
  const Δλ = toRad(MECCA.lng - userLng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/** Great-circle distance in kilometres from user to Mecca. */
export function getDistanceToMeccaKm(userLat: number, userLng: number): number {
  const R = 6371;
  const φ1 = toRad(userLat);
  const φ2 = toRad(MECCA.lat);
  const Δφ = toRad(MECCA.lat - userLat);
  const Δλ = toRad(MECCA.lng - userLng);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Given raw magnetometer x/y readings (phone held flat, screen up),
 * returns the magnetic heading in degrees (0–360, clockwise from North).
 */
export function magnetometerToHeading(magX: number, magY: number): number {
  const heading = (Math.atan2(-magY, magX) * 180) / Math.PI;
  return (heading + 360) % 360;
}
