// ============================================================================
// MensaCheck – Tagesgerichte aller Mensen morgens merken
// ----------------------------------------------------------------------------
// Läuft automatisch über einen Zeitplan von Vercel (siehe vercel.json),
// werktags am Morgen. Holt für ALLE Mensen den heutigen Speiseplan von
// OpenMensa und speichert ihn in der Tabelle menu_items. So bleiben
// Gerichte auch dann sichtbar, wenn sie mittags ausverkauft sind und das
// Studentenwerk sie aus dem Plan nimmt – egal, ob jemand die App geöffnet hat.
//
// Kein geheimer Schlüssel nötig: Die Datenbank erlaubt jedem, die HEUTIGEN
// Gerichte einzutragen (Regel aus 03_tagesgerichte.sql). Doppelte Einträge
// werden einfach übersprungen. Mehrfaches Aufrufen schadet also nicht.
// ============================================================================
import { CANTEENS, cleanDays, berlinDate } from "./mensa.js";

const SUPABASE_URL = "https://onfkgaeupwbxqvowtwgx.supabase.co";
const SUPABASE_KEY = "sb_publishable_yyVMmnrnCxpJN_DkXPmrbA_Y4X1Ah6I"; // öffentlicher Schlüssel (wie in src/supabase.js)

async function rememberCanteen(canteen, date) {
  const r = await fetch(`https://openmensa.org/api/v2/canteens/${canteen.id}/days/${date}/meals`, {
    headers: { Accept: "application/json" },
  });
  if (r.status === 404) return { mensa: canteen.name, gerichte: 0, hinweis: "heute geschlossen" };
  if (!r.ok) throw new Error(`OpenMensa ${r.status}`);
  const [day] = cleanDays([{ date, closed: false, meals: await r.json() }]);

  const rows = new Map();
  for (const m of day.meals) {
    if (rows.has(m.name)) continue;
    rows.set(m.name, {
      canteen_id: canteen.id, meal_date: date, meal_name: m.name.slice(0, 200),
      category: (m.category || "").slice(0, 100), price: m.price, sides: m.sides.slice(0, 30),
      allergens: m.allergens.slice(0, 40), diet: m.diet, is_main: m.isMain,
    });
  }
  if (rows.size === 0) return { mensa: canteen.name, gerichte: 0 };

  const save = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?on_conflict=canteen_id,meal_date,meal_name`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify([...rows.values()]),
  });
  if (!save.ok) throw new Error(`Supabase ${save.status}: ${(await save.text()).slice(0, 200)}`);
  return { mensa: canteen.name, gerichte: rows.size };
}

export default async function handler(req, res) {
  const date = berlinDate(0);
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  if (weekday === 0 || weekday === 6) return res.status(200).json({ date, hinweis: "Wochenende" });

  const results = await Promise.all(
    CANTEENS.map((c) => rememberCanteen(c, date).catch((e) => ({ mensa: c.name, fehler: e.message })))
  );
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ date, results });
}
