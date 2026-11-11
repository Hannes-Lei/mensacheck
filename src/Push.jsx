import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { styles, C, Chip } from "./ui.jsx";

// ============================================================================
// Push-Nachrichten
// ----------------------------------------------------------------------------
// • registerServiceWorker(): beim Start, damit das Handy Nachrichten anzeigen kann
// • kickPush(): nach Reaktion, Antwort oder Einchecken – lässt /api/push die
//   Nachrichten verschicken, die die Datenbank gerade angelegt hat
// • pushSignOut(): beim Abmelden dieses Handy abmelden
// • <PushSettings>: Abschnitt „Benachrichtigungen“ unter Ich
// Auf dem iPhone geht Push nur, wenn Schmausi auf dem Home-Bildschirm ist.
// ============================================================================

const KINDS = [
  { key: "favorites", label: "❤️ Lieblingsgericht heute" },
  { key: "reactions", label: "😋 Reaktionen & Antworten" },
  { key: "friends", label: "🍽️ Freunde in der Mensa" },
];

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => { /* egal */ });
}

export function kickPush() {
  try { fetch("/api/push", { method: "POST", keepalive: true }).catch(() => {}); } catch { /* egal */ }
}

async function currentSubscription() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushSignOut() {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await supabase.rpc("push_unsubscribe", { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch { /* egal */ }
}

function keyToBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushSettings({ userId, showToast = () => {} }) {
  // loading | unsupported | install | denied | off | on
  const [status, setStatus] = useState("loading");
  const [prefs, setPrefs] = useState({ favorites: true, reactions: true, friends: true });
  const [busy, setBusy] = useState(false);
  const [isMod, setIsMod] = useState(false);   // Test-Knopf nur für Moderatoren

  async function loadPrefs() {
    const { data } = await supabase.from("push_prefs").select("favorites, reactions, friends").eq("user_id", userId).maybeSingle();
    if (data) setPrefs(data);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supported()) return alive && setStatus(isIOS() && !isStandalone() ? "install" : "unsupported");
      if (Notification.permission === "denied") return alive && setStatus("denied");
      try {
        const sub = await currentSubscription();
        let on = false;
        if (sub) {
          const { data } = await supabase.rpc("push_is_subscribed", { p_endpoint: sub.endpoint });
          on = data === true;
        }
        if (!alive) return;
        setStatus(on ? "on" : "off");
        if (on) loadPrefs();
      } catch { if (alive) setStatus("off"); }
    })();
    return () => { alive = false; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== "on") return;
    supabase.rpc("is_moderator").then(({ data }) => setIsMod(data === true));
  }, [status, userId]);

  async function enable() {
    setBusy(true);
    try {
      // Muss als Erstes passieren (direkt nach dem Tippen), sonst blockt das iPhone
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "off");
        return;
      }
      const { publicKey } = await fetch("/api/push").then((r) => r.json()).catch(() => ({}));
      if (!publicKey) { showToast("Push ist noch nicht fertig eingerichtet."); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const opts = { userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) };
      let sub;
      try {
        sub = await reg.pushManager.subscribe(opts);
      } catch {
        // altes Abo mit anderem Schlüssel? Dann neu anmelden
        const old = await reg.pushManager.getSubscription();
        if (old) await old.unsubscribe();
        sub = await reg.pushManager.subscribe(opts);
      }
      const j = sub.toJSON();
      const { error } = await supabase.rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
      if (error) throw error;
      setStatus("on");
      await loadPrefs();
      showToast("🔔 Benachrichtigungen sind an.");
    } catch (e) {
      console.error(e);
      showToast("Das hat nicht geklappt. Versuch es später noch einmal.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    await pushSignOut();
    setBusy(false);
    setStatus("off");
    showToast("Benachrichtigungen auf diesem Handy aus.");
  }

  async function togglePref(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const { error } = await supabase.from("push_prefs").upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    if (error) { setPrefs(prefs); showToast("Konnte nicht gespeichert werden."); }
  }

  async function test() {
    const { data, error } = await supabase.rpc("push_test");
    if (error || data !== true) return showToast("Das hat nicht geklappt.");
    kickPush();
    showToast("Test-Nachricht ist unterwegs …");
  }

  const note = { fontSize: 14, color: C.muted, lineHeight: 1.5, margin: "0 0 4px" };

  return (
    <>
      <h3 style={styles.h3}>Benachrichtigungen</h3>
      {status === "loading" && <p style={note}>…</p>}
      {status === "install" && (
        <p style={note}>
          Auf dem iPhone gehen Benachrichtigungen nur, wenn Schmausi auf dem Home-Bildschirm ist:
          in Safari auf <strong>Teilen</strong> → <strong>Zum Home-Bildschirm</strong>, dann die App von dort öffnen und hier einschalten.
        </p>
      )}
      {status === "unsupported" && <p style={note}>Dieser Browser kann leider keine Benachrichtigungen anzeigen.</p>}
      {status === "denied" && (
        <p style={note}>
          Benachrichtigungen sind für Schmausi blockiert. Du kannst sie in den Einstellungen deines Handys
          (bzw. Browsers) bei Schmausi wieder erlauben.
        </p>
      )}
      {status === "off" && (
        <>
          <p style={note}>Lass dich benachrichtigen, wenn dein Lieblingsgericht auf dem Plan steht, jemand auf deine Bewertung reagiert oder Freunde in der Mensa sitzen.</p>
          <button type="button" disabled={busy} onClick={enable} style={{ ...styles.smallPrimary, marginTop: 6 }}>
            {busy ? "Einen Moment …" : "🔔 Einschalten"}
          </button>
        </>
      )}
      {status === "on" && (
        <>
          <p style={note}>Auf diesem Handy an. Was möchtest du bekommen?</p>
          <div style={{ ...styles.chipRow, flexWrap: "wrap" }}>
            {KINDS.map((k) => (
              <Chip key={k.key} active={prefs[k.key]} onClick={() => togglePref(k.key)} aria-pressed={prefs[k.key]}>{k.label}</Chip>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {isMod && <button type="button" onClick={test} style={styles.smallAction}>Test-Nachricht</button>}
            <button type="button" disabled={busy} onClick={disable} style={{ ...styles.smallAction, color: C.muted }}>Ausschalten</button>
          </div>
        </>
      )}
    </>
  );
}
