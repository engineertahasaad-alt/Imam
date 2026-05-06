export type CalculationMethod = "MWL" | "ISNA" | "Egypt" | "Makkah" | "Karachi" | "Gulf";

interface MethodParams {
  fajrAngle: number;
  ishaAngle?: number;
  ishaMinutes?: number;
  asrFactor: number;
  name: string;
}

export const CALCULATION_METHODS: Record<CalculationMethod, MethodParams> = {
  MWL: { fajrAngle: 18, ishaAngle: 17, asrFactor: 1, name: "Muslim World League" },
  ISNA: { fajrAngle: 15, ishaAngle: 15, asrFactor: 1, name: "ISNA (North America)" },
  Egypt: { fajrAngle: 19.5, ishaAngle: 17.5, asrFactor: 1, name: "Egyptian General Authority" },
  Makkah: { fajrAngle: 18.5, ishaMinutes: 90, asrFactor: 1, name: "Umm Al-Qura (Makkah)" },
  Karachi: { fajrAngle: 18, ishaAngle: 18, asrFactor: 1, name: "University of Islamic Sciences, Karachi" },
  Gulf: { fajrAngle: 19.5, ishaMinutes: 90, asrFactor: 1, name: "Gulf Region" },
};

function rad(d: number): number {
  return (d * Math.PI) / 180;
}
function deg(r: number): number {
  return (r * 180) / Math.PI;
}
function sind(d: number): number {
  return Math.sin(rad(d));
}
function cosd(d: number): number {
  return Math.cos(rad(d));
}
function tand(d: number): number {
  return Math.tan(rad(d));
}
function acosd(x: number): number {
  return deg(Math.acos(Math.max(-1, Math.min(1, x))));
}
function asind(x: number): number {
  return deg(Math.asin(Math.max(-1, Math.min(1, x))));
}
function atan2d(y: number, x: number): number {
  return deg(Math.atan2(y, x));
}

function julianDay(year: number, month: number, day: number): number {
  if (month <= 2) {
    year--;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    B -
    1524.5
  );
}

interface SunPos {
  declination: number;
  equationOfTime: number;
}

function sunPosition(jd: number): SunPos {
  const D = jd - 2451545.0;
  const g = ((357.529 + 0.98560028 * D) % 360 + 360) % 360;
  const q = ((280.459 + 0.98564736 * D) % 360 + 360) % 360;
  const L = ((q + 1.915 * sind(g) + 0.02 * sind(2 * g)) % 360 + 360) % 360;
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2d(cosd(e) * sind(L), cosd(L)) / 15;
  const normalRA = ((RA % 24) + 24) % 24;
  const declination = asind(sind(e) * sind(L));
  const equationOfTime = q / 15 - normalRA;
  return { declination, equationOfTime };
}

function hourAngle(angle: number, lat: number, dec: number): number {
  const cosHA =
    (-sind(angle) - sind(lat) * sind(dec)) / (cosd(lat) * cosd(dec));
  if (cosHA < -1 || cosHA > 1) return -1;
  return acosd(cosHA) / 15;
}

function asrAngle(lat: number, dec: number, factor: number): number {
  const targetAngle = deg(
    Math.atan(1 / (factor + tand(Math.abs(lat - dec))))
  );
  return -targetAngle;
}

export interface PrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

export function calculatePrayerTimes(
  lat: number,
  lng: number,
  date: Date = new Date(),
  method: CalculationMethod = "MWL"
): PrayerTimes {
  const params = CALCULATION_METHODS[method];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const jd = julianDay(year, month, day);
  const { declination: dec, equationOfTime: Eqt } = sunPosition(jd);

  const timezone = -date.getTimezoneOffset() / 60;
  const dhuhrHour = 12 + timezone - lng / 15 - Eqt;

  const fajrHA = hourAngle(-params.fajrAngle, lat, dec);
  const sunriseHA = hourAngle(-0.8333, lat, dec);
  const asrHA = hourAngle(asrAngle(lat, dec, params.asrFactor), lat, dec);
  const maghribHA = hourAngle(-0.8333, lat, dec);
  const ishaHA =
    params.ishaMinutes !== undefined
      ? null
      : hourAngle(-(params.ishaAngle ?? 17), lat, dec);

  const fajrHour = dhuhrHour - (fajrHA >= 0 ? fajrHA : 1.5);
  const sunriseHour = dhuhrHour - (sunriseHA >= 0 ? sunriseHA : 1.0);
  const asrHour = dhuhrHour + (asrHA >= 0 ? asrHA : 3.5);
  const maghribHour = dhuhrHour + (maghribHA >= 0 ? maghribHA : 1.0);
  const ishaHour =
    params.ishaMinutes !== undefined
      ? maghribHour + params.ishaMinutes / 60
      : dhuhrHour + (ishaHA !== null && ishaHA >= 0 ? ishaHA : 5.5);

  function toDate(hour: number): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return new Date(d.getTime() + hour * 3600000);
  }

  return {
    fajr: toDate(fajrHour),
    sunrise: toDate(sunriseHour),
    dhuhr: toDate(dhuhrHour),
    asr: toDate(asrHour),
    maghrib: toDate(maghribHour),
    isha: toDate(ishaHour),
  };
}

export function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export interface CurrentPrayerInfo {
  current: string;
  next: string;
  nextTime: Date;
  timeRemaining: number;
}

export const PRAYER_NAMES_EN = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export const PRAYER_ARABIC: Record<string, string> = {
  Fajr: "الفجر",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

export function getCurrentAndNextPrayer(
  times: PrayerTimes
): CurrentPrayerInfo {
  const now = new Date();
  const prayers: Array<{ name: string; time: Date }> = [
    { name: "Fajr", time: times.fajr },
    { name: "Dhuhr", time: times.dhuhr },
    { name: "Asr", time: times.asr },
    { name: "Maghrib", time: times.maghrib },
    { name: "Isha", time: times.isha },
  ];

  if (now < prayers[0].time) {
    return {
      current: "Isha",
      next: "Fajr",
      nextTime: prayers[0].time,
      timeRemaining: prayers[0].time.getTime() - now.getTime(),
    };
  }

  for (let i = 0; i < prayers.length - 1; i++) {
    if (now >= prayers[i].time && now < prayers[i + 1].time) {
      return {
        current: prayers[i].name,
        next: prayers[i + 1].name,
        nextTime: prayers[i + 1].time,
        timeRemaining: prayers[i + 1].time.getTime() - now.getTime(),
      };
    }
  }

  const tomorrowFajr = new Date(times.fajr.getTime() + 24 * 3600000);
  return {
    current: "Isha",
    next: "Fajr",
    nextTime: tomorrowFajr,
    timeRemaining: tomorrowFajr.getTime() - now.getTime(),
  };
}

export function getRakaatCount(prayerName: string): number {
  switch (prayerName) {
    case "Fajr":
      return 2;
    case "Dhuhr":
      return 4;
    case "Asr":
      return 4;
    case "Maghrib":
      return 3;
    case "Isha":
      return 4;
    default:
      return 4;
  }
}
