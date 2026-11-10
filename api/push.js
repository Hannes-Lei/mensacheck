// ============================================================================
// Schmausi – /api/push
//   GET   → öffentlicher Push-Schlüssel für die App
//   GET ?schluessel=neu → einmalig ein neues Schlüsselpaar erzeugen
//           (nur solange noch keins in Vercel eingetragen ist)
//   POST  → offene Nachrichten verschicken. Die App ruft das nach einer
//           Reaktion, Antwort oder dem Einchecken auf. Kann nichts Falsches
//           auslösen: Verschickt wird nur, was die Datenbank selbst angelegt hat.
// ============================================================================
import webpush from "web-push";
import crypto from "node:crypto";
import { pushReady, sendQueued } from "./_push.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    if (req.query?.schluessel === "neu") {
      if (process.env.VAPID_PRIVATE_KEY) {
        return res.status(200).send("Es ist schon ein Schlüssel in Vercel eingetragen. Nichts zu tun.");
      }
      const k = webpush.generateVAPIDKeys();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(
        "Neue Push-Schlüssel – in Vercel unter Settings → Environment Variables eintragen,\n" +
        "dann neu deployen. Diese Seite nicht teilen; beim Neuladen kommen andere Schlüssel.\n\n" +
        `VAPID_PUBLIC_KEY\n${k.publicKey}\n\nVAPID_PRIVATE_KEY\n${k.privateKey}\n\n` +
        `CRON_SECRET\n${crypto.randomBytes(24).toString("base64url")}\n`
      );
    }
    return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  }

  if (req.method === "POST") {
    if (!pushReady()) return res.status(200).json({ hinweis: "Push ist noch nicht eingerichtet." });
    try {
      return res.status(200).json(await sendQueued());
    } catch (e) {
      console.error(e);
      return res.status(500).json({ fehler: "Senden fehlgeschlagen" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
