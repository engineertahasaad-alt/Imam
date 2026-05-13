/**
 * Pure offline Hijri (Islamic) calendar converter.
 * Uses the arithmetic tabular calendar algorithm (fourmilab).
 * Verified correct for multiple test dates including Ramadan 2024.
 * No network requests — works entirely offline.
 */

const ISLAMIC_EPOCH = 1948439.5;

const MONTH_NAMES_EN = [
  "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah",
];

const MONTH_NAMES_AR = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الثانية", "رجب", "شعبان",
  "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

const DAY_NAMES_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

const DAY_NAMES_AR = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء",
  "الخميس", "الجمعة", "السبت",
];

/** Convert a Gregorian date to its Julian Day Number (integer, at noon). */
function gregorianToJD(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** Convert Hijri (y, m, d) to Julian Day Number. */
function islamicToJD(year: number, month: number, day: number): number {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    ISLAMIC_EPOCH -
    1
  );
}

export interface HijriDate {
  year:        number;
  month:       number;   // 1–12
  day:         number;   // 1–30
  monthNameEn: string;
  monthNameAr: string;
  dayNameEn:   string;
  dayNameAr:   string;
  /** "22 Ramadan 1445" */
  formatted:   string;
  /** "٢٢ رمضان ١٤٤٥" */
  formattedAr: string;
  /** "22 Ramadan" (no year) */
  shortEn:     string;
  /** "٢٢ رمضان" (no year) */
  shortAr:     string;
}

function toArabicNumerals(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/**
 * Convert a JavaScript Date to its Hijri equivalent.
 * Defaults to today when called with no arguments.
 */
export function toHijri(date: Date = new Date()): HijriDate {
  const jd       = gregorianToJD(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const jdOffset = jd - Math.floor(ISLAMIC_EPOCH); // = jd - 1948439

  const year  = Math.floor((jdOffset + 0.5) / 354.36707) + 1;
  const jd1   = islamicToJD(year, 1, 1) - ISLAMIC_EPOCH;
  const month = Math.min(12, Math.ceil((jdOffset - 29 - jd1) / 29.5) + 1);
  const jdM   = islamicToJD(year, month, 1) - ISLAMIC_EPOCH;
  const day   = Math.floor(jdOffset - jdM) + 1;

  const monthNameEn = MONTH_NAMES_EN[month - 1] ?? "";
  const monthNameAr = MONTH_NAMES_AR[month - 1] ?? "";
  const dow         = date.getDay();
  const dayNameEn   = DAY_NAMES_EN[dow] ?? "";
  const dayNameAr   = DAY_NAMES_AR[dow] ?? "";

  const formatted   = `${day} ${monthNameEn} ${year}`;
  const dayAr       = toArabicNumerals(day);
  const yearAr      = toArabicNumerals(year);
  const formattedAr = `${dayAr} ${monthNameAr} ${yearAr}`;

  return {
    year, month, day,
    monthNameEn, monthNameAr,
    dayNameEn, dayNameAr,
    formatted,
    formattedAr,
    shortEn: `${day} ${monthNameEn}`,
    shortAr: `${dayAr} ${monthNameAr}`,
  };
}

/**
 * Returns true if today is a special Islamic day.
 * Returns a label string or null.
 */
export function getIslamicDayLabel(h: HijriDate): string | null {
  const { month, day } = h;
  if (month === 9)                              return "رمضان";       // All of Ramadan
  if (month === 10 && day === 1)                return "عيد الفطر";
  if (month === 12 && day >= 9 && day <= 13)    return "أيام الحج";
  if (month === 12 && day === 10)               return "عيد الأضحى";
  if (month === 1  && day === 10)               return "عاشوراء";
  if (month === 3  && day === 12)               return "المولد النبوي";
  if (month === 7  && day === 27)               return "ليلة المعراج";
  if (month === 8  && day === 15)               return "نصف شعبان";
  return null;
}
