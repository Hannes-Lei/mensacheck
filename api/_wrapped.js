// ============================================================================
// Schmausi Wrapped – WANN erscheint das Monats-Wrapped?
// ----------------------------------------------------------------------------
// Wird von der App (src/Wrapped.jsx) UND vom Server (api/push-wrapped.js)
// benutzt, damit beide immer denselben Tag ausrechnen.
// Dateien mit _ am Anfang sind in Vercel keine eigene Adresse.
//
// Regel (Hannes, 26.11.): am VORLETZTEN Mensatag des Monats um 11 Uhr.
// So bleibt Zeit, sich mit Freunden auszutauschen, bevor Wochenende oder
// Ferien dazwischenkommen. Was am letzten Mensatag noch bewertet wird, zählt
// automatisch mit (der Rückblick geht immer bis Monatsende).
// Mensatag = Montag–Freitag, kein Feiertag in Sachsen, keine Mensa-Pause.
// ============================================================================

export const WRAPPED_HOUR = 11; // Uhrzeit (deutsche Zeit), ab der es da ist

// Mensa-Pausen (z.B. Weihnachten) von–bis – bei Bedarf jedes Jahr ergänzen:
export const MENSA_PAUSEN = [
  ["2026-12-19", "2027-01-03"],
];

export const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Jetzt in deutscher Zeit: { date: "2026-11-27", hour: 11 }
export function berlinNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

// Feiertage in Sachsen (Ostern wird ausgerechnet)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}
const holidayCache = {};
function holidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  const e = easter(y), D = 86400000;
  const nov22 = new Date(Date.UTC(y, 10, 22));
  const bussUndBettag = Date.UTC(y, 10, 22 - ((nov22.getUTCDay() + 4) % 7)); // Mittwoch vor dem 23.11.
  return (holidayCache[y] = new Set([
    iso(y, 0, 1), day(e - 2 * D), day(e + D), iso(y, 4, 1), day(e + 39 * D), day(e + 50 * D),
    iso(y, 9, 3), iso(y, 9, 31), day(bussUndBettag), iso(y, 11, 24), iso(y, 11, 25), iso(y, 11, 26), iso(y, 11, 31),
  ]));
}
export function isMensaDay(d) {
  const wd = new Date(d + "T12:00:00Z").getUTCDay();
  if (wd === 0 || wd === 6) return false;
  if (holidays(Number(d.slice(0, 4))).has(d)) return false;
  return !MENSA_PAUSEN.some(([from, to]) => d >= from && d <= to);
}

// Erscheinungstag für Monat m (0 = Januar): vorletzter Mensatag, sonst letzter Tag
export function wrappedReleaseDay(y, m) {
  const days = [];
  for (let d = 1; d <= lastDay(y, m); d++) if (isMensaDay(iso(y, m, d))) days.push(iso(y, m, d));
  return days.length >= 2 ? days[days.length - 2] : days[0] || iso(y, m, lastDay(y, m));
}

// Das Monats-Wrapped, das gerade gilt:
//   ab dem Erscheinungstag (11 Uhr) der laufende Monat (early = wird bis Monatsende ergänzt),
//   vorher der letzte Monat.
// releasedToday = heute ist der Erscheinungstag und es ist schon 11 Uhr
export function currentMonthWrapped({ date, hour } = berlinNow()) {
  const [y, mo] = date.split("-").map(Number); const m = mo - 1;
  const release = wrappedReleaseDay(y, m);
  const early = date > release || (date === release && hour >= WRAPPED_HOUR);
  const month = (yy, mm) => ({ key: `${yy}-${mm}`, label: MONTHS[mm], short: "Monat", start: iso(yy, mm, 1), end: iso(yy, mm, lastDay(yy, mm)) });
  if (early) return { ...month(y, m), early: true, releasedToday: date === release };
  return month(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1);
}
