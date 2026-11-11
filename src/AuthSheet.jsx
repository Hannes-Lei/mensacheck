import React, { useState } from "react";
import { supabase } from "./supabase.js";
import { friendlyError } from "./helpers.js";
import { styles, C } from "./ui.jsx";

const inlineLink = { background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", textDecoration: "underline", cursor: "pointer" };

// ============================================================================
// Fenster zum Registrieren und Anmelden
// ============================================================================
export default function AuthSheet({ onClose, note, onLegal = () => {} }) {
  const [mode, setMode] = useState("register"); // register | login | reset
  const [sent, setSent] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);

    if (mode === "reset") {
      setBusy(true);
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/",
      });
      setBusy(false);
      if (err) return setError(friendlyError(err));
      return setSent(true);
    }

    if (mode === "register" && username.trim().length < 2) {
      setError("Der Nutzername braucht mindestens 2 Zeichen.");
      return;
    }

    setBusy(true);
    const { data, error: err } =
      mode === "register"
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { username: username.trim().slice(0, 19) } },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);

    if (err) return setError(friendlyError(err));
    if (mode === "register" && !data.session) {
      return setError("Fast geschafft: Bitte bestätige zuerst die E-Mail in deinem Postfach.");
    }
    onClose();
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <form style={styles.sheet} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={styles.sheetHead}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{mode === "register" ? "Konto erstellen" : mode === "login" ? "Anmelden" : "Passwort vergessen"}</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Schließen">×</button>
        </div>
        <p style={{ margin: "0 0 14px", color: C.muted, fontSize: 14 }}>
          {mode === "reset"
            ? "Gib deine E-Mail ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegen kannst."
            : note || (mode === "register" ? "Damit deine Bewertungen für alle sichtbar werden." : "Schön, dass du wieder da bist.")}
        </p>

        {mode === "register" && (
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Nutzername</span>
            <input
              style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="z.B. Hannes" autoComplete="nickname" maxLength={19}
            />
          </label>
        )}
        <label style={styles.field}>
          <span style={styles.fieldLabel}>E-Mail</span>
          <input
            style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" required
          />
        </label>
        {mode !== "reset" && <div style={styles.field}>
          <label htmlFor="auth-password" style={styles.fieldLabel}>Passwort</label>
          <div style={{ position: "relative" }}>
            <input
              id="auth-password" style={{ ...styles.input, paddingRight: 48 }}
              type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={6} required
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
            />
            <button
              type="button" onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"} aria-pressed={showPassword}
              style={{
                position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 40, height: 40,
                display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none",
                cursor: "pointer", color: C.muted, padding: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="M4 4l16 16" />}
              </svg>
            </button>
          </div>
          {mode === "login" && (
            <button
              type="button" onClick={() => { setMode("reset"); setError(null); setSent(false); }}
              style={{ ...inlineLink, fontSize: 13, color: C.muted, marginTop: 8 }}
            >
              Passwort vergessen?
            </button>
          )}
        </div>}

        {sent && mode === "reset" && (
          <div style={{ ...styles.notice, marginBottom: 12 }}>
            📬 Wenn es zu dieser E-Mail ein Konto gibt, ist der Link unterwegs. Schau auch im Spam-Ordner nach.
          </div>
        )}

        {error && <div style={{ ...styles.notice, ...styles.noticeError, marginBottom: 12 }}>{error}</div>}

        {mode === "register" && (
          <p style={{ margin: "0 0 12px", fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Mit der Registrierung stimmst du den{" "}
            <button type="button" onClick={() => onLegal("regeln")} style={inlineLink}>Nutzungsregeln</button> zu. Wie wir mit
            deinen Daten umgehen, steht im{" "}
            <button type="button" onClick={() => onLegal("datenschutz")} style={inlineLink}>Datenschutz</button>.
          </p>
        )}

        <button type="submit" disabled={busy} style={styles.primaryBtn}>
          {busy ? "Einen Moment…" : mode === "register" ? "Registrieren" : mode === "login" ? "Anmelden" : sent ? "Nochmal schicken" : "Link schicken"}
        </button>

        <button
          type="button" style={styles.linkBtn}
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setSent(false); }}
        >
          {mode === "register" ? "Schon ein Konto? Anmelden" : mode === "login" ? "Noch kein Konto? Registrieren" : "Zurück zum Anmelden"}
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// Neues Passwort festlegen – öffnet sich, wenn man über den Link aus der
// „Passwort vergessen“-Mail in die App kommt
// ============================================================================
export function NewPasswordSheet({ onClose, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) return setError("Das Passwort braucht mindestens 6 Zeichen.");
    if (pw !== pw2) return setError("Die beiden Passwörter sind nicht gleich.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onDone();
  }

  const input = (value, set, id, label) => (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input
        id={id} style={styles.input} type={show ? "text" : "password"} value={value} onChange={(e) => set(e.target.value)}
        autoComplete="new-password" minLength={6} required autoCapitalize="none" autoCorrect="off" spellCheck={false}
      />
    </label>
  );

  return (
    <div style={styles.overlay}>
      <form style={styles.sheet} onSubmit={submit} role="dialog" aria-label="Neues Passwort">
        <div style={styles.sheetHead}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Neues Passwort</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Schließen">×</button>
        </div>
        <p style={{ margin: "0 0 14px", color: C.muted, fontSize: 14 }}>Leg jetzt ein neues Passwort für dein Konto fest.</p>
        {input(pw, setPw, "new-pw", "Neues Passwort")}
        {input(pw2, setPw2, "new-pw2", "Nochmal eingeben")}
        <button type="button" onClick={() => setShow((v) => !v)} style={{ ...inlineLink, fontSize: 13, color: C.muted, margin: "0 0 12px" }}>
          {show ? "Passwort verbergen" : "Passwort anzeigen"}
        </button>
        {error && <div style={{ ...styles.notice, ...styles.noticeError, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={busy} style={styles.primaryBtn}>{busy ? "Einen Moment…" : "Passwort speichern"}</button>
      </form>
    </div>
  );
}
