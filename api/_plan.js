// ============================================================================
// Schmausi – Speiseplan einer Mensa holen, aufräumen und merken
// ----------------------------------------------------------------------------
// Läuft NUR auf dem Server (Vercel). Wird benutzt von
//   /api/mensa          – Speiseplan für die App
//   /api/remember       – morgens alle Mensen merken (Zeitplan)
//   /api/push-favorites – vor den Lieblingsgericht-Nachrichten
//
// Ablauf für eine Mensa:
//   1. Plan von OpenMensa holen (kommende Tage + letzter Mensatag)
//   2. gemerkte Gerichte von heute und vom letzten Mensatag aus Supabase lesen
//   3. beides zusammenführen (api/_dishes.js): doppelte Einträge, umbenannte
//      Gerichte, Wok mit/ohne Topping; was nicht mehr auf dem Plan steht
//      (z.B. ausverkauft), bleibt in der Liste
//   4. in Supabase festhalten, was gerade auf dem Plan steht – das darf nur der
//      Server (geheimer Schlüssel SUPABASE_SECRET_KEY aus den Vercel-Einstellungen)
// Ist OpenMensa nicht erreichbar, kommt die Liste nur aus den gemerkten Gerichten.
// Dateien mit _ am Anfang sind in Vercel keine eigene Adresse.
// ============================================================================
import { cleanMeal, cleanDay, buildDay, classify, combineSameName } from "./_dishes.js";

// Alle Mensen des Studentenwerks Leipzig mit ihrer OpenMensa-Nummer.
// Neue Mensa dazunehmen? Hier eine Zeile ergänzen (und in SQL bei check_in).
export const CANTEENS = [
  { id: 63, name: "Mensa am Park" },
  { id: 64, name: "Mensa Academica" },
  { id: 65, name: "Mensa am Elsterbecken" },
  { id: 67, name: "Mensa am Medizincampus" },
  { id: 68, name: "Mensa Peterssteinweg" },
  { id: 66, name: "Mensa an den Tierkliniken" },
  { id: 69, name: "Mensa Schönauer Straße" },
];

const OPENMENSA = process.env.OPENMENSA_URL || "https://openmensa.org/api/v2";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://onfkgaeupwbxqvowtwgx.supabase.co";
const PUBLIC_KEY = "sb_publishable_yyVMmnrnCxpJN_DkXPmrbA_Y4X1Ah6I"; // öffentlicher Schlüssel (wie in src/supabase.js), reicht zum Lesen

// Datum in deutscher Zeit, verschoben um "offset" Tage, als "2026-10-20"
export function berlinDate(offset = 0) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export const isWeekend = (iso) => [0, 6].includes(new Date(iso + "T12:00:00Z").getUTCDay());
// Der letzte Mensatag vor "today" (zum Nachbewerten): Di–Fr = gestern, Sa/So/Mo = Freitag
export function lastMensaDay(today) {
  const d = new Date(today + "T12:00:00Z");
  const wd = d.getUTCDay(); // 0 = So, 1 = Mo, … 6 = Sa
  d.setUTCDate(d.getUTCDate() - (wd === 1 ? 3 : wd === 0 ? 2 : 1));
  return d.toISOString().slice(0, 10);
}

// ---- OpenMensa (mit Zeitlimit, damit die App nie lange hängt) ----------------
async function openMensa(path) {
  const r = await fetch(`${OPENMENSA}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (r.status === 404) return null; // geschlossen / nichts eingetragen
  if (!r.ok) throw new Error(`OpenMensa antwortet mit Status ${r.status}`);
  return r.json();
}

// ---- Supabase -----------------------------------------------------------------
const secretKey = () => process.env.SUPABASE_SECRET_KEY || "";
function headers(key) {
  const h = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) h.Authorization = `Bearer ${key}`; // alter service_role-Schlüssel
  return h;
}
async function readRows(canteenId, dates) {
  const url = `${SUPABASE_URL}/rest/v1/menu_items?canteen_id=eq.${canteenId}&meal_date=in.(${dates.join(",")})`
    + "&select=meal_date,meal_name,category,price,topping_price,sides,toppings,allergens,diet,kind,is_main,first_seen,last_seen,merged_into&order=first_seen.asc";
  const r = await fetch(url, { headers: headers(secretKey() || PUBLIC_KEY), signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Supabase lesen ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function syncMenu(canteenId, date, rows, merges, touch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sync_menu`, {
    method: "POST", headers: headers(secretKey()), signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ p_canteen: canteenId, p_date: date, p_rows: rows, p_merges: merges, p_touch: touch }),
  });
  if (!r.ok) throw new Error(`Supabase merken ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// Ein gemerkter Eintrag als Gericht (für Einträge, die nicht mehr auf dem Plan stehen)
function fromRow(r) {
  return {
    name: r.meal_name,
    category: r.category || "",
    price: r.price == null ? null : Number(r.price),
    toppingPrice: r.topping_price == null ? null : Number(r.topping_price),
    sides: r.sides || [],
    toppings: r.toppings || [],
    allergens: r.allergens || [],
    kind: r.kind || r.diet || classify({ name: r.meal_name, category: r.category }),
    isMain: r.is_main ?? true,
    current: false,
    stored: true,
    firstSeen: Date.parse(r.first_seen),
    lastSeen: Date.parse(r.last_seen || r.first_seen),
    mergedInto: r.merged_into || null,
  };
}

// Plan eines Tages (schon aufgeräumt) mit den gemerkten Einträgen zusammenführen.
// live = der Tag ist heute (dann gilt: was im Plan steht, steht JETZT auf dem Plan)
function mergeDay(planMeals, rows, now, live) {
  const stored = new Map(rows.map((r) => [r.meal_name, r]));
  const onPlan = new Set();
  const entries = [];
  (planMeals || []).forEach((m, i) => {
    onPlan.add(m.name);
    const r = stored.get(m.name);
    entries.push({
      ...m, current: true, order: i, stored: !!r,
      firstSeen: r ? Date.parse(r.first_seen) : now,
      lastSeen: live || !r ? now : Date.parse(r.last_seen || r.first_seen),
      mergedInto: r?.merged_into || null,
      storedToppings: r?.toppings || [],
      storedToppingPrice: r?.topping_price ?? null,
    });
  });
  for (const r of rows) if (!onPlan.has(r.meal_name)) entries.push(fromRow(r));
  return buildDay(entries);
}

// So wird ein Gericht in Supabase gemerkt (je Name ein Eintrag). Steht beim Wok
// der Eintrag mit Topping nicht mehr auf dem Plan, bleiben die Toppings von vorhin.
function toRows(meals, stored = []) {
  const before = new Map(stored.map((r) => [r.meal_name, r]));
  return combineSameName(meals).map((m) => {
    const old = before.get(m.name);
    const keep = m.toppings && m.toppings.length === 0 && old?.toppings?.length;
    return {
      meal_name: m.name.slice(0, 200), category: (m.category || "").slice(0, 100),
      price: m.price, topping_price: keep ? old.topping_price : m.toppingPrice ?? null,
      sides: (m.sides || []).slice(0, 30), toppings: (keep ? old.toppings : m.toppings || []).slice(0, 30),
      allergens: (m.allergens || []).slice(0, 40),
      diet: m.kind === "vegan" || m.kind === "vegetarisch" ? m.kind : null, kind: m.kind || null, is_main: m.isMain,
    };
  });
}

// Ergebnis: { days, source, saved }
//   source  "plan" = frisch von OpenMensa · "archiv" = OpenMensa nicht erreichbar,
//           Liste stammt aus den gemerkten Gerichten
export async function loadCanteen(canteen, { write = true } = {}) {
  const today = berlinDate(0);
  const prev = lastMensaDay(today);
  const now = Date.now();

  // 1. OpenMensa und gemerkte Gerichte gleichzeitig holen
  const [upcomingRes, prevRes, rowsRes] = await Promise.allSettled([
    openMensa(`/canteens/${canteen.id}/meals`),
    openMensa(`/canteens/${canteen.id}/days/${prev}/meals`),
    readRows(canteen.id, [prev, today]),
  ]);
  const planOk = upcomingRes.status === "fulfilled";
  const rows = rowsRes.status === "fulfilled" ? rowsRes.value || [] : [];
  if (rowsRes.status === "rejected") console.error(String(rowsRes.reason));
  if (!planOk) console.error(`OpenMensa ${canteen.id}: ${upcomingRes.reason}`);
  if (!planOk && rows.length === 0) throw new Error("Speiseplan gerade nicht erreichbar.");

  const upcoming = (planOk && Array.isArray(upcomingRes.value) ? upcomingRes.value : [])
    .filter((d) => d && d.date >= today)
    .map((d) => ({ date: d.date, closed: !!d.closed, meals: (d.meals || []).map(cleanMeal) }));
  const prevMeals = prevRes.status === "fulfilled" && Array.isArray(prevRes.value) ? prevRes.value.map(cleanMeal) : null;
  const todayPlan = upcoming.find((d) => d.date === today && !d.closed) || null;

  // 2. Heute und letzter Mensatag: Plan + gemerkte Gerichte
  const sync = [];
  const dayOf = (date, planMeals, live) => {
    const dayRows = rows.filter((r) => r.meal_date === date);
    if (!planMeals?.length && dayRows.length === 0) return null;
    const { meals, merges } = mergeDay(planMeals, dayRows, now, live);
    // nur merken, was wirklich von OpenMensa kam; am Wochenende gibt es keinen Mensatag
    if (planMeals?.length && !isWeekend(date)) sync.push({ date, rows: toRows(planMeals, dayRows), merges, touch: live });
    else if (merges.length) sync.push({ date, rows: [], merges, touch: false });
    return { date, closed: false, meals };
  };
  // Ist OpenMensa nicht erreichbar, kommt alles aus den gemerkten Gerichten
  const prevDay = dayOf(prev, planOk ? prevMeals : null, false);
  const todayDay = dayOf(today, todayPlan ? todayPlan.meals : null, true);

  // 3. Antwort: letzter Mensatag, heute, kommende Tage
  const days = [];
  if (prevDay) days.push(prevDay);
  if (todayDay) days.push(todayDay);
  for (const d of upcoming) {
    if (d.date === today) { if (!todayDay) days.push({ date: d.date, closed: d.closed, meals: [] }); continue; }
    days.push({ date: d.date, closed: d.closed, meals: d.closed ? [] : buildDay(d.meals.map((m, i) => ({ ...m, current: true, order: i }))).meals });
  }

  // 4. In Supabase festhalten (Fehler dabei stören die Anzeige nicht)
  let saved = false;
  if (write && sync.length) {
    if (!secretKey()) {
      console.error("SUPABASE_SECRET_KEY fehlt in den Vercel-Einstellungen – Gerichte werden nicht gemerkt.");
    } else {
      try {
        for (const s of sync) await syncMenu(canteen.id, s.date, s.rows, s.merges, s.touch);
        saved = true;
      } catch (e) { console.error(String(e)); }
    }
  }
  return { days, source: planOk ? "plan" : "archiv", saved, meals: todayDay?.meals.length || 0 };
}

export { cleanDay };
