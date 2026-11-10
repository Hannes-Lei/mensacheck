// ============================================================================
// Schmausi – Lieblingsgerichte von heute melden
// Läuft werktags vormittags automatisch (Zeitplan in vercel.json).
// Die Gerichte des Tages hat /api/remember vorher schon gespeichert.
// ============================================================================
import { pushReady, rpc, sendQueued } from "./_push.js";
import { berlinDate } from "./mensa.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Vercel schickt bei Zeitplan-Aufrufen "Bearer <CRON_SECRET>", falls eingerichtet
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ fehler: "nicht erlaubt" });
  if (!pushReady()) return res.status(200).json({ hinweis: "Push ist noch nicht eingerichtet." });

  const date = berlinDate(0);
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  if (weekday === 0 || weekday === 6) return res.status(200).json({ date, hinweis: "Wochenende" });

  try {
    const queued = await rpc("push_queue_favorites");
    const result = await sendQueued();
    return res.status(200).json({ date, queued, ...result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ fehler: e.message });
  }
}
