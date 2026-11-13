// ============================================================================
// Schmausi – alles rund um Gerichte an EINER Stelle
// ----------------------------------------------------------------------------
// Diese Datei benutzen der Server (api/mensa.js) UND die App (src/helpers.js).
// Früher gab es dieselben Regeln dreimal (Server, App, Datenbank) – mit kleinen
// Unterschieden. Daher kamen doppelte Gerichte. Jetzt gilt:
//   • dishText / dishKey   – wann zwei Namen dasselbe Gericht sind
//                            (die Datenbank hat exakt dieselbe Regel in
//                             dish_text / dish_key, siehe supabase/19_….sql)
//   • similarName          – „fast gleicher“ Name (Umbenennung, Tippfehler)
//   • nameMeat / classify  – vegan, vegetarisch, Fleisch oder Fisch?
//   • cleanMeal            – einen Eintrag von OpenMensa aufräumen
//   • buildDay             – aus Plan + gemerkten Gerichten die Liste eines Tages
// Dateien mit _ am Anfang sind in Vercel keine eigene Adresse.
// ============================================================================

// ---- 1) Namen vergleichen ---------------------------------------------------
// Umlaute und Akzente ausschreiben, damit „Hähnchen“ = „Haehnchen“ und
// „Café“ = „Cafe“. MUSS zu dish_text() in der Datenbank passen.
const LETTERS = {
  "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
  "é": "e", "è": "e", "ê": "e", "ë": "e", "à": "a", "â": "a", "á": "a",
  "í": "i", "ì": "i", "î": "i", "ó": "o", "ò": "o", "ô": "o",
  "ú": "u", "ù": "u", "û": "u", "ç": "c", "ñ": "n",
};
// Satzzeichen, Anführungszeichen, Bindestriche, Schrägstriche und alle Arten
// von Leerzeichen zählen beim Vergleich nicht (werden zu einem Leerzeichen).
const SEPARATORS = /["„“”‚‘’'`´.,;:!?()\[\]{}\\|*#~<>=_·•…®™°^%§$€\-–—\/\t\n\r   ​ ]+/g;
// Kleine Verbindungswörter: am Ende zählen sie nie („… mit“), im Schlüssel gar nicht
const FILLER = new Set(["auf", "mit", "an", "und", "dazu", "in", "im", "vom", "von", "aus", "zu", "nach", "sowie", "oder", "am", "zum", "zur"]);

// Vergleichsform mit Leerzeichen: „Pilz-Gemüsepfanne  mit Reis,“ -> „pilz gemuesepfanne mit reis“
export function dishText(name) {
  const words = String(name || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[äöüßéèêëàâáíìîóòôúùûçñ]/g, (c) => LETTERS[c])
    .replace(/[&+]/g, " und ")
    .replace(SEPARATORS, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  while (words.length > 1 && FILLER.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

// Schlüssel eines Gerichts: ohne Verbindungswörter und ohne Leerzeichen.
// „Pilz Gemüse-Pfanne mit Reis“ = „Pilz Gemüsepfanne & Reis“ = „pilzgemuesepfannereis“
export function dishKey(name) {
  const text = dishText(name);
  const key = text.split(" ").filter((w) => !FILLER.has(w)).join("");
  return key || text.replace(/ /g, "");
}

const contentWords = (name) => dishText(name).split(" ").filter((w) => w && !FILLER.has(w));

// Tippfehler-Abstand zweier Wörter (wie viele Buchstaben muss man ändern?)
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Gelten zwei Wörter als dasselbe? gleich · nur andere Endung (Soße/Soßen) ·
// kleiner Tippfehler (Tomatensosse/Tomatensauce, Hähnchen/Hänchen)
function wordMatch(x, y) {
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  if (s.length >= 4 && l.startsWith(s) && l.length - s.length <= 3) return true;
  if (s.length >= 5 && editDistance(s, l) <= (s.length >= 9 ? 2 : 1)) return true;
  return false;
}

// Fast gleicher Name? Alle Wörter des einen Namens stecken im anderen, der
// andere hat höchstens 2 Wörter mehr, mindestens 2 Wörter stimmen überein.
//   „Quarkkeulchen mit Apfelmus“ ~ „sächsische Quarkkeulchen mit Apfelmus“
// Zusammen- oder auseinandergeschrieben ist egal („Gemüse Pfanne“ = „Gemüsepfanne“).
function covers(A, B) {
  const used = new Set();
  let units = 0;
  for (let i = 0; i < A.length; i++) {
    const x = A[i];
    let j = B.findIndex((y, k) => !used.has(k) && wordMatch(x, y));
    if (j >= 0) { used.add(j); units++; continue; }
    // A getrennt, B zusammen: „gemuese“ + „pfanne“ = „gemuesepfanne“
    if (i + 1 < A.length) {
      j = B.findIndex((y, k) => !used.has(k) && wordMatch(x + A[i + 1], y));
      if (j >= 0) { used.add(j); units++; i++; continue; }
    }
    // A zusammen, B getrennt
    j = B.findIndex((y, k) => k + 1 < B.length && !used.has(k) && !used.has(k + 1) && wordMatch(x, y + B[k + 1]));
    if (j >= 0) { used.add(j); used.add(j + 1); units++; continue; }
    return false;
  }
  return units >= 2 && B.length - used.size <= 2;
}
export function similarName(a, b) {
  const A = contentWords(a), B = contentWords(b);
  if (A.length < 2 || B.length < 2) return false;
  return covers(A, B) || covers(B, A);
}

// ---- 2) Fleisch, Fisch oder ohne? (nur aus dem Namen) ------------------------
// Wird gebraucht, wo es keine verlässliche Angabe vom Studentenwerk gibt:
// Pasta-/Pizza-Theke, Wok-Toppings, ältere Bewertungen.
// Alle Wörter stehen in der Vergleichsform (ä -> ae, ß -> ss …).

// Tiere: immer Fleisch/Fisch – außer ein „vegan“ o.Ä. steht direkt davor
const FISH = /fisch|lachs|scholle|kabeljau|forelle|hering|matjes|zander|pangasius|barsch|dorsch|sardelle|garnele|shrimp|scampi|krabbe|calamari|meeresfruecht|surimi|^tonno$|^muscheln?$/;
const ANIMAL = /schwein|^rind(?!e$|en$)|rinder|rindfleisch|kalb|^lamm|lammfleisch|haehnchen|huehn|huhn|chicken|^pute|puten|truthahn|^enten?|(knusper|bauern|barbarie|peking|flug|brat)ente$|^gans$|^gaense|gefluegel|kaninchen|hirsch|^reh|wild(schwein|gulasch|braten|ragout|fleisch|bret|brat|klops|frika|burger|hack|medaillon|keule|ruecken)|^wild$/;
// Zubereitungen: meist Fleisch – außer sie sind erkennbar aus Gemüse/Ersatz
// („Gemüseschnitzel“, „Linsen-Bolognese“, „Bolognese aus Tofu“, „Sojageschnetzeltes“)
const FORM = /fleisch|hack|schnitzel|frikadelle|frikassee|bulette|boulette|bolognese|carbonara|wurst|wuerst|gulasch|geschnetzeltes|steak(?!house)|gyros|doener|kebab|kebap|(^|[^e])braten|roulade|klops|koettbullar|cevapcici|bifteki|souvlaki|schaschlik|soljanka|schinken|speck|bacon|salami|chorizo|kassler|kasseler|leberkaese|^leber|nugget|haxe|eisbein|kotelett|rippchen|medaillon|tafelspitz|suelze|cordon|hamburger|cheeseburger|^mett|^carne$|prosciutto|^hawaii|diavol|capricciosa|^pollo$|^salame$/;
// stark = macht das ganze Gericht fleischlos („Tofu Bolognese“, „Soja-Gyros“)
const STRONG_SUBSTITUTE = /tofu|soja|seitan|tempeh|lupine|jackfruit|ersatz|vegan|vegetar|veggie|planted|pflanz|fleischlos|fleischfrei|^like$/;
// schwach = nur im selben Wort oder direkt davor („Gemüseschnitzel“, „Brokkoli Nuggets“)
const SUBSTITUTE = /tofu|soja|seitan|tempeh|lupine|jackfruit|sonnenblumen|erbsen|linsen|kichererbsen|bohnen|gemuese|pilz|champignon|kuerbis|sellerie|kohlrabi|blumenkohl|brokkoli|zucchini|aubergine|moehren|karotten|kartoffel|gruenkern|dinkel|hafer|getreide|quinoa|hirse|nuss|ersatz|vegan|vegetar|veggie|planted|pflanz|fleischlos|fleischfrei/;
const VEG_MARKER = /^(vegan|vegetar|veggie|planted|pflanzlich|like|no|kein|ohne|sin|fleischlos)/;

// Ergebnis: "fisch", "fleisch" oder null (kein Fleisch im Namen erkennbar)
export function nameMeat(name) {
  // Bindestriche trennen hier nicht: „Gemüse-Schnitzel“ bleibt ein Wort
  const raw = String(name || "").normalize("NFC").toLowerCase().replace(/[äöüßéèêëàâáíìîóòôúùûçñ]/g, (c) => LETTERS[c]);
  const groups = raw.replace(/[-–—]/g, "\u0001").replace(SEPARATORS, " ").trim().split(" ").filter(Boolean);
  const plain = groups.map((g) => g.replace(/\u0001/g, ""));
  const endsVegan = plain.length > 0 && /^(vegan|vegetarisch|veggie)/.test(plain[plain.length - 1]);
  let found = null;
  for (let i = 0; i < groups.length; i++) {
    const group = plain[i];
    const parts = groups[i].split("\u0001").filter(Boolean);
    const isFish = parts.some((p) => FISH.test(p));
    const isAnimal = isFish || parts.some((p) => ANIMAL.test(p));
    const isForm = FORM.test(group) && !/^gehackt/.test(group);
    if (!isAnimal && !isForm) continue;
    // „vegane Currywurst“, „Like Chicken“, „… , vegan“
    if ([plain[i - 1], plain[i - 2]].some((g) => g && VEG_MARKER.test(g)) || endsVegan) continue;
    if (!isAnimal) {
      if (plain.slice(0, i).some((g) => STRONG_SUBSTITUTE.test(g))) continue; // „Tofu Bolognese“, „Sojageschnetzeltes Gyros Art“
      if (SUBSTITUTE.test(group)) continue;                             // „Gemüseschnitzel“, „Linsen-Bolognese“
      if (plain[i - 1] && SUBSTITUTE.test(plain[i - 1]) && !ANIMAL.test(plain[i - 1]) && !FISH.test(plain[i - 1])) continue; // „Brokkoli Knuspernuggets“
      // „Bolognese aus Sonnenblumenhack“, „Frikadelle von Erbsen“
      const k = [plain[i + 1], plain[i + 2]].findIndex((g) => g === "aus" || g === "von" || g === "vom");
      const from = k >= 0 ? plain[i + k + 2] : null;
      if (from && SUBSTITUTE.test(from) && !ANIMAL.test(from) && !FISH.test(from)) continue;
    }
    if (!isFish) return "fleisch";
    found = "fisch";
  }
  return found;
}

// Wok-Topping: veggie oder mit Fleisch? „(vegetarisch)“/„(vegan)“ zählt immer.
export function toppingIsVeg(text) {
  return /\((vegetarisch|vegan)\)/i.test(text || "") || !nameMeat(text);
}
export function toppingLabel(text) {
  return String(text || "").replace(/\s*\((vegetarisch|vegan)\)\s*/gi, " ").replace(/\s+/g, " ").trim();
}

// ---- 3) Einen Eintrag von OpenMensa aufräumen --------------------------------
// OpenMensa wirft in "notes" Beilagen, Allergene, Zusatzstoffe und Kennzeichen
// (Vegan, Schwein …) zusammen. Diese Listen helfen beim Sortieren.
const ALLERGENS = [
  "glutenhaltiges Getreide", "Weizen", "Roggen", "Gerste", "Hafer", "Dinkel",
  "Milch/ Milchzucker", "Eier", "Soja", "Sellerie", "Senf", "Sesam", "Fisch",
  "Erdnüsse", "Schalenfrüchte/ Nüsse", "Mandeln", "Haselnüsse", "Walnüsse",
  "Cashewnüsse", "Pistazien", "Lupine", "Krebstiere", "Weichtiere",
  "Sulfit/ Schwefeldioxid",
].map((x) => x.toLowerCase());
const ADDITIVES = [
  "farbstoff", "konservierungsstoff", "antioxidationsmittel", "phosphat",
  "geschmacksverstärker", "süßungsmittel", "koffeinhaltig", "chininhaltig",
  "geschwefelt", "geschwärzt", "gewachst",
];
const MEAT_LABELS = { schwein: "fleisch", rind: "fleisch", "geflügel": "fleisch", lamm: "fleisch", wild: "fleisch", insekten: "fleisch", fisch: "fisch" };

// Kategorien, die keine Hauptgerichte sind (werden in der App einklappbar).
const EXTRA_CATEGORY = /beilage|smoothie|dessert|salat|getränk|obst/i;
// An diesen Theken gibt es mehrere Sorten (Soßen, Pizzen). OpenMensa trägt die
// Kennzeichen dort oft für ALLE Sorten gleich ein – z.B. „Vegan“ und „Schwein“
// zugleich. Dort zählt deshalb zuerst der Name der Sorte.
const SHARED_COUNTER = /pasta|pizza/i;
const WOK = /wok/i;

// Am Pastateller listet das Studentenwerk auch Nudelsorte und Käse als eigene
// "Gerichte" (Spirelli, Geriebener Gouda, Pizzaschmelz). Wir zeigen nur die Soßen.
const PASTA_EXTRA =
  /^(vollkorn-?)?(spirelli|spaghetti|penne|fusilli|farfalle|tagliatelle|makkaroni|maccheroni|rigatoni|tortiglioni|linguine|conchiglie|nudeln|bandnudeln|hörnchen\w*|gnocchi)\b|gouda|parmesan|hartkäse|reibekäse|bergkäse|emmentaler|pizzaschmelz/i;
const SAUCE_HINT = /soße|sosse|sauce|sugo|pesto|bolognese|carbonara|gulasch|ragout|ragù|würzfleisch|\smit\s/i;
export function isPastaExtra(category, name) {
  return /pasta/i.test(category || "") && PASTA_EXTRA.test(name || "") && !SAUCE_HINT.test(name || "");
}
// Platzhalter ohne echtes Gericht ("Pastateller nach Angebot") zeigen wir nicht
const PLACEHOLDER = /nach angebot|laut aushang|siehe aushang|wechselnde[sn]? angebot/i;
export function isPlaceholderMeal(name) {
  return PLACEHOLDER.test(name || "");
}

const tidy = (s) => String(s || "").replace(/[\s   ​]+/g, " ").trim();

// Liste ohne Wiederholungen – auch wenn sich Einträge nur in Leerzeichen,
// Bindestrichen oder Groß/Klein unterscheiden. Der erste Eintrag bleibt.
export function uniqueByKey(list) {
  const at = new Map();
  const out = [];
  for (const x of list || []) {
    const text = tidy(x);
    if (!text) continue;
    const key = dishKey(toppingLabel(text)) || text.toLowerCase();
    if (!at.has(key)) { at.set(key, out.length); out.push(text); continue; }
    // gleiche Beilage nochmal: die Schreibweise mit „(vegetarisch)“/„(vegan)“ behalten
    if (/\((vegetarisch|vegan)\)/i.test(text) && !/\((vegetarisch|vegan)\)/i.test(out[at.get(key)])) out[at.get(key)] = text;
  }
  return out;
}

// vegan · vegetarisch · fleisch · fisch · null (unbekannt – lieber kein Etikett als ein falsches)
export function classify({ name, category, hasVegan, hasVegetarian, meatLabel }) {
  const cat = (category || "").toLowerCase();
  const fromName = nameMeat(name);
  const veganName = /(^|[\s,(])vegan/i.test(name || "");
  const veggieName = /vegetarisch|veggie/i.test(name || "");

  if (SHARED_COUNTER.test(cat)) {
    // Pasta/Pizza: erst der Name der Sorte, dann die Angaben – aber nur, wenn
    // sie sich nicht widersprechen (Fleisch UND vegetarisch = gilt für die Theke)
    if (fromName) return fromName;
    if (veganName) return "vegan";
    if (!meatLabel && hasVegan && !hasVegetarian) return "vegan";
    // Die Angaben gelten dort für die ganze Theke („Rind“ UND „Vegetarisch“).
    // Fleischsoßen nennen das Fleisch im Namen – steht keins drin, ist die Sorte vegetarisch.
    if (hasVegan || hasVegetarian || veggieName) return "vegetarisch";
    return null;
  }
  // 1. Die Kategorie des Studentenwerks ist die verlässlichste Angabe
  if (cat.includes("vegan")) return "vegan";
  if (cat.includes("vegetar")) return hasVegan && !meatLabel ? "vegan" : "vegetarisch";
  if (cat.includes("fisch")) return "fisch";
  if (cat.includes("fleisch") && !/fleischlos|fleischfrei/.test(cat)) return "fleisch";
  // 2. Kennzeichen am Gericht (Schwein, Rind, Geflügel, Fisch · Vegan · Vegetarisch)
  if (meatLabel) return meatLabel;
  if (hasVegan) return "vegan";
  if (hasVegetarian) return "vegetarisch";
  // 3. Sonst der Name
  if (fromName) return fromName;
  if (veganName) return "vegan";
  if (veggieName) return "vegetarisch";
  // Der Wok ohne Topping ist immer vegetarisch (Fleisch gibt es nur als Topping)
  if (WOK.test(cat)) return "vegetarisch";
  return null;
}

export function cleanMeal(meal) {
  const sides = [];
  const allergens = [];
  let hasVegan = false, hasVegetarian = false, meatLabel = null;

  for (const note of meal.notes || []) {
    const n = tidy(note);
    const l = n.toLowerCase();
    if (!n) continue;
    if (l.includes("alkohol")) {
      allergens.push("Alkohol"); // wichtig für manche (Schwangere, Religion) – bei den Allergenen zeigen
    } else if (ADDITIVES.some((a) => l.includes(a))) {
      // andere Zusatzstoffe ("enthält Farbstoff") weglassen, sind keine Beilage
    } else if (ALLERGENS.includes(l)) {
      allergens.push(n);
      if (l === "fisch" || l === "krebstiere" || l === "weichtiere") meatLabel = meatLabel || "fisch";
    } else if (MEAT_LABELS[l]) {
      if (MEAT_LABELS[l] === "fleisch" || !meatLabel) meatLabel = MEAT_LABELS[l];
    } else if (l === "vegan") {
      hasVegan = true;
    } else if (l === "vegetarisch" || l === "fleischlos") {
      hasVegetarian = true;
    } else {
      sides.push(n); // alles andere sind Beilagen wie "Dillsoße" oder "Reis"
    }
  }

  const name = tidy(meal.name);
  const category = tidy(meal.category);
  const kind = classify({ name, category, hasVegan, hasVegetarian, meatLabel });

  return {
    id: meal.id,
    name,
    category,
    price: meal.prices?.students ?? null,
    sides: uniqueByKey(sides),
    allergens: [...new Set(allergens)],
    kind,
    diet: kind === "vegan" || kind === "vegetarisch" ? kind : null,
    isMain: !EXTRA_CATEGORY.test(category),
  };
}

// Mehrere Einträge desselben Gerichts zu einem zusammenfassen. "main" gibt Namen,
// Kategorie und Beilagen vor.
// Wok: Es gibt ihn ohne Topping (günstiger Eintrag) und mit Topping (teurerer
// Eintrag, die Toppings stehen dort als Beilagen). Gibt es nur einen Preis,
// gibt es keine Topping-Auswahl (die Beilagen bleiben Beilagen).
function mergeGroup(pool, main) {
  const prices = pool.map((e) => e.price).filter((p) => p != null).map(Number);
  const meal = {
    name: main.name,
    category: main.category || "",
    price: prices.length ? Math.min(...prices) : null,
    sides: uniqueByKey(main.sides),
    allergens: [...new Set(pool.flatMap((e) => e.allergens || []))],
    kind: main.kind ?? null,
    isMain: main.isMain ?? true,
  };
  if (WOK.test(meal.category)) {
    const tops = pool.map((e) => e.toppingPrice ?? e.price).filter((p) => p != null).map(Number);
    const max = tops.length ? Math.max(...tops) : null;
    const explicit = pool.flatMap((e) => (e.toppings || []).map((t) => (typeof t === "string" ? t : t.name)));
    const pricier = meal.price == null ? [] : pool.filter((e) => e.price != null && Number(e.price) > meal.price);
    let toppings = uniqueByKey([...explicit, ...pricier.flatMap((e) => e.sides || [])]);
    let sides = uniqueByKey(pool.filter((e) => !pricier.includes(e)).flatMap((e) => e.sides || []));
    let topMax = max;
    if (toppings.length === 0) {
      // Der Eintrag mit Topping steht nicht mehr auf dem Plan: die Toppings von
      // vorhin behalten (wer mittags eins hatte, soll es noch auswählen können)
      toppings = uniqueByKey(pool.flatMap((e) => e.storedToppings || []));
      const old = pool.map((e) => e.storedToppingPrice).filter((p) => p != null).map(Number);
      if (toppings.length && old.length) topMax = Math.max(...old);
    }
    const keys = new Set(toppings.map((t) => dishKey(toppingLabel(t))));
    meal.sides = sides.filter((x) => !keys.has(dishKey(toppingLabel(x))));
    meal.toppings = toppings;
    meal.toppingPrice = toppings.length && topMax != null && meal.price != null && topMax > meal.price ? topMax : null;
    // ohne Topping: vegan nur, wenn ein Eintrag das sagt – sonst vegetarisch
    meal.kind = pool.some((e) => e.kind === "vegan") ? "vegan" : "vegetarisch";
  }
  return meal;
}

// Für die Datenbank: je Name genau ein Eintrag (der Wok steht oft zweimal mit
// demselben Namen auf dem Plan – ohne und mit Topping)
export function combineSameName(meals) {
  const groups = new Map();
  for (const m of meals || []) {
    if (!m?.name || isPlaceholderMeal(m.name) || isPastaExtra(m.category, m.name)) continue;
    if (!groups.has(m.name)) groups.set(m.name, []);
    groups.get(m.name).push(m);
  }
  return [...groups.values()].map((pool) => mergeGroup(pool, pool[0]));
}

// ---- 4) Die Liste eines Tages bauen ------------------------------------------
// Eingabe: Einträge mit { name, category, price, sides, allergens, kind, isMain,
//   current    – steht gerade auf dem Plan
//   order      – Position auf dem Plan
//   firstSeen / lastSeen – wann zum ersten/letzten Mal auf dem Plan gesehen (ms)
//   mergedInto – in der Datenbank schon mit diesem Namen zusammengelegt }
// Zusammengelegt wird:
//   1. gleicher Schlüssel (nur die Schreibweise ist anders)
//   2. Wok mit fast gleichem Namen (ohne / mit Topping)
//   3. fast gleicher Name in derselben Kategorie, wenn die beiden NIE gleichzeitig
//      auf dem Plan standen (= das Studentenwerk hat umbenannt). Standen beide
//      gleichzeitig da (z.B. zwei Soßen am Pastateller), bleiben es zwei Gerichte.
//   4. was in der Datenbank schon zusammengelegt wurde (mergedInto)
// Ergebnis: { meals, merges } – merges = [{ from, to }]: Der Server hält sie in
// der Datenbank fest, Bewertungen wandern dann zum Namen, der gilt.
export function buildDay(entries) {
  const list = entries.filter((e) => e && e.name && !isPlaceholderMeal(e.name) && !isPastaExtra(e.category, e.name));
  const parent = list.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { parent[find(a)] = find(b); };

  const keys = list.map((e) => dishKey(e.name));
  const before = (a, b) => a.lastSeen != null && b.firstSeen != null && a.lastSeen < b.firstSeen;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (keys[i] === keys[j]) { union(i, j); continue; }
      if (a.mergedInto && dishKey(a.mergedInto) === keys[j]) { union(i, j); continue; }
      if (b.mergedInto && dishKey(b.mergedInto) === keys[i]) { union(i, j); continue; }
      if ((a.category || "").toLowerCase() !== (b.category || "").toLowerCase()) continue;
      if (!similarName(a.name, b.name)) continue;
      if (WOK.test(a.category || "")) { union(i, j); continue; }
      if (!(a.current && b.current) && (before(a, b) || before(b, a))) union(i, j);
    }
  }

  const groups = new Map();
  list.forEach((e, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(e); });

  const meals = [];
  const merges = [];
  for (const members of groups.values()) {
    const live = members.filter((e) => e.current);
    const pool = live.length ? live : members;
    const wok = WOK.test(pool[0].category || "");
    // Welcher Name gilt?
    //  • einer, der gerade auf dem Plan steht (sonst der zuletzt dazugekommene)
    //  • bleibt möglichst der, auf den schon zusammengelegt wurde (kein Hin und Her)
    //  • beim Wok der kürzere (= ohne „… und Topping“)
    const sticky = (e) => (members.some((o) => o !== e && o.mergedInto === e.name) ? 0 : 1);
    const main = [...pool].sort((a, b) =>
      sticky(a) - sticky(b)
      || (wok ? a.name.length - b.name.length : 0)
      || (live.length ? (a.order ?? 0) - (b.order ?? 0) : (b.firstSeen ?? 0) - (a.firstSeen ?? 0))
    )[0];

    const meal = { id: main.id ?? `g-${dishKey(main.name)}`, ...mergeGroup(pool, main) };
    if (meal.toppings) meal.toppings = meal.toppings.map((t) => ({ name: t, label: toppingLabel(t), veg: toppingIsVeg(t) }));
    if (meal.toppingPrice == null) delete meal.toppingPrice;
    meal.diet = meal.kind === "vegan" || meal.kind === "vegetarisch" ? meal.kind : null;
    if (!live.length) meal.gone = true; // steht nicht mehr auf dem Plan (z.B. ausverkauft)
    const aliases = [...new Set(members.map((e) => e.name).filter((n) => n !== main.name))];
    if (aliases.length) meal.aliases = aliases;
    meal.order = Math.min(...pool.map((e) => e.order ?? 9999));
    meal.firstSeen = Math.min(...members.map((e) => e.firstSeen ?? Infinity));
    meals.push(meal);

    for (const name of aliases) {
      const e = members.find((o) => o.name === name);
      if ((e.mergedInto || "") !== main.name) merges.push({ from: name, to: main.name });
    }
    if (main.mergedInto && !merges.some((m) => m.to === main.name)) merges.push({ from: main.mergedInto, to: main.name });
  }

  // Reihenfolge: wie auf dem Plan; was nicht mehr draufsteht, hinter seine Kategorie
  const current = meals.filter((m) => !m.gone).sort((a, b) => a.order - b.order);
  for (const m of meals.filter((x) => x.gone).sort((a, b) => a.firstSeen - b.firstSeen)) {
    let at = -1;
    current.forEach((x, idx) => { if (x.category === m.category) at = idx; });
    if (at >= 0) current.splice(at + 1, 0, m); else current.push(m);
  }
  for (const m of current) { delete m.order; delete m.firstSeen; }
  return { meals: current, merges };
}

// Einen Tag von OpenMensa aufräumen (ohne gemerkte Gerichte) – für kommende Tage
export function cleanDay(day) {
  const entries = (day.meals || []).map((m, i) => ({ ...cleanMeal(m), current: true, order: i }));
  return { date: day.date, closed: !!day.closed, meals: buildDay(entries).meals };
}
