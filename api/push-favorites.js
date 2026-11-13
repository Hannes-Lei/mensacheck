// ============================================================================
// Schmausi – Lieblingsgerichte von heute melden
// Läuft werktags vormittags automatisch (Zeitplan in vercel.json).
// Vorher werden alle Speisepläne noch einmal frisch geholt und gemerkt – so
// stimmt die Nachricht auch, wenn sich seit dem Morgen etwas geändert hat.
// ============================================================================
import { pushReady, rpc, sendQueued } from "./_push.js";
import { berlinDate, isWeekend } from "./_plan.js";
import { rememberAll } from "./remember.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Vercel schickt bei Zeitplan-Aufrufen "Bearer <CRON_SECRET>", falls eingerichtet
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ fehler: "nicht erlaubt" });
  if (!pushReady()) return res.status(200).json({ hinweis: "Push ist noch nicht eingerichtet." });

  const date = berlinDate(0);
  if (isWeekend(date)) return res.status(200).json({ date, hinweis: "Wochenende" });

  try {
    await rememberAll().catch((e) => console.error(e));
    const queued = await rpc("push_queue_favorites");
    const result = await sendQueued();
    return res.status(200).json({ date, queued, ...result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ fehler: e.message });
  }
}
