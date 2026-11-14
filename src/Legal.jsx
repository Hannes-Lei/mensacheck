import React, { useState } from "react";
import { supabase } from "./supabase.js";
import { friendlyError } from "./helpers.js";
import { styles, C } from "./ui.jsx";

// ============================================================================
// Rechtliches: Impressum, Datenschutz, Nutzungsregeln + "Konto & Daten"
// ----------------------------------------------------------------------------
// HIER EINMAL DEINE ANGABEN EINTRAGEN (stehen dann in Impressum + Datenschutz):
// ============================================================================
export const LEGAL = {
  name: "Hannes",
  street: "",   // z.B. "Musterstraße 1"   – leer = wird nicht angezeigt
  city: "",     // z.B. "04103 Leipzig"
  email: "schmausi.app@gmail.com",
  updated: "November 2026",
};

const P = ({ children }) => <p style={{ margin: "0 0 10px", lineHeight: 1.55, fontSize: 14, color: C.soft }}>{children}</p>;
const H = ({ children }) => <h3 style={{ ...styles.h3, fontSize: 16, margin: "18px 0 6px" }}>{children}</h3>;
const UL = ({ items }) => (
  <ul style={{ margin: "0 0 10px", paddingLeft: 20, lineHeight: 1.55, fontSize: 14, color: C.soft }}>
    {items.map((t, i) => <li key={i}>{t}</li>)}
  </ul>
);
// Leere Angaben werden einfach weggelassen
const Address = () => {
  const lines = [LEGAL.name, LEGAL.street, LEGAL.city, LEGAL.email && `E-Mail: ${LEGAL.email}`].filter(Boolean);
  return <P>{lines.map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{l}</React.Fragment>)}</P>;
};
const contact = () => (LEGAL.email ? `an ${LEGAL.email}` : "an den Betreiber");

const PAGES = {
  impressum: {
    title: "Impressum",
    body: (
      <>
        <H>Angaben gemäß § 5 DDG</H>
        <Address />
        <H>Verantwortlich für den Inhalt</H>
        <P>{LEGAL.name}{LEGAL.street ? " (Anschrift wie oben)" : ""}</P>
        <H>Hinweis</H>
        <P>
          Schmausi ist ein privates, nicht-kommerzielles Projekt von Studierenden und gehört nicht zum
          Studentenwerk Leipzig. Die Speisepläne kommen von OpenMensa und dem Studentenwerk Leipzig. Gerichte, Preise
          und Allergene sind ohne Gewähr. Verbindlich sind die Angaben vor Ort.
        </P>
        <P>
          Bewertungen und Kommentare sind Meinungen der jeweiligen Nutzer, nicht die des Betreibers. Wenn dir ein
          rechtswidriger Inhalt auffällt, schreib bitte {contact()}.
        </P>
      </>
    ),
  },
  datenschutz: {
    title: "Datenschutz",
    body: (
      <>
        <P>Stand: {LEGAL.updated}. Hier steht, welche Daten Schmausi verarbeitet, wozu und welche Rechte du hast.</P>
        <H>1. Verantwortlich</H>
        <Address />
        <H>2. Welche Daten wir speichern</H>
        <UL items={[
          "Konto: E-Mail-Adresse, Passwort (nur verschlüsselt als Hash), Nutzername, freiwillig ein Profilbild.",
          "Deine Inhalte: Bewertungen, Kommentare, Reaktionen, Antworten und Lieblingsgerichte, jeweils mit Datum und Mensa.",
          "Gruppen: welchen Gruppen du angehörst bzw. welche du erstellt hast.",
          "Sitzplatz (freiwillig): Mensa, Tisch und Uhrzeit, wenn du eincheckst.",
          "Benachrichtigungen (freiwillig): Wenn du sie einschaltest, die Push-Adresse deines Geräts mit zwei technischen Schlüsseln, welche Benachrichtigungen du möchtest, und die verschickten Nachrichten.",
          "Technisch: Zeitpunkt der Registrierung und der letzten Anmeldung. Beim Aufruf der App verarbeitet der Hosting-Anbieter außerdem kurz deine IP-Adresse, Datum/Uhrzeit und Browser-Angaben (Server-Logs).",
        ]} />
        <H>3. Wozu und auf welcher Grundlage</H>
        <P>
          Wir verarbeiten die Daten, um dir die App mit ihren Funktionen bereitzustellen: Konto, Bewertungen, Gruppen,
          Sitzplätze und Benachrichtigungen (Art. 6 Abs. 1 lit. b DSGVO, Nutzungsvertrag). Server-Logs und die Moderation von Inhalten
          dienen dem sicheren Betrieb und dem Schutz vor Missbrauch (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse).
          Es gibt keine Werbung, kein Tracking und keine Weitergabe zu Werbezwecken.
        </P>
        <H>4. Wer was sieht</H>
        <UL items={[
          "Für alle sichtbar: Nutzername, Profilbild, Bewertungen und Kommentare samt Reaktionen und Antworten.",
          "Nur für deine Gruppenmitglieder: dass du in der Gruppe bist, dein Feed und dein Sitzplatz.",
          "Moderatoren sehen zusätzlich, wann du dich registriert und zuletzt angemeldet hast und wie viele Bewertungen du hast, aber nicht deine E-Mail-Adresse.",
          "Deine E-Mail-Adresse sieht niemand außer dem Betreiber.",
        ]} />
        <H>5. Dienstleister</H>
        <UL items={[
          "Supabase Inc. (Datenbank, Anmeldung, Profilbilder): Die Daten liegen auf Servern in Frankfurt am Main (EU).",
          "Google (Gmail): Darüber wird die E-Mail zum Zurücksetzen des Passworts verschickt. Dafür wird deine E-Mail-Adresse an Google übermittelt.",
          "Vercel Inc. (Hosting der App): Sitz in den USA. Die Übermittlung ist über das EU-US Data Privacy Framework bzw. EU-Standardvertragsklauseln abgesichert.",
          "OpenMensa (Speisepläne): Unser Server fragt die Speisepläne ab. Dabei werden keine Daten von dir übertragen.",
          "Push-Dienst deines Geräts (nur wenn du Benachrichtigungen einschaltest): je nach Gerät Apple, Google oder Mozilla. Er stellt die Nachricht zu; der Inhalt ist dabei verschlüsselt.",
        ]} />
        <P>Mit den Dienstleistern bestehen Verträge zur Auftragsverarbeitung.</P>
        <H>6. Speicher auf deinem Gerät</H>
        <P>
          Die App speichert im Browser (Local Storage) nur, was sie für ihre Funktion braucht: deine Anmeldung, die
          Darstellung hell/dunkel und welche Abzeichen und Sitzplätze du schon gesehen hast. Dafür ist keine
          Einwilligung nötig (§ 25 Abs. 2 TDDDG). Cookies zu Werbe- oder Analysezwecken gibt es nicht.
        </P>
        <H>7. Wie lange</H>
        <P>
          Deine Daten bleiben gespeichert, bis du dein Konto löschst. Einzelne Bewertungen kannst du jederzeit selbst
          entfernen. Ein Sitzplatz ist nur 60 Minuten sichtbar und wird spätestens nach einem Tag gelöscht.
          Verschickte Benachrichtigungen werden nach 14 Tagen gelöscht, die Push-Adresse deines Geräts, sobald du
          Benachrichtigungen ausschaltest oder dich abmeldest.
          Server-Logs löscht der Hosting-Anbieter nach kurzer Zeit automatisch.
        </P>
        <H>8. Deine Rechte</H>
        <P>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
          und Widerspruch (Art. 15–21 DSGVO). Dein Konto mit allen Daten kannst du selbst löschen: Ich → ganz unten
          „Konto & Daten“. Für alles andere schreib {contact()}.
        </P>
        <P>
          Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, z.B. bei der Sächsischen
          Datenschutz- und Transparenzbeauftragten (www.datenschutz.sachsen.de).
        </P>
      </>
    ),
  },
  regeln: {
    title: "Nutzungsregeln",
    body: (
      <>
        <P>Stand: {LEGAL.updated}. Mit der Registrierung stimmst du diesen Regeln zu.</P>
        <H>1. Worum es geht</H>
        <P>
          Schmausi ist kostenlos. Du kannst Gerichte der Leipziger Mensen bewerten, kommentieren und mit Freunden
          teilen, wo ihr sitzt. Es besteht kein Anspruch darauf, dass die App immer erreichbar ist oder Funktionen
          dauerhaft bleiben.
        </P>
        <H>2. Fair bleiben</H>
        <P>Bewerte ehrlich und schreib so, wie du es auch vor Ort sagen würdest. Nicht erlaubt sind:</P>
        <UL items={[
          "Beleidigungen, Hetze, Drohungen oder Diskriminierung",
          "Aussagen über Mitarbeitende, die sie bloßstellen oder Falsches behaupten",
          "Werbung, Spam und absichtlich falsche Bewertungen",
          "Inhalte, die gegen Gesetze oder Rechte anderer verstoßen (z.B. fremde Fotos oder Texte)",
          "Nutzernamen oder Profilbilder, die gegen diese Regeln verstoßen",
        ]} />
        <H>3. Was bei Verstößen passiert</H>
        <P>
          Inhalte, die gegen diese Regeln verstoßen, können ohne Vorwarnung entfernt werden. Bei wiederholten oder
          schweren Verstößen kann ein Konto gesperrt oder gelöscht werden.
        </P>
        <H>4. Deine Inhalte</H>
        <P>
          Deine Bewertungen und Kommentare bleiben deine. Du erlaubst Schmausi nur, sie in der App anzuzeigen,
          solange sie nicht gelöscht sind. Du kannst sie jederzeit selbst entfernen.
        </P>
        <H>5. Ohne Gewähr</H>
        <P>
          Speisepläne, Preise und vor allem Allergene stammen vom Studentenwerk Leipzig über OpenMensa und sind ohne
          Gewähr. Bei Allergien verlass dich bitte immer auf die Angaben vor Ort. Für Inhalte anderer Nutzer ist der
          Betreiber nicht verantwortlich, entfernt aber rechtswidrige Inhalte, sobald er davon erfährt.
        </P>
        <H>6. Konto</H>
        <P>
          Du brauchst eine gültige E-Mail-Adresse und musst mindestens 16 Jahre alt sein. Halte dein Passwort geheim.
          Du kannst dein Konto jederzeit unter Ich → „Konto & Daten“ löschen.
        </P>
        <H>7. Änderungen</H>
        <P>Ändern sich diese Regeln wesentlich, erfährst du das in der App.</P>
      </>
    ),
  },
};

// Vollbild-Seite mit einem der Rechtstexte
export function LegalSheet({ page, onClose }) {
  const p = PAGES[page];
  if (!p) return null;
  return (
    <div style={{ ...styles.overlay, zIndex: 40, alignItems: "stretch" }} onClick={onClose}>
      <div
        role="dialog" aria-label={p.title} onClick={(e) => e.stopPropagation()}
        style={{ ...styles.sheet, borderRadius: 0, height: "100%", overflowY: "auto", paddingBottom: 40 }}
      >
        <div style={styles.sheetHead}>
          <h2 style={{ margin: 0, fontSize: 22 }}>{p.title}</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Schließen">×</button>
        </div>
        {p.body}
      </div>
    </div>
  );
}

// Dezente Zeile mit den Links (Fußzeile, Anmeldefenster)
export function LegalLinks({ onOpen, style }) {
  const link = { background: "none", border: "none", padding: 0, color: "inherit", font: "inherit", textDecoration: "underline", cursor: "pointer" };
  return (
    <span style={style}>
      <button type="button" style={link} onClick={() => onOpen("impressum")}>Impressum</button>{" · "}
      <button type="button" style={link} onClick={() => onOpen("datenschutz")}>Datenschutz</button>{" · "}
      <button type="button" style={link} onClick={() => onOpen("regeln")}>Nutzungsregeln</button>
    </span>
  );
}

// ============================================================================
// Konto & Daten: E-Mail, Nutzername ändern, Passwort ändern, Konto löschen (Warnseite + Passwort)
// ============================================================================
export function AccountSheet({ userId, username, onClose, onDeleted, showToast, onUsernameChange = () => {} }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("overview"); // overview | name | password | warn | confirm
  const [newName, setNewName] = useState(username || "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
  }, []);

  async function changePassword(e) {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) return setError("Das Passwort braucht mindestens 6 Zeichen.");
    if (pw !== pw2) return setError("Die beiden Passwörter sind nicht gleich.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setPw(""); setPw2(""); setStep("overview");
    showToast("Passwort geändert.");
  }

  // Nutzername ändern (2–24 Zeichen; Groß/Klein zählt beim Vergleich nicht)
  async function changeName(e) {
    e.preventDefault();
    setError(null);
    const name = newName.trim().replace(/\s+/g, " ");
    if (name === username) return setStep("overview");
    if (name.length < 2 || name.length > 24) return setError("Der Name braucht 2 bis 24 Zeichen.");
    setBusy(true);
    const like = name.replace(/[\\%_]/g, (c) => "\\" + c);
    const { data: taken } = await supabase.from("profiles").select("id").ilike("username", like).neq("id", userId).limit(1);
    if (taken?.length) { setBusy(false); return setError("Den Namen gibt es schon. Probier einen anderen."); }
    const { error: err } = await supabase.from("profiles").update({ username: name }).eq("id", userId);
    setBusy(false);
    if (err) return setError(err.code === "23505" ? "Den Namen gibt es schon. Probier einen anderen." : err.code === "23514" ? "Dieser Name geht leider nicht." : friendlyError(err));
    onUsernameChange(name);
    setStep("overview");
    showToast("Nutzername geändert.");
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // 1. Passwort prüfen (falls jemand nur das entsperrte Handy in der Hand hat)
      const check = await supabase.auth.signInWithPassword({ email, password: pw });
      if (check.error) throw new Error("Das Passwort stimmt nicht.");
      // 2. Profilbilder löschen
      const { data: files } = await supabase.storage.from("avatars").list(userId);
      if (files?.length) await supabase.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
      // 3. Konto samt allen Daten löschen
      const { error: err } = await supabase.rpc("delete_my_account");
      if (err) throw err;
      await supabase.auth.signOut();
      onDeleted();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  const back = () => { setStep("overview"); setPw(""); setPw2(""); setError(null); setNewName(username || ""); };

  return (
    <div style={{ ...styles.overlay, zIndex: 30 }} onClick={onClose}>
      <div style={{ ...styles.sheet, maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Konto und Daten">
        <div style={styles.sheetHead}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Konto & Daten</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Schließen">×</button>
        </div>

        {step === "overview" && (
          <>
            <div style={{ fontSize: 14, color: C.muted, margin: "6px 0 16px", lineHeight: 1.6 }}>
              Angemeldet als <strong style={{ color: C.text }}>{username}</strong>{" "}
              <button
                type="button" onClick={() => { setNewName(username || ""); setStep("name"); }}
                style={{ background: "none", border: "none", color: C.faint, fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: "0 2px" }}
              >ändern</button><br />
              E-Mail: {email || "…"}
            </div>
            <button type="button" style={{ ...styles.ghostBtn, width: "100%" }} onClick={() => setStep("password")}>Passwort ändern</button>
            <div style={{ marginTop: 34, textAlign: "center" }}>
              <button
                type="button" onClick={() => setStep("warn")}
                style={{ background: "none", border: "none", color: C.errText, fontSize: 13, textDecoration: "underline", cursor: "pointer", padding: 6 }}
              >
                Konto löschen
              </button>
            </div>
          </>
        )}

        {step === "name" && (
          <form onSubmit={changeName} style={{ marginTop: 10 }}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Neuer Nutzername</span>
              <input style={styles.input} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={24} autoComplete="username" required />
            </label>
            <div style={{ fontSize: 13, color: C.muted, margin: "-4px 0 12px" }}>So sehen dich andere bei Bewertungen, im Feed und in Gruppen.</div>
            {error && <div style={{ ...styles.notice, ...styles.noticeError, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={busy} style={styles.primaryBtn}>{busy ? "Einen Moment…" : "Speichern"}</button>
            <button type="button" style={styles.linkBtn} onClick={back}>Zurück</button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={changePassword} style={{ marginTop: 10 }}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Neues Passwort</span>
              <input style={styles.input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={6} required />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Noch einmal</span>
              <input style={styles.input} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={6} required />
            </label>
            {error && <div style={{ ...styles.notice, ...styles.noticeError, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={busy} style={styles.primaryBtn}>{busy ? "Einen Moment…" : "Speichern"}</button>
            <button type="button" style={styles.linkBtn} onClick={back}>Zurück</button>
          </form>
        )}

        {step === "warn" && (
          <>
            <div style={{ ...styles.notice, ...styles.noticeError, margin: "10px 0 12px", lineHeight: 1.5 }}>
              <strong>Das kann nicht rückgängig gemacht werden.</strong>
            </div>
            <P>Wenn du dein Konto löschst, wird endgültig entfernt:</P>
            <UL items={[
              "dein Konto, Nutzername und Profilbild",
              "alle deine Bewertungen und Kommentare",
              "deine Reaktionen, Antworten und Lieblingsgerichte",
              "deine Gruppen-Mitgliedschaften und dein Sitzplatz",
            ]} />
            <P>Gruppen, die du erstellt hast, bleiben für die anderen Mitglieder bestehen.</P>
            <button type="button" style={styles.primaryBtn} onClick={back}>Abbrechen, Konto behalten</button>
            <button type="button" style={{ ...styles.linkBtn, color: C.errText, fontWeight: 600 }} onClick={() => { setStep("confirm"); setError(null); }}>
              Weiter zum Löschen
            </button>
          </>
        )}

        {step === "confirm" && (
          <form onSubmit={deleteAccount} style={{ marginTop: 10 }}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Zur Bestätigung dein Passwort</span>
              <input style={styles.input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
            </label>
            {error && <div style={{ ...styles.notice, ...styles.noticeError, marginBottom: 12 }}>{error}</div>}
            <button
              type="submit" disabled={busy || !pw}
              style={{ ...styles.primaryBtn, background: "#B3261E", color: "#fff", opacity: busy || !pw ? 0.4 : 1 }}
            >
              {busy ? "Wird gelöscht…" : "Konto endgültig löschen"}
            </button>
            <button type="button" style={styles.linkBtn} onClick={back}>Abbrechen</button>
          </form>
        )}
      </div>
    </div>
  );
}
