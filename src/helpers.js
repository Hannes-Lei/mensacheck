// ============================================================================
// Kleine Hilfsfunktionen, die überall in der App gebraucht werden
// ============================================================================
// Alles rund um Gerichtnamen (gleiches Gericht? Fleisch oder nicht?) steht in
// api/_dishes.js – dieselbe Datei benutzt auch der Server, damit App und
// Server nie verschieden rechnen.
import { dishText as sharedText, dishKey as sharedKey, nameMeat, toppingIsVeg, toppingLabel } from "../api/_dishes.js";

// Heutiges Datum in deutscher Zeit als "2026-10-19"
export function todayBerlin() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

// Datum vor X Tagen als "2026-10-12"
export function daysAgo(n) {
  const d = new Date(todayBerlin() + "T12:00:00");
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Samstag oder Sonntag? (dann gibt es keinen Mensatag)
export function isWeekend(iso) {
  const wd = new Date(iso + "T12:00:00Z").getUTCDay();
  return wd === 0 || wd === 6;
}

// Letzter Mensatag vor "today": Di–Fr = gestern, Sa/So/Mo = Freitag.
// Muss zu last_mensa_day() in Supabase (Skript 06) passen.
export function lastMensaDay(today) {
  const d = new Date(today + "T12:00:00Z");
  const wd = d.getUTCDay(); // 0 = So, 1 = Mo, … 6 = Sa
  d.setUTCDate(d.getUTCDate() - (wd === 1 ? 3 : wd === 0 ? 2 : 1));
  return d.toISOString().slice(0, 10);
}

export function formatPrice(p) {
  if (p == null) return null;
  return Number(p).toFixed(2).replace(".", ",") + " €";
}

// Durchschnitt mit einer Nachkommastelle (3,8). Glatte Viertel wie 4,25
// oder 3,75 bleiben genau, damit eine einzelne 4,25 nicht als 4,3 erscheint.
export function formatAvg(n) {
  const v = Number(n);
  const quarter = Number.isInteger(v * 4) && !Number.isInteger(v * 2);
  return v.toFixed(quarter ? 2 : 1).replace(".", ",");
}

export function formatDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("de-DE", {
    weekday: "short", day: "numeric", month: "numeric",
  });
}

export function dayLabel(iso, today) {
  const d = new Date(iso + "T12:00:00");
  const weekday = d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
  const date = d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
  return iso === today ? `Heute · ${date}` : `${weekday} · ${date}`;
}

export function timeAgo(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
}

// Kurzes Datum wie "13.10."
export function shortDate(iso) {
  const [, m, d] = String(iso).split("-");
  return `${Number(d)}.${Number(m)}.`;
}

// Vergleichsform eines Gerichtnamens und Schlüssel eines Gerichts – siehe
// api/_dishes.js (und dish_text / dish_key in Supabase, SQL 19)
export const dishText = sharedText;
export const dishName = sharedKey;

// Schlüssel für ein Gericht über alle Tage hinweg (Favoriten, Ranglisten)
export function dishKey(canteenId, mealName) {
  return `${canteenId}|${dishName(mealName)}`;
}

// Ist das ein Verbindungsproblem (WLAN weg, Funkloch)? Die Browser melden das
// alle anders: "Failed to fetch" (Chrome), "Load failed" (iPhone), "NetworkError" (Firefox)
export function isNetworkError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return /failed to fetch|load failed|networkerror|network request failed|fetch|aborted|timeout|offline/.test(msg)
    || (typeof navigator !== "undefined" && navigator.onLine === false);
}

// Fehlermeldungen von Supabase verständlich machen
export function friendlyError(err) {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("invalid login")) return "E-Mail oder Passwort stimmt nicht.";
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return "Mit dieser E-Mail gibt es schon ein Konto. Melde dich an.";
  if (msg.includes("password") && msg.includes("6")) return "Das Passwort braucht mindestens 6 Zeichen.";
  if (msg.includes("email") && msg.includes("invalid")) return "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (msg.includes("rate limit")) return "Zu viele Versuche. Bitte kurz warten.";
  if (msg.includes("row-level security")) return "Das darfst du (noch) nicht bewerten.";
  if (isNetworkError(err)) return "Keine Verbindung. Versuch es gleich noch einmal.";
  if (err?.code === "23505" || msg.includes("duplicate key")) return "Das gibt es schon.";
  return err?.message || "Da ist etwas schiefgelaufen.";
}

// ---- Abzeichen -------------------------------------------------------------
// Werden aus deinen Bewertungen berechnet, nichts davon wird extra gespeichert.
export const BADGES = [
  { id: "first",    icon: "🍽️", name: "Erster Bissen",     text: "Deine erste Bewertung",              metric: "ratings",   goal: 1 },
  { id: "regular",  icon: "🥄", name: "Stammgast",         text: "10 Bewertungen",                     metric: "ratings",   goal: 10 },
  { id: "explorer", icon: "🧭", name: "Leipzig-Entdecker", text: "In 3 verschiedenen Mensen bewertet", metric: "canteens",  goal: 3 },
  { id: "writer",   icon: "✍️", name: "Wortgewandt",       text: "10 Kommentare",                      metric: "comments",  goal: 10 },
  { id: "loyal",    icon: "📅", name: "Treue Seele",       text: "An 10 verschiedenen Tagen bewertet", metric: "days",      goal: 10 },
  { id: "fullweek", icon: "🗓️", name: "Volle Woche",       text: "Montag bis Freitag in einer Woche",  metric: "fullweeks", goal: 1 },
  { id: "streak",   icon: "🔥", name: "Serientäter",       text: "5 Mensatage am Stück bewertet",      metric: "streak",    goal: 5 },
  { id: "green",    icon: "🥗", name: "Grüner Teller",     text: "10 Gerichte ohne Fleisch",           metric: "meatless",  goal: 10 },
  { id: "pasta",    icon: "🍝", name: "Pasta-Profi",       text: "10 Gerichte vom Pastateller",        metric: "pasta",     goal: 10 },
  { id: "starry",   icon: "🌟", name: "Sternenregen",      text: "10-mal volle 5 Sterne vergeben",     metric: "fivestars", goal: 10 },
  { id: "allstar",  icon: "🗺️", name: "Mensa-Weltreise",   text: "In 5 verschiedenen Mensen bewertet", metric: "canteens",  goal: 5 },
  { id: "complete", icon: "🏆", name: "Leipzig komplett",  text: "In allen 7 Mensen bewertet",         metric: "canteens",  goal: 7 },
  { id: "pasta25",  icon: "🍜", name: "Nudel-Legende",     text: "25 Gerichte vom Pastateller",        metric: "pasta",     goal: 25 },
  { id: "variety",  icon: "🍱", name: "Allesprobierer",    text: "30 verschiedene Gerichte",           metric: "dishes",    goal: 30 },
  { id: "critic",   icon: "🧐", name: "Mensa-Kritiker",    text: "50 Bewertungen",                     metric: "ratings",   goal: 50 },
  { id: "columnist",icon: "📰", name: "Mensa-Kolumnist",   text: "50 Kommentare",                      metric: "comments",  goal: 50 },
  { id: "veteran",  icon: "🎖️", name: "Mensa-Veteran",     text: "An 50 verschiedenen Tagen bewertet", metric: "days",      goal: 50 },
  { id: "legend",   icon: "👑", name: "Mensa-Legende",     text: "100 Bewertungen",                    metric: "ratings",   goal: 100 },
];

// Braucht von jeder Bewertung: canteen_id, meal_date, meal_name, category, stars, comment
export function computeStats(ratings) {
  const dates = [...new Set(ratings.map((r) => r.meal_date).filter(Boolean))].sort();
  const name = (r) => r.meal_name || "";
  return {
    ratings: ratings.length,
    comments: ratings.filter((r) => (r.comment || "").trim()).length,
    canteens: new Set(ratings.map((r) => r.canteen_id)).size,
    days: dates.length,
    dishes: new Set(ratings.map((r) => name(r).trim().toLowerCase()).filter(Boolean)).size,
    meatless: ratings.filter(isMeatless).length,
    pasta: ratings.filter((r) => (r.category ? /pasta/i.test(r.category) : PASTA_DISH.test(name(r)))).length,
    fivestars: ratings.filter((r) => Number(r.stars) >= 5).length,
    streak: longestStreak(dates),
    fullweeks: fullWeeks(dates),
  };
}

// Pasta: Gerichte vom Pastateller (ohne Kategorie: Nudeln im Namen). Pizza zählt nicht.
const PASTA_DISH = /pasta|nudel|spaghetti|penne|fusilli|tagliatelle|makkaroni|maccheroni|rigatoni|lasagne|tortellini|ravioli|gnocchi/i;
const dayNo = (d) => Math.round(Date.parse(d + "T12:00:00Z") / 86400000); // Tage seit 1970
const weekday = (d) => new Date(d + "T12:00:00Z").getUTCDay();             // 0 = Sonntag

// Längste Serie aufeinanderfolgender Mensatage (Freitag → Montag zählt als lückenlos)
function longestStreak(dates) {
  let best = 0, run = 0, prev = null;
  for (const d of dates) {
    if (weekday(d) === 0 || weekday(d) === 6) continue;
    const n = dayNo(d);
    const gap = prev === null ? null : n - prev;
    run = gap === 1 || (gap === 3 && weekday(d) === 1) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  return best;
}

// Wochen, in denen von Montag bis Freitag jeden Tag bewertet wurde
function fullWeeks(dates) {
  const weeks = new Map();
  for (const d of dates) {
    const wd = weekday(d);
    if (wd === 0 || wd === 6) continue;
    const monday = dayNo(d) - (wd - 1);
    weeks.set(monday, (weeks.get(monday) || 0) + 1);
  }
  return [...weeks.values()].filter((n) => n >= 5).length;
}

// Reihenfolge bei "Heute": 0 Fleisch/Fisch · 1 vegan/vegetarisch · 2 Pasta/Pizza · 3 der Rest
// (m.kind kommt vom Server: vegan · vegetarisch · fleisch · fisch · null = unbekannt)
export function mealGroup(m) {
  const cat = m.category || "";
  if (/pasta|pizza/i.test(cat)) return 2;
  if (m.kind === "vegan" || m.kind === "vegetarisch" || m.diet === "vegan" || m.diet === "vegetarisch") return 1;
  if (m.kind === "fleisch" || m.kind === "fisch") return 0;
  if (/vegan|vegetar/i.test(cat)) return 1;
  if (/fleisch|fisch|geflügel/i.test(cat) || nameMeat(m.name)) return 0;
  return 3;
}

// ---- Wok: ohne Topping, mit Fleisch oder veggie? ---------------------------
// Den Wok gibt es ohne Topping (meist 2,50 €) oder mit Topping (meist 3,50 €),
// dabei meist ein Fleisch- und ein veggie Angebot. Beim Bewerten tippt man das
// Topping an; nichts angetippt = ohne Topping (ratings.variant bleibt leer).
// Welche Toppings es gibt, liefert der Server (m.toppings).
export const NO_TOPPING = "ohne Topping"; // nur noch für ältere Bewertungen
export const variantIsVeg = (s) => toppingIsVeg(s);
export const variantLabel = (s) => toppingLabel(s);
export const variantIcon = (s) => (s === NO_TOPPING ? "🍚" : variantIsVeg(s) ? "🥦" : "🍗");
// Gleiches Topping, auch wenn es leicht anders geschrieben ist?
export const sameTopping = (a, b) => !!a && !!b && (a === b || sharedKey(toppingLabel(a)) === sharedKey(toppingLabel(b)));
export function mealVariants(m) {
  if (!/wok/i.test(m?.category || "")) return null;
  // ältere Antworten des Servers hatten die Toppings noch bei den Beilagen
  const list = Array.isArray(m.toppings) ? m.toppings.map((t) => (typeof t === "string" ? t : t.name)) : m.sides || [];
  if (list.length === 0) return null;
  return list.map((x) => ({ value: x, label: variantLabel(x), icon: variantIcon(x) }));
}

export const nameHasMeat = (n) => !!nameMeat(n);

// Ohne Fleisch gegessen? Beim Wok zählt das gewählte Topping (ohne Topping ist
// er vegetarisch), sonst die Kategorie des Studentenwerks, sonst der Name.
export function isMeatless(r) {
  if (r.variant === NO_TOPPING) return true;
  if (r.variant) return variantIsVeg(r.variant);
  const cat = r.category || "";
  if (/vegan|vegetar/i.test(cat)) return true;
  if (/fleisch|fisch/i.test(cat) && !/fleischlos|fleischfrei/i.test(cat)) return false;
  return !!r.meal_name && !nameMeat(r.meal_name);
}
