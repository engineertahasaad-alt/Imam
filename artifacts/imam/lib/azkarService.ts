/**
 * Azkar Overlay — Core Service
 * Isolated module. Does NOT interact with prayer or adhan systems.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyZikr {
  id: string;
  arabicText: string;
  englishText: string;
  repeatCount: number;
  category: "morning" | "evening";
}

export interface AzkarSettings {
  enabled: boolean;
  frequencyMinutes: number;
  displaySeconds: number;
  opacity: number;
  fontSize: "small" | "medium" | "large";
  position: "left" | "right";
  vibration: boolean;
  backgroundNotifications: boolean;
  morningReminderEnabled: boolean;
  morningReminderHour: number;
  morningReminderMinute: number;
  eveningReminderEnabled: boolean;
  eveningReminderHour: number;
  eveningReminderMinute: number;
}

// ── Daily Completion Record ────────────────────────────────────────────────────

export interface DailyCompletionRecord {
  date: string;
  morning: boolean;
  evening: boolean;
}

const COMPLETION_KEY = "@azkar/completion_v1";

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function loadDailyCompletion(): Promise<DailyCompletionRecord> {
  const today = todayString();
  try {
    const raw = await AsyncStorage.getItem(COMPLETION_KEY);
    if (!raw) return { date: today, morning: false, evening: false };
    const parsed: DailyCompletionRecord = JSON.parse(raw);
    if (parsed.date !== today) return { date: today, morning: false, evening: false };
    return parsed;
  } catch {
    return { date: today, morning: false, evening: false };
  }
}

export async function markCategoryComplete(
  category: "morning" | "evening"
): Promise<DailyCompletionRecord> {
  const current = await loadDailyCompletion();
  const updated: DailyCompletionRecord = {
    ...current,
    [category]: true,
  };
  await AsyncStorage.setItem(COMPLETION_KEY, JSON.stringify(updated));
  return updated;
}

export interface Zikr {
  arabic: string;
  transliteration: string;
  translation: string;
}

export function dailyZikrToZikr(dz: DailyZikr): Zikr {
  return {
    arabic: dz.arabicText,
    transliteration: "",
    translation: dz.englishText,
  };
}

// ── Morning & Evening Azkar Content (source: hisnmuslim.com API, ID 27) ───────

export const MORNING_AZKAR: DailyZikr[] = [
  {
    id: "m1",
    arabicText: "أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ ﴿اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَوَاتِ وَالْأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ﴾.",
    englishText: "Allah - there is no deity except Him, the Ever-Living, the Sustainer of [all] existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursi extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m2",
    arabicText: "بسم الله الرحمن الرحيم ﴿قُلْ هُوَ اللَّهُ أَحَدٌ* اللَّهُ الصَّمَدُ* لَمْ يَلِدْ وَلَمْ يُولَدْ* وَلَمْ يَكُن لَّهُ كُفُواً أَحَدٌ﴾.  بسم الله الرحمن الرحيم ﴿قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ* مِن شَرِّ مَا خَلَقَ* وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ* وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ* وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ﴾.  بسم الله الرحمن الرحيم ﴿قُلْ أَعُوذُ بِرَبِّ النَّاسِ* مَلِكِ النَّاسِ* إِلَهِ النَّاسِ* مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ* الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ* مِنَ الْجِنَّةِ وَ النَّاسِ﴾ (ثلاثَ مرَّاتٍ).",
    englishText: "Qul Huwa Allahu Ahad (Surah Al-Ikhlas), Qul A'udhu bi-rabb il-falaq (Surah Al-Falaq), and Qul A'udhu bi-rabb in-nas (Surah An-Nas) — each recited three times.",
    repeatCount: 3,
    category: "morning",
  },
  {
    id: "m3",
    arabicText: "((أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيرَ مَا بَعْدَهُ ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ)).",
    englishText: "We have reached the morning and at this very time all sovereignty belongs to Allah. All praise is for Allah. None has the right to be worshipped except Allah, alone, without partner. To Him belongs all sovereignty and all praise, and He is over all things omnipotent. My Lord, I ask You for the good of this day and the good of what follows it, and I seek refuge in You from the evil of this day and the evil of what follows it. My Lord, I seek refuge in You from laziness and senility. My Lord, I seek refuge in You from torment in the Fire and punishment in the grave.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m4",
    arabicText: "((اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا ، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ)).",
    englishText: "O Allah, by Your leave we have reached the morning and by Your leave we have reached the evening, by Your leave we live and die and unto You is our resurrection.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m5",
    arabicText: "((اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لاَ يَغْفِرُ الذُّنوبَ إِلاَّ أَنْتَ)).",
    englishText: "O Allah, You are my Lord, none has the right to be worshipped except You, You created me and I am Your servant and I abide by Your covenant and promise as best I can. I seek refuge in You from the evil of what I have committed. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins except You.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m6",
    arabicText: "((اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتِكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ)) (أربعَ مَرَّاتٍ).",
    englishText: "O Allah, verily I have reached the morning and call on You, the bearers of Your Throne, Your angels, and all of Your creation to witness that You are Allah, none has the right to be worshipped except You, alone, without partner and that Muhammad is Your Servant and Messenger. (Four times)",
    repeatCount: 4,
    category: "morning",
  },
  {
    id: "m7",
    arabicText: "((اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ)).",
    englishText: "O Allah, what blessing I or any of Your creation have risen upon, is from You alone, without partner, so for You is all praise and unto You all thanks.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m8",
    arabicText: "((اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَهَ إِلاَّ أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ، وَالفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ القَبْرِ، لاَ إِلَهَ إِلاَّ أَنْتَ)) (ثلاثَ مرَّاتٍ).",
    englishText: "O Allah, grant my body health. O Allah, grant my hearing health. O Allah, grant my sight health. None has the right to be worshipped except You. O Allah, I seek refuge with You from disbelief and poverty, and I seek refuge with You from the punishment of the grave. None has the right to be worshipped except You. (Three times)",
    repeatCount: 3,
    category: "morning",
  },
  {
    id: "m9",
    arabicText: "((حَسْبِيَ اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ عَلَيهِ تَوَكَّلتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ)) (سَبْعَ مَرّاتٍ).",
    englishText: "Allah is Sufficient for me, none has the right to be worshipped except Him, upon Him I rely and He is Lord of the exalted Throne. (Seven times)",
    repeatCount: 7,
    category: "morning",
  },
  {
    id: "m10",
    arabicText: "((اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ: فِي دِينِي وَدُنْيَايَ وَأَهْلِي، وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي، وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَينِ يَدَيَّ، وَمِنْ خَلْفِي، وَعَنْ يَمِينِي، وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي)).",
    englishText: "O Allah, I ask You for pardon and well-being in this life and the next. O Allah, I ask You for pardon and well-being in my religious and worldly affairs, and my family and my wealth. O Allah, veil my weaknesses and set at ease my dismay. O Allah, preserve me from the front and from behind and on my right and on my left and from above, and I take refuge with You lest I be swallowed up by the earth.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m11",
    arabicText: "((اللَّهُمَّ عَالِمَ الغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطانِ وَشَرَكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءاً، أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ)).",
    englishText: "O Allah, Knower of the unseen and the seen, Creator of the heavens and the Earth, Lord and Sovereign of all things, I bear witness that none has the right to be worshipped except You. I seek refuge in You from the evil of my soul and from the evil and shirk of the devil, and from committing wrong against my soul or bringing such upon another Muslim.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m12",
    arabicText: "((بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلاَ فِي السّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ)) (ثلاثَ مرَّاتٍ).",
    englishText: "In the name of Allah with whose name nothing is harmed on earth nor in the heavens and He is The All-Hearing, The All-Knowing. (Three times)",
    repeatCount: 3,
    category: "morning",
  },
  {
    id: "m13",
    arabicText: "((رَضِيتُ بِاللَّهِ رَبَّاً، وَبِالْإِسْلاَمِ دِيناً، وَبِمُحَمَّدٍ صلى الله عليه وسلم نَبِيّاً)) (ثلاثَ مرَّاتٍ).",
    englishText: "I am pleased with Allah as a Lord, and Islam as a religion and Muhammad ﷺ as a Prophet. (Three times)",
    repeatCount: 3,
    category: "morning",
  },
  {
    id: "m14",
    arabicText: "((يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغيثُ أَصْلِحْ لِي شَأْنِيَ كُلَّهُ وَلاَ تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ)).",
    englishText: "O Ever Living, O Self-Subsisting and Supporter of all, by Your mercy I seek assistance, rectify for me all of my affairs and do not leave me to myself, even for the blink of an eye.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m15",
    arabicText: "((أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ، اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذَا الْيَوْمِ فَتْحَهُ وَنَصْرَهُ وَنُورَهُ وَبَرَكَتَهُ وَهُدَاهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهِ وَشَرِّ مَا بَعْدَهُ)).",
    englishText: "We have reached the morning and the dominion belongs to Allah, Lord of the worlds. O Allah, I ask You for the good of this day, its victory, its help, its light, its blessings and its guidance, and I seek refuge in You from the evil in it and the evil that comes after it.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m16",
    arabicText: "((أَصْبَحْنا عَلَى فِطْرَةِ الْإِسْلاَمِ، وَعَلَى كَلِمَةِ الْإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صلى الله عليه وسلم، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ الْمُشْرِكِينَ)).",
    englishText: "We have reached the morning upon the fitrah of Islam, and the word of sincerity, and upon the religion of our Prophet Muhammad ﷺ, and the way of our father Ibrahim, who was upright and submitted to Allah, and was not of those who associate partners with Him.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m17",
    arabicText: "((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ)) (مائة مرَّةٍ).",
    englishText: "How perfect Allah is and I praise Him. (One hundred times)",
    repeatCount: 100,
    category: "morning",
  },
  {
    id: "m18",
    arabicText: "((لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ)) (عشرَ مرَّات).",
    englishText: "None has the right to be worshipped except Allah, alone, without partner, to Him belongs all sovereignty and praise, and He is over all things omnipotent. (Ten times)",
    repeatCount: 10,
    category: "morning",
  },
  {
    id: "m19",
    arabicText: "((لاَ إِلَهَ إِلاَّ اللَّهُ، وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيءٍ قَدِيرٌ)) (مائة مرة).",
    englishText: "None has the right to be worshipped except Allah, alone, without partner, to Him belongs all sovereignty and praise, and He is over all things omnipotent. (One hundred times)",
    repeatCount: 100,
    category: "morning",
  },
  {
    id: "m20",
    arabicText: "((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ: عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ)) (ثلاثَ مرَّاتٍ).",
    englishText: "How perfect Allah is and I praise Him, by the number of His creation and His pleasure, and by the weight of His Throne and the ink of His words. (Three times)",
    repeatCount: 3,
    category: "morning",
  },
  {
    id: "m21",
    arabicText: "((اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْماً نَافِعاً، وَرِزْقاً طَيِّباً، وَعَمَلاً مُتَقَبَّلاً)).",
    englishText: "O Allah, I ask You for knowledge that is beneficial, provision that is good, and deeds that are acceptable.",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m22",
    arabicText: "((أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ)) (مِائَةَ مَرَّةٍ فِي الْيَوْمِ).",
    englishText: "I seek Allah's forgiveness and I turn to Him in repentance. (One hundred times a day)",
    repeatCount: 100,
    category: "morning",
  },
  {
    id: "m23",
    arabicText: "((أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ)) (ثلاثَ مرَّاتٍ).",
    englishText: "I seek refuge in the perfect words of Allah from the evil of what He has created. (Three times)",
    repeatCount: 3,
    category: "morning",
  },
  {
    id: "m24",
    arabicText: "((اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبَيِّنَا مُحَمَّدٍ)) (عشرَ مرَّاتٍ).",
    englishText: "O Allah, send prayers and peace upon our Prophet Muhammad. (Ten times)",
    repeatCount: 10,
    category: "morning",
  },
];

export const EVENING_AZKAR: DailyZikr[] = [
  {
    id: "e1",
    arabicText: "أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ ﴿اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَوَاتِ وَالْأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ﴾.",
    englishText: "Allah - there is no deity except Him, the Ever-Living, the Sustainer of [all] existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursi extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e2",
    arabicText: "بسم الله الرحمن الرحيم ﴿قُلْ هُوَ اللَّهُ أَحَدٌ* اللَّهُ الصَّمَدُ* لَمْ يَلِدْ وَلَمْ يُولَدْ* وَلَمْ يَكُن لَّهُ كُفُواً أَحَدٌ﴾.  بسم الله الرحمن الرحيم ﴿قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ* مِن شَرِّ مَا خَلَقَ* وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ* وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ* وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ﴾.  بسم الله الرحمن الرحيم ﴿قُلْ أَعُوذُ بِرَبِّ النَّاسِ* مَلِكِ النَّاسِ* إِلَهِ النَّاسِ* مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ* الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ* مِنَ الْجِنَّةِ وَ النَّاسِ﴾ (ثلاثَ مرَّاتٍ).",
    englishText: "Qul Huwa Allahu Ahad (Surah Al-Ikhlas), Qul A'udhu bi-rabb il-falaq (Surah Al-Falaq), and Qul A'udhu bi-rabb in-nas (Surah An-Nas) — each recited three times.",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e3",
    arabicText: "((أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ)).",
    englishText: "We have reached the evening and at this very time all sovereignty belongs to Allah. All praise is for Allah. None has the right to be worshipped except Allah, alone, without partner. To Him belongs all sovereignty and all praise, and He is over all things omnipotent. My Lord, I ask You for the good of this night and the good of what follows it, and I seek refuge in You from the evil of this night and the evil of what follows it. My Lord, I seek refuge in You from laziness and senility. My Lord, I seek refuge in You from torment in the Fire and punishment in the grave.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e4",
    arabicText: "((اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ)).",
    englishText: "O Allah, by Your leave we have reached the evening and by Your leave we have reached the morning, by Your leave we live and die and unto You is our return.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e5",
    arabicText: "((اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لاَ يَغْفِرُ الذُّنوبَ إِلاَّ أَنْتَ)).",
    englishText: "O Allah, You are my Lord, none has the right to be worshipped except You, You created me and I am Your servant and I abide by Your covenant and promise as best I can. I seek refuge in You from the evil of what I have committed. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins except You.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e6",
    arabicText: "((اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتِكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ)) (أربعَ مَرَّاتٍ).",
    englishText: "O Allah, verily I have reached the evening and call on You, the bearers of Your Throne, Your angels, and all of Your creation to witness that You are Allah, none has the right to be worshipped except You, alone, without partner and that Muhammad is Your Servant and Messenger. (Four times)",
    repeatCount: 4,
    category: "evening",
  },
  {
    id: "e7",
    arabicText: "((اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ)).",
    englishText: "O Allah, what blessing I or any of Your creation have this evening, is from You alone, without partner, so for You is all praise and unto You all thanks.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e8",
    arabicText: "((اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَهَ إِلاَّ أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ، وَالفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ القَبْرِ، لاَ إِلَهَ إِلاَّ أَنْتَ)) (ثلاثَ مرَّاتٍ).",
    englishText: "O Allah, grant my body health. O Allah, grant my hearing health. O Allah, grant my sight health. None has the right to be worshipped except You. O Allah, I seek refuge with You from disbelief and poverty, and I seek refuge with You from the punishment of the grave. None has the right to be worshipped except You. (Three times)",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e9",
    arabicText: "((حَسْبِيَ اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ عَلَيهِ تَوَكَّلتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ)) (سَبْعَ مَرّاتٍ).",
    englishText: "Allah is Sufficient for me, none has the right to be worshipped except Him, upon Him I rely and He is Lord of the exalted Throne. (Seven times)",
    repeatCount: 7,
    category: "evening",
  },
  {
    id: "e10",
    arabicText: "((اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ: فِي دِينِي وَدُنْيَايَ وَأَهْلِي، وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي، وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَينِ يَدَيَّ، وَمِنْ خَلْفِي، وَعَنْ يَمِينِي، وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي)).",
    englishText: "O Allah, I ask You for pardon and well-being in this life and the next. O Allah, I ask You for pardon and well-being in my religious and worldly affairs, and my family and my wealth. O Allah, veil my weaknesses and set at ease my dismay. O Allah, preserve me from the front and from behind and on my right and on my left and from above, and I take refuge with You lest I be swallowed up by the earth.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e11",
    arabicText: "((اللَّهُمَّ عَالِمَ الغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطانِ وَشَرَكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءاً، أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ)).",
    englishText: "O Allah, Knower of the unseen and the seen, Creator of the heavens and the Earth, Lord and Sovereign of all things, I bear witness that none has the right to be worshipped except You. I seek refuge in You from the evil of my soul and from the evil and shirk of the devil, and from committing wrong against my soul or bringing such upon another Muslim.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e12",
    arabicText: "((بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلاَ فِي السّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ)) (ثلاثَ مرَّاتٍ).",
    englishText: "In the name of Allah with whose name nothing is harmed on earth nor in the heavens and He is The All-Hearing, The All-Knowing. (Three times)",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e13",
    arabicText: "((رَضِيتُ بِاللَّهِ رَبَّاً، وَبِالْإِسْلاَمِ دِيناً، وَبِمُحَمَّدٍ صلى الله عليه وسلم نَبِيّاً)) (ثلاثَ مرَّاتٍ).",
    englishText: "I am pleased with Allah as a Lord, and Islam as a religion and Muhammad ﷺ as a Prophet. (Three times)",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e14",
    arabicText: "((يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغيثُ أَصْلِحْ لِي شَأْنِيَ كُلَّهُ وَلاَ تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ)).",
    englishText: "O Ever Living, O Self-Subsisting and Supporter of all, by Your mercy I seek assistance, rectify for me all of my affairs and do not leave me to myself, even for the blink of an eye.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e15",
    arabicText: "((أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ، اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذِهِ اللَّيْلَةِ فَتْحَهَا وَنَصْرَهَا وَنُورَهَا وَبَرَكَتَهَا وَهُدَاهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهَا وَشَرِّ مَا بَعْدَهَا)).",
    englishText: "We have reached the evening and the dominion belongs to Allah, Lord of the worlds. O Allah, I ask You for the good of this night, its victory, its help, its light, its blessings and its guidance, and I seek refuge in You from the evil in it and the evil that comes after it.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e16",
    arabicText: "((أَمْسَيْنا عَلَى فِطْرَةِ الْإِسْلاَمِ، وَعَلَى كَلِمَةِ الْإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صلى الله عليه وسلم، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ الْمُشْرِكِينَ)).",
    englishText: "We have reached the evening upon the fitrah of Islam, and the word of sincerity, and upon the religion of our Prophet Muhammad ﷺ, and the way of our father Ibrahim, who was upright and submitted to Allah, and was not of those who associate partners with Him.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e17",
    arabicText: "((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ)) (مائة مرَّةٍ).",
    englishText: "How perfect Allah is and I praise Him. (One hundred times)",
    repeatCount: 100,
    category: "evening",
  },
  {
    id: "e18",
    arabicText: "((لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ)) (عشرَ مرَّات).",
    englishText: "None has the right to be worshipped except Allah, alone, without partner, to Him belongs all sovereignty and praise, and He is over all things omnipotent. (Ten times)",
    repeatCount: 10,
    category: "evening",
  },
  {
    id: "e19",
    arabicText: "((لاَ إِلَهَ إِلاَّ اللَّهُ، وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيءٍ قَدِيرٌ)) (مائة مرة).",
    englishText: "None has the right to be worshipped except Allah, alone, without partner, to Him belongs all sovereignty and praise, and He is over all things omnipotent. (One hundred times)",
    repeatCount: 100,
    category: "evening",
  },
  {
    id: "e20",
    arabicText: "((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ: عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ)) (ثلاثَ مرَّاتٍ).",
    englishText: "How perfect Allah is and I praise Him, by the number of His creation and His pleasure, and by the weight of His Throne and the ink of His words. (Three times)",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e21",
    arabicText: "((اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْماً نَافِعاً، وَرِزْقاً طَيِّباً، وَعَمَلاً مُتَقَبَّلاً)).",
    englishText: "O Allah, I ask You for knowledge that is beneficial, provision that is good, and deeds that are acceptable.",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e22",
    arabicText: "((أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ)) (مِائَةَ مَرَّةٍ فِي الْيَوْمِ).",
    englishText: "I seek Allah's forgiveness and I turn to Him in repentance. (One hundred times a day)",
    repeatCount: 100,
    category: "evening",
  },
  {
    id: "e23",
    arabicText: "((أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ)) (ثلاثَ مرَّاتٍ).",
    englishText: "I seek refuge in the perfect words of Allah from the evil of what He has created. (Three times)",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e24",
    arabicText: "((اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبَيِّنَا مُحَمَّدٍ)) (عشرَ مرَّاتٍ).",
    englishText: "O Allah, send prayers and peace upon our Prophet Muhammad. (Ten times)",
    repeatCount: 10,
    category: "evening",
  },
];

// ── Built-in Azkar Content (floating widget, source: hisnmuslim.com API) ──────

export const AZKAR: Zikr[] = [
  {
    arabic: "((رَضِيتُ بِاللَّهِ رَبَّاً، وَبِالْإِسْلاَمِ دِيناً، وَبِمُحَمَّدٍ صلى الله عليه وسلم نَبِيّاً)) (ثلاثَ مرَّاتٍ).",
    transliteration: "",
    translation: "I am pleased with Allah as a Lord, and Islam as a religion and Muhammad ﷺ as a Prophet. (Three times)",
  },
  {
    arabic: "((بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلاَ فِي السّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ)) (ثلاثَ مرَّاتٍ).",
    transliteration: "",
    translation: "In the name of Allah with whose name nothing is harmed on earth nor in the heavens and He is The All-Hearing, The All-Knowing. (Three times)",
  },
  {
    arabic: "((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ)) (مائة مرَّةٍ).",
    transliteration: "",
    translation: "How perfect Allah is and I praise Him. (One hundred times)",
  },
  {
    arabic: "((لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ)) (عشرَ مرَّات).",
    transliteration: "",
    translation: "None has the right to be worshipped except Allah, alone, without partner, to Him belongs all sovereignty and praise, and He is over all things omnipotent. (Ten times)",
  },
  {
    arabic: "((أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ)) (مِائَةَ مَرَّةٍ فِي الْيَوْمِ).",
    transliteration: "",
    translation: "I seek Allah's forgiveness and I turn to Him in repentance. (One hundred times a day)",
  },
  {
    arabic: "((اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبَيِّنَا مُحَمَّدٍ)) (عشرَ مرَّاتٍ).",
    transliteration: "",
    translation: "O Allah, send prayers and peace upon our Prophet Muhammad. (Ten times)",
  },
  {
    arabic: "((حَسْبِيَ اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ عَلَيهِ تَوَكَّلتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ)) (سَبْعَ مَرّاتٍ).",
    transliteration: "",
    translation: "Allah is Sufficient for me, none has the right to be worshipped except Him, upon Him I rely and He is Lord of the exalted Throne. (Seven times)",
  },
  {
    arabic: "((يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغيثُ أَصْلِحْ لِي شَأْنِيَ كُلَّهُ وَلاَ تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ)).",
    transliteration: "",
    translation: "O Ever Living, O Self-Subsisting and Supporter of all, by Your mercy I seek assistance, rectify for me all of my affairs and do not leave me to myself, even for the blink of an eye.",
  },
];

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_AZKAR_SETTINGS: AzkarSettings = {
  enabled: false,
  frequencyMinutes: 15,
  displaySeconds: 6,
  opacity: 0.97,
  fontSize: "medium",
  position: "right",
  vibration: false,
  backgroundNotifications: true,
  morningReminderEnabled: false,
  morningReminderHour: 6,
  morningReminderMinute: 30,
  eveningReminderEnabled: false,
  eveningReminderHour: 17,
  eveningReminderMinute: 30,
};

// ── Storage keys ──────────────────────────────────────────────────────────────

const SETTINGS_KEY     = "@azkar/settings_v1";
const HISTORY_KEY      = "@azkar/history_v1";
const CUSTOM_AZKAR_KEY = "@azkar/custom_v1";
const REPEAT_BUFFER    = 4;

const VALID_FONT_SIZES = new Set<AzkarSettings["fontSize"]>(["small", "medium", "large"]);
const VALID_POSITIONS  = new Set<AzkarSettings["position"]>(["left", "right"]);

function sanitizeAzkarSettings(raw: Partial<AzkarSettings>): AzkarSettings {
  return {
    ...DEFAULT_AZKAR_SETTINGS,
    ...raw,
    fontSize: VALID_FONT_SIZES.has(raw.fontSize as AzkarSettings["fontSize"])
      ? (raw.fontSize as AzkarSettings["fontSize"])
      : DEFAULT_AZKAR_SETTINGS.fontSize,
    position: VALID_POSITIONS.has(raw.position as AzkarSettings["position"])
      ? (raw.position as AzkarSettings["position"])
      : DEFAULT_AZKAR_SETTINGS.position,
    frequencyMinutes: typeof raw.frequencyMinutes === "number" && raw.frequencyMinutes > 0
      ? raw.frequencyMinutes
      : DEFAULT_AZKAR_SETTINGS.frequencyMinutes,
    displaySeconds: typeof raw.displaySeconds === "number" && raw.displaySeconds > 0
      ? raw.displaySeconds
      : DEFAULT_AZKAR_SETTINGS.displaySeconds,
    opacity: typeof raw.opacity === "number"
      ? Math.max(0.1, Math.min(1, raw.opacity))
      : DEFAULT_AZKAR_SETTINGS.opacity,
    morningReminderHour: typeof raw.morningReminderHour === "number"
      ? Math.max(0, Math.min(23, raw.morningReminderHour))
      : DEFAULT_AZKAR_SETTINGS.morningReminderHour,
    morningReminderMinute: typeof raw.morningReminderMinute === "number"
      ? Math.max(0, Math.min(59, raw.morningReminderMinute))
      : DEFAULT_AZKAR_SETTINGS.morningReminderMinute,
    eveningReminderHour: typeof raw.eveningReminderHour === "number"
      ? Math.max(0, Math.min(23, raw.eveningReminderHour))
      : DEFAULT_AZKAR_SETTINGS.eveningReminderHour,
    eveningReminderMinute: typeof raw.eveningReminderMinute === "number"
      ? Math.max(0, Math.min(59, raw.eveningReminderMinute))
      : DEFAULT_AZKAR_SETTINGS.eveningReminderMinute,
  };
}

export async function loadAzkarSettings(): Promise<AzkarSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AZKAR_SETTINGS };
    return sanitizeAzkarSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AZKAR_SETTINGS };
  }
}

export async function saveAzkarSettings(
  partial: Partial<AzkarSettings>
): Promise<AzkarSettings> {
  const current = await loadAzkarSettings();
  const updated  = { ...current, ...partial };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// ── Custom azkar CRUD ─────────────────────────────────────────────────────────

export async function loadCustomAzkar(): Promise<Zikr[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_AZKAR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCustomAzkar(azkar: Zikr[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_AZKAR_KEY, JSON.stringify(azkar));
}

export async function addCustomZikr(zikr: Zikr): Promise<Zikr[]> {
  const current = await loadCustomAzkar();
  const updated = [...current, zikr];
  await saveCustomAzkar(updated);
  return updated;
}

export async function deleteCustomZikr(index: number): Promise<Zikr[]> {
  const current = await loadCustomAzkar();
  const updated = current.filter((_, i) => i !== index);
  await saveCustomAzkar(updated);
  return updated;
}

// ── Smart rotation (includes custom azkar) ────────────────────────────────────

async function loadHistory(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveHistory(h: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch { /* ignore */ }
}

export async function pickNextZikr(): Promise<Zikr> {
  const customAzkar = await loadCustomAzkar();
  const allAzkar    = [...AZKAR, ...customAzkar];

  const history  = await loadHistory();
  const excluded = new Set(history.slice(-REPEAT_BUFFER));
  const pool     = allAzkar
    .map((_, i) => i)
    .filter((i) => !excluded.has(i));

  const candidates = pool.length > 0 ? pool : allAzkar.map((_, i) => i);
  const chosen     = candidates[Math.floor(Math.random() * candidates.length)];
  const newHistory = [...history, chosen].slice(-(REPEAT_BUFFER * 3));
  await saveHistory(newHistory);
  return allAzkar[chosen];
}

// ── Soft vibration (opt-in) ───────────────────────────────────────────────────

export function azkarSoftVibrate(): void {
  if (Platform.OS === "web") return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* ignore */ }
}

// ── Background notification scheduling ───────────────────────────────────────

const AZKAR_PREFIX   = "azkar_bg_";
const SCHEDULE_AHEAD = 10;

export async function scheduleAzkarNotifications(
  settings: AzkarSettings
): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelAzkarNotifications();
  if (!settings.enabled || !settings.backgroundNotifications) return;

  const intervalMs = settings.frequencyMinutes * 60 * 1000;
  const now        = Date.now();

  for (let i = 1; i <= SCHEDULE_AHEAD; i++) {
    const zikr   = await pickNextZikr();
    const fireAt = new Date(now + i * intervalMs);

    await Notifications.scheduleNotificationAsync({
      identifier: `${AZKAR_PREFIX}${i}`,
      content: {
        title: "🤲 ذكر",
        body:  `${zikr.arabic}\n${zikr.transliteration}`,
        data:  { type: "azkar" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    }).catch(() => {});
  }
}

export async function cancelAzkarNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier.startsWith(AZKAR_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch { /* ignore */ }
}

// ── Daily Reminder Notifications ──────────────────────────────────────────────

const REMINDER_MORNING_ID = "azkar_reminder_morning";
const REMINDER_EVENING_ID = "azkar_reminder_evening";

export async function scheduleDailyReminders(
  settings: AzkarSettings
): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelDailyReminders();

  if (settings.morningReminderEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_MORNING_ID,
      content: {
        title: "ورد الصباح 🌤️",
        body: "حان وقت أذكار الصباح",
        data: { route: "/azkar-morning", type: "daily_reminder" },
        sound: undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.morningReminderHour,
        minute: settings.morningReminderMinute,
      },
    }).catch(() => {});
  }

  if (settings.eveningReminderEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_EVENING_ID,
      content: {
        title: "ورد المساء 🌙",
        body: "حان وقت أذكار المساء",
        data: { route: "/azkar-evening", type: "daily_reminder" },
        sound: undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.eveningReminderHour,
        minute: settings.eveningReminderMinute,
      },
    }).catch(() => {});
  }
}

export async function cancelDailyReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_MORNING_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(REMINDER_EVENING_ID).catch(() => {});
  } catch { /* ignore */ }
}
