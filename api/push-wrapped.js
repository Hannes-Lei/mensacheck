// ============================================================================
// Schmausi – Push „Dein <Monat>-Wrapped ist da!“
// ----------------------------------------------------------------------------
// Wird am Erscheinungstag um 11 Uhr von der Datenbank aufgerufen (Zeitplan in
// supabase/20_wrapped_push.sql) und zur Sicherheit auch von der App, sobald
// jemand sie an dem Tag öffnet.
// Darf jeder aufrufen: es passiert nur am Erscheinungstag ab 11 Uhr etwas, und
// jede Person bekommt die Nachricht höchstens einmal pro Monat.
// Bekommt jeder, der Push-Nachrichten eingeschaltet hat und im Monat etwas
// bewertet hat – lässt sich nicht einzeln abschalten (Überraschung, Hannes 26.11.).
// ============================================================================
import { pushReady, rpc, sendQueued } from "./_push.js";
import { berlinNow, currentMonthWrapped } from "./_wrapped.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!pushReady()) return res.status(200).json({ hinweis: "Push ist noch nicht eingerichtet." });

  const now = berlinNow();
  const w = currentMonthWrapped(now);
  if (!w.releasedToday) return res.status(200).json({ ...now, hinweis: "Heute erscheint kein Wrapped (oder noch vor 11 Uhr)." });

  try {
    const queued = await rpc("push_queue_wrapped", {
      p_ref: w.key,
      p_title: `🎁 Dein ${w.label}-Wrapped ist da!`,
      p_body: "Dein Mensa-Monat bei Schmausi – tippe und schau rein.",
      p_start: w.start,
      p_end: w.end,
    });
    const result = await sendQueued();
    return res.status(200).json({ ...now, monat: w.label, queued, ...result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ fehler: e.message });
  }
}
