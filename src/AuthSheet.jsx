import React, { useState } from "react";
import { supabase } from "./supabase.js";
import { friendlyError } from "./helpers.js";
import { styles, C } from "./ui.jsx";

// ============================================================================
// Fenster zum Registrieren und Anmelden
// ============================================================================
export default function AuthSheet({ onClose }) {
  const [mode, setMode] = useState("register"); // register | login
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);

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
          <h2 style={{ margin: 0, fontSize: 20 }}>{mode === "register" ? "Konto erstellen" : "Anmelden"}</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Schließen">×</button>
        </div>
        <p style={{ margin: "0 0 14px", color: C.muted, fontSize: 14 }}>
          {mode === "register" ? "Damit deine Bewertungen für alle sichtbar werden." : "Schön, dass du wieder da bist."}
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
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Passwort</span>
          <input
            style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={6} required
          />
        </label>

        {error && <div style={{ ...styles.notice, ...styles.noticeError, marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={busy} style={styles.primaryBtn}>
          {busy ? "Einen Moment…" : mode === "register" ? "Registrieren" : "Anmelden"}
        </button>

        <button
          type="button" style={styles.linkBtn}
          onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(null); }}
        >
          {mode === "register" ? "Schon ein Konto? Anmelden" : "Noch kein Konto? Registrieren"}
        </button>
      </form>
    </div>
  );
}
