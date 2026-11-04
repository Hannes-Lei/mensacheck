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
// Hängende Wörter am Ende („… auf", „… mit,") zählen nicht – gleiche Regel wie
// dish_key in Supabase (SQL 15), sonst passen die Bewertungen nicht zusammen.
const DANGLING = /(?:[\s,;:–-]+(?:auf|mit|an|und|dazu|in|im|vom|von|aus|zu|nach|sowie|oder))*[\s,;:–-]*$/;
// Gerichtname zum Vergleichen: klein, ohne Anführungszeichen, ohne hängende Wörter
export function dishText(mealName) {
  return String(mealName || "")
    .replace(/["„“”'`´]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(DANGLING, "");
}
// Schlüssel eines Gerichts: zusätzlich ohne Leerzeichen und Bindestriche, damit
// „Pilz Gemüsepfanne" und „Pilz Gemüse-Pfanne" dasselbe sind (= dish_key in SQL 17)
export function dishName(mealName) {
  return dishText(mealName).replace(/[\s-]+/g, "");
}

// Fast gleicher Name? Für Gerichte, die das Studentenwerk im Laufe des Tages
// umbenennt („Quarkkeulchen mit Apfelmus" → „sächsische Quarkkeulchen mit Apfelmus").
// Alle Wörter des kürzeren Namens müssen im längeren stecken, höchstens 2 Wörter
// mehr. Wörter mit gleichem Anfang („Tomatensoße"/„Tomatensosse") zählen als gleich.
// Gleiche Regel wie dish_similar in Supabase (SQL 16).
const dishWords = (n) => dishText(n).split(/[\s-]+/).filter(Boolean);
function wordMatch(x, y) {
  if (x === y) return true;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i >= 5 && i >= 0.6 * Math.min(x.length, y.length);
}
export function sameDish(a, b) {
  let A = dishWords(a), B = dishWords(b);
  if (A.length > B.length) [A, B] = [B, A];
  if (!A.every((x) => B.some((y) => wordMatch(x, y)))) return false;
  return A.length >= 2 && B.length - A.length <= 2;
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
const MEAT_SUBST = /tofu|soja|seitan|vegan|vegetar|veggie|planted|pflanz|fleischlos|like /i;
export function mealGroup(m) {
  const cat = m.category || "";
  if (/pasta|pizza/i.test(cat)) return 2;
  if (m.diet === "vegan" || m.diet === "vegetarisch" || /vegan|vegetar/i.test(cat)) return 1;
  if (/fleisch|fisch|geflügel/i.test(cat) || (MEAT_WORDS.test(m.name || "") && !MEAT_SUBST.test(m.name || ""))) return 0;
  return 3;
}

// ---- Wok: ohne Topping, mit Fleisch oder veggie? ---------------------------
// Den Wok gibt es ohne Topping (meist 2,50 €) oder mit Topping (meist 3,50 €),
// dabei meist ein Fleisch- und ein veggie Angebot, z.B. „mit Putengeschnetzeltes …,
// Brokkoli Knuspernuggets (vegetarisch)". Beim Bewerten tippt man das Topping an;
// nichts angetippt = ohne Topping (ratings.variant bleibt leer).
export const NO_TOPPING = "ohne Topping"; // nur noch für ältere Bewertungen
const VEG_MARK = /\((vegetarisch|vegan)\)/i;
export const variantIsVeg = (s) => VEG_MARK.test(s || "") || MEAT_SUBST.test(s || "") || !MEAT_WORDS.test(s || "");
export const variantLabel = (s) => String(s || "").replace(/\s*\((vegetarisch|vegan)\)\s*/gi, " ").trim();
export const variantIcon = (s) => (s === NO_TOPPING ? "🍚" : variantIsVeg(s) ? "🥦" : "🍗");
export function mealVariants(m) {
  if (!/wok/i.test(m?.category || "")) return null;
  const toppings = (m.sides || []).filter((x) => VEG_MARK.test(x) || MEAT_SUBST.test(x) || MEAT_WORDS.test(x));
  if (toppings.length === 0) return null;
  return toppings.map((x) => ({ value: x, label: variantLabel(x), icon: variantIcon(x) }));
}

// Ohne Fleisch gegessen? Wok ohne Topping ist immer vegetarisch, bei einem
// Topping zählt das Topping, sonst der Name.
export function isMeatless(r) {
  if (r.variant === NO_TOPPING) return true;
  if (r.variant) return variantIsVeg(r.variant);
  const n = r.meal_name || "";
  return !!n && (!MEAT_WORDS.test(n) || MEAT_SUBST.test(n));
}
