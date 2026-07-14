function toKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

// Vernal/autumnal equinox approximation, valid for 1980-2099.
function vernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

// nth weekday (0=Sunday) of a given month, e.g. 2nd Monday of January.
function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): number {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function buildBaseHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const add = (month: number, day: number, name: string) => {
    holidays.set(toKey(year, month, day), name);
  };

  add(1, 1, "元日");
  add(1, nthWeekdayOfMonth(year, 1, 1, 2), "成人の日");
  add(2, 11, "建国記念の日");
  if (year >= 2020) add(2, 23, "天皇誕生日");
  add(3, vernalEquinoxDay(year), "春分の日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  add(7, nthWeekdayOfMonth(year, 7, 1, 3), "海の日");
  add(8, 11, "山の日");
  add(9, nthWeekdayOfMonth(year, 9, 1, 3), "敬老の日");
  add(9, autumnalEquinoxDay(year), "秋分の日");
  add(10, nthWeekdayOfMonth(year, 10, 1, 2), "スポーツの日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  return holidays;
}

function computeHolidaysForYear(year: number): Map<string, string> {
  const holidays = buildBaseHolidays(year);

  // 国民の休日: a weekday sandwiched between two holidays becomes a holiday.
  const daysInYear = (y: number) => (((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365);
  for (let d = 1; d <= daysInYear(year); d++) {
    const date = new Date(year, 0, d);
    const key = toKey(year, date.getMonth() + 1, date.getDate());
    if (holidays.has(key) || date.getDay() === 0) continue;

    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const prevKey = toKey(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
    const nextKey = toKey(next.getFullYear(), next.getMonth() + 1, next.getDate());

    if (holidays.has(prevKey) && holidays.has(nextKey)) {
      holidays.set(key, "国民の休日");
    }
  }

  // 振替休日: if a holiday falls on Sunday, the next non-holiday day becomes a holiday.
  const additions = new Map<string, string>();
  for (const [key] of holidays) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getDay() !== 0) continue;

    const substitute = new Date(date);
    do {
      substitute.setDate(substitute.getDate() + 1);
    } while (holidays.has(toKey(substitute.getFullYear(), substitute.getMonth() + 1, substitute.getDate())));

    additions.set(
      toKey(substitute.getFullYear(), substitute.getMonth() + 1, substitute.getDate()),
      "振替休日",
    );
  }
  for (const [key, name] of additions) holidays.set(key, name);

  return holidays;
}

const cache = new Map<number, Map<string, string>>();

function holidaysForYear(year: number): Map<string, string> {
  let cached = cache.get(year);
  if (!cached) {
    cached = computeHolidaysForYear(year);
    cache.set(year, cached);
  }
  return cached;
}

export function isJapaneseHoliday(date: Date): boolean {
  const holidays = holidaysForYear(date.getFullYear());
  return holidays.has(toKey(date.getFullYear(), date.getMonth() + 1, date.getDate()));
}
