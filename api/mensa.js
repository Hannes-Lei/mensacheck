// ============================================================================
// Schmausi – Server-Funktion für die Speisepläne
// ----------------------------------------------------------------------------
// Diese Datei läuft NICHT im Browser, sondern auf den Servern von Vercel.
//
//   /api/mensa              -> Liste aller Leipziger Mensen
//   /api/mensa?canteen=63   -> Speiseplan der Mensa mit der Nummer 63:
//                              letzter Mensatag, heute, kommende Tage
//
// Die eigentliche Arbeit steht in api/_plan.js (holen, merken) und
// api/_dishes.js (aufräumen, doppelte Gerichte, vegan/vegetarisch/Fleisch).
// ============================================================================
import { CANTEENS, loadCanteen } from "./_plan.js";

export { CANTEENS };

export default async function handler(req, res) {
  // Ohne Nummer: nur die Liste der Mensen zurückgeben.
  if (!req.query?.canteen) {
    res.setHeader("Cache-Control", "s-maxage=86400");
    return res.status(200).json({ canteens: CANTEENS });
  }

  // Nur unsere eigenen Mensen erlauben, nichts anderes abfragen.
  const canteen = CANTEENS.find((c) => c.id === Number(req.query.canteen));
  if (!canteen) {
    return res.status(400).json({ error: "Unbekannte Mensa." });
  }

  try {
    const { days, source } = await loadCanteen(canteen);
    // 15 Minuten zwischenspeichern, damit wir OpenMensa nicht überlasten.
    // Kam die Liste nur aus den gemerkten Gerichten (OpenMensa nicht erreichbar),
    // schon nach 1 Minute wieder neu versuchen.
    res.setHeader("Cache-Control", source === "plan" ? "s-maxage=900, stale-while-revalidate=3600" : "s-maxage=60");
    return res.status(200).json({ canteen, days, source, stand: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "Speiseplan gerade nicht erreichbar." });
  }
}
