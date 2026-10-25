// ============================================================================
// Kleine Hilfsfunktionen, die überall in der App gebraucht werden
// ============================================================================

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

// Vergleichsname eines Gerichts: klein, ohne Anführungszeichen, einfache
// Leerzeichen. Muss genau zu dish_key() in Supabase (Skript 05) passen.
export function dishName(mealName) {
  return String(mealName || "")
    .replace(/["„“”'`´]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Schlüssel für ein Gericht über alle Tage hinweg (Favoriten, Ranglisten)
export function dishKey(canteenId, mealName) {
  return `${canteenId}|${dishName(mealName)}`;
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
  if (msg.includes("fetch")) return "Keine Verbindung. Bist du online?";
  return err?.message || "Da ist etwas schiefgelaufen.";
}

// ---- Abzeichen -------------------------------------------------------------
// Werden aus deinen Bewertungen berechnet, nichts davon wird extra gespeichert.
export const BADGES = [
  { id: "first",    icon: "🍽️", name: "Erster Bissen",     text: "Deine erste Bewertung",           metric: "ratings",  goal: 1 },
  { id: "regular",  icon: "🥄", name: "Stammgast",         text: "10 Bewertungen",                  metric: "ratings",  goal: 10 },
  { id: "critic",   icon: "🧐", name: "Mensa-Kritiker",    text: "50 Bewertungen",                  metric: "ratings",  goal: 50 },
  { id: "legend",   icon: "👑", name: "Mensa-Legende",     text: "100 Bewertungen",                 metric: "ratings",  goal: 100 },
  { id: "writer",   icon: "✍️", name: "Wortgewandt",       text: "10 Kommentare",                   metric: "comments", goal: 10 },
  { id: "explorer", icon: "🧭", name: "Leipzig-Entdecker", text: "In 3 verschiedenen Mensen bewertet", metric: "canteens", goal: 3 },
  { id: "allstar",  icon: "🗺️", name: "Mensa-Weltreise",   text: "In 5 verschiedenen Mensen bewertet", metric: "canteens", goal: 5 },
  { id: "loyal",    icon: "📅", name: "Treue Seele",       text: "An 10 verschiedenen Tagen bewertet",  metric: "days",     goal: 10 },
];

export function computeStats(ratings) {
  return {
    ratings: ratings.length,
    comments: ratings.filter((r) => (r.comment || "").trim()).length,
    canteens: new Set(ratings.map((r) => r.canteen_id)).size,
    days: new Set(ratings.map((r) => r.meal_date)).size,
  };
}

// Am Pastateller nur Soßen zeigen, nicht Nudelsorte oder Käse
// (gleiche Regel wie in api/mensa.js)
const PASTA_EXTRA =
  /^(vollkorn-?)?(spirelli|spaghetti|penne|fusilli|farfalle|tagliatelle|makkaroni|maccheroni|rigatoni|tortiglioni|linguine|conchiglie|nudeln|bandnudeln|hörnchen\w*|gnocchi)\b|gouda|parmesan|hartkäse|reibekäse|bergkäse|emmentaler|pizzaschmelz/i;
const SAUCE_HINT = /soße|sosse|sauce|sugo|pesto|bolognese|carbonara|gulasch|ragout|ragù|würzfleisch|\smit\s/i;

export function isPastaExtra(category, name) {
  return /pasta/i.test(category || "") && PASTA_EXTRA.test(name || "") && !SAUCE_HINT.test(name || "");
}

// Platzhalter ohne echtes Gericht ("Pastateller nach Angebot") – gleiche Regel wie in api/mensa.js
const PLACEHOLDER = /nach angebot|laut aushang|siehe aushang|wechselnde[sn]? angebot/i;
export function isPlaceholderMeal(name) {
  return PLACEHOLDER.test(name || "");
}

// Ältere gemerkte Gerichte: "enthält Alkohol" o.Ä. stand dort noch als Beilage.
// Alkohol wandert zu den Allergenen, andere Zusatzstoffe fallen weg.
const ADDITIVE_HINT = /alkohol|farbstoff|konservierung|antioxidation|phosphat|geschmacksverstärker|süßungsmittel|koffein|chinin|geschwefelt|geschwärzt|gewachst/i;
export function cleanSidesAndAllergens(sides = [], allergens = []) {
  const extra = sides.some((x) => /alkohol/i.test(x)) ? ["Alkohol"] : [];
  return {
    sides: sides.filter((x) => !ADDITIVE_HINT.test(x)),
    allergens: [...new Set([...allergens, ...extra])],
  };
}

// Reihenfolge bei "Heute": 0 Fleisch/Fisch · 1 vegan/vegetarisch · 2 Pasta/Pizza · 3 der Rest
const MEAT_WORDS = /fleisch|hack|schwein|rind|kalb|lamm|wild|geflügel|hähnchen|huhn|chicken|pute|ente|schinken|speck|bacon|salami|wurst|würst|chorizo|kassler|leberkäse|frikadelle|bulette|cevapcici|döner|bolognese|fisch|lachs|scholle|kabeljau|forelle|hering|matjes|garnele|shrimp|calamari|muschel|thunfisch|seelachs|schnitzel|gulasch|roulade|braten|steak|geschnetzeltes/i;
const MEAT_SUBST = /tofu|soja|seitan|vegetar|veggie|planted|pflanz|fleischlos|like /i;
export function mealGroup(m) {
  const cat = m.category || "";
  if (/pasta|pizza/i.test(cat)) return 2;
  if (m.diet === "vegan" || m.diet === "vegetarisch" || /vegan|vegetar/i.test(cat)) return 1;
  if (/fleisch|fisch|geflügel/i.test(cat) || (MEAT_WORDS.test(m.name || "") && !MEAT_SUBST.test(m.name || ""))) return 0;
  return 3;
}
