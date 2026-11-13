// ============================================================================
// Schmausi – Tagesgerichte aller Mensen morgens merken
// ----------------------------------------------------------------------------
// Läuft automatisch über einen Zeitplan von Vercel (siehe vercel.json),
// werktags am Morgen. Holt für ALLE Mensen den Speiseplan und merkt die
// heutigen Gerichte in Supabase (Tabelle menu_items). So bleiben Gerichte auch
// dann sichtbar, wenn sie mittags ausverkauft sind und das Studentenwerk sie
// aus dem Plan nimmt – egal, ob jemand die App geöffnet hat.
//
// Braucht den geheimen Schlüssel SUPABASE_SECRET_KEY (Vercel-Einstellungen).
// Ist dort CRON_SECRET eingetragen, darf nur der Zeitplan von Vercel aufrufen.
// ============================================================================
import { CANTEENS, loadCanteen, berlinDate, isWeekend } from "./_plan.js";

// Alle Mensen frisch holen und merken (auch von /api/push-favorites benutzt)
export async function rememberAll() {
  return Promise.all(CANTEENS.map((c) =>
    loadCanteen(c)
      .then((r) => ({ mensa: c.name, gerichte: r.meals, quelle: r.source, gemerkt: r.saved }))
      .catch((e) => ({ mensa: c.name, fehler: e.message }))
  ));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Vercel schickt bei Zeitplan-Aufrufen "Bearer <CRON_SECRET>", falls eingerichtet
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers?.authorization !== `Bearer ${secret}`) return res.status(401).json({ fehler: "nicht erlaubt" });

  const date = berlinDate(0);
  if (isWeekend(date)) return res.status(200).json({ date, hinweis: "Wochenende" });
  return res.status(200).json({ date, results: await rememberAll() });
}
