// ============================================================================
// Schmausi – Push-Nachrichten verschicken (gemeinsamer Teil)
// ----------------------------------------------------------------------------
// Die Nachrichten selbst legt die Datenbank an (siehe supabase/18_push.sql).
// Hier werden sie nur abgeholt und an die Handys geschickt.
//
// Braucht drei Einstellungen in Vercel (Settings → Environment Variables),
// die NIE in GitHub stehen dürfen:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  – Push-Schlüsselpaar
//   SUPABASE_SECRET_KEY                  – geheimer Supabase-Schlüssel (sb_secret_…)
// Dateien mit _ am Anfang sind in Vercel keine eigene Adresse.
// ============================================================================
import webpush from "web-push";

const SUPABASE_URL = "https://onfkgaeupwbxqvowtwgx.supabase.co";
const SITE = "https://schmausi.vercel.app";

export function pushReady() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SECRET_KEY);
}

// Datenbank-Funktion mit dem geheimen Schlüssel aufrufen
export async function rpc(name, args = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;   // alter service_role-Schlüssel
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(args) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${name} ${r.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// Alle offenen Nachrichten verschicken
export async function sendQueued() {
  webpush.setVapidDetails(SITE, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const rows = (await rpc("push_take")) || [];
  const gone = [];
  let sent = 0, failed = 0;
  await Promise.all(rows.map(async (m) => {
    try {
      await webpush.sendNotification(
        { endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } },
        JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: `schmausi-${m.id}` }),
        { TTL: 6 * 3600, urgency: "normal" },
      );
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 404 || e.statusCode === 410) gone.push(m.endpoint);   // Gerät gibt es nicht mehr
      else console.error("Push fehlgeschlagen", e.statusCode, String(e.body || e.message).slice(0, 200));
    }
  }));
  if (gone.length) await rpc("push_drop", { p_endpoints: gone });
  return { sent, failed, removed: gone.length };
}
