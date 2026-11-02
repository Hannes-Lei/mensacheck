import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { formatDate, timeAgo, friendlyError } from "./helpers.js";
import { Avatar, Chip, styles, C } from "./ui.jsx";

// ============================================================================
// Bereich "Moderation" im Tab Ich – erscheint nur für Moderatoren.
// Ob jemand Moderator ist, entscheidet die Datenbank (Tabelle moderators),
// nicht die App. Alle Daten kommen über die Funktionen mod_… (SQL 12 + 14).
//   Meldungen  – was andere über das kleine "⋯" gemeldet haben
//   Kommentare – die neuesten Kommentare und Antworten aller Nutzer
//   Nutzer     – Übersicht, Profilbild entfernen, Konto sperren
// ============================================================================

const REASON_LABEL = { beleidigend: "beleidigend", spam: "Spam", falsch: "falsch/unpassend", sonstiges: "sonstiges" };

export default function Moderation({ active, userId, showToast, canteenName = () => "" }) {
  const [isMod, setIsMod] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("reports");
  const [reports, setReports] = useState(null);
  const [recent, setRecent] = useState(null);
  const [users, setUsers] = useState(null);
  const [banned, setBanned] = useState(new Set());
  const [query, setQuery] = useState("");

  // Bin ich Moderator? (bei allen anderen passiert hier einfach nichts)
  useEffect(() => {
    if (!userId) { setIsMod(false); return; }
    supabase.rpc("is_moderator").then(({ data }) => setIsMod(data === true));
  }, [userId]);

  async function loadReports() {
    const { data, error } = await supabase.rpc("mod_reports");
    if (error) return showToast(friendlyError(error));
    setReports(data || []);
  }
  async function loadRecent() {
    const { data, error } = await supabase.rpc("mod_recent_comments", { p_limit: 60 });
    if (error) return showToast(friendlyError(error));
    setRecent(data || []);
  }
  async function loadUsers() {
    const [{ data, error }, { data: b }] = await Promise.all([supabase.rpc("mod_users"), supabase.rpc("mod_banned")]);
    if (error) return showToast(friendlyError(error));
    setUsers(data || []);
    setBanned(new Set((b || []).map((x) => (typeof x === "string" ? x : x.mod_banned))));
  }

  // Offene Meldungen schon zählen, wenn der Bereich noch zu ist (Zahl am Knopf)
  useEffect(() => { if (isMod && active) loadReports(); }, [isMod, active]); // eslint-disable-line
  useEffect(() => {
    if (!isMod || !active || !open) return;
    if (tab === "reports") loadReports();
    if (tab === "recent") loadRecent();
    if (tab === "users") loadUsers();
  }, [isMod, active, open, tab]); // eslint-disable-line

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users || []).filter((u) => !q || u.username.toLowerCase().includes(q));
  }, [users, query]);

  if (!isMod) return null;

  // Inhalt entfernen (remove = true) oder Meldung nur abhaken
  async function resolve(item, remove) {
    if (remove && !window.confirm(`${item.reply_id ? "Antwort" : "Kommentar"} von „${item.author}" entfernen?`)) return;
    const { error } = await supabase.rpc("mod_resolve", { p_rating: item.reply_id ? null : item.rating_id, p_reply: item.reply_id ?? null, p_remove: remove });
    if (error) return showToast(friendlyError(error));
    showToast(remove ? "Entfernt." : "Meldung erledigt.");
    loadReports();
    if (recent) loadRecent();
  }

  async function setBan(u, ban) {
    if (ban && !window.confirm(`„${u.username}" sperren? Die Person kann dann nichts mehr bewerten, kommentieren oder antworten – lesen geht weiter.`)) return;
    const { error } = await supabase.rpc("mod_set_ban", { p_user: u.id, p_ban: ban });
    if (error) return showToast(friendlyError(error));
    showToast(ban ? "Gesperrt." : "Entsperrt.");
    loadUsers();
  }

  async function clearAvatar(u) {
    if (!window.confirm(`Profilbild von „${u.username}" entfernen?`)) return;
    const { error } = await supabase.rpc("mod_clear_avatar", { p_user: u.id });
    if (error) showToast(friendlyError(error));
    else { showToast("Profilbild entfernt."); loadUsers(); }
  }

  const openCount = reports?.length || 0;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" style={{ ...styles.extrasToggle, marginTop: 8 }} onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} 🛡️ Moderation
        {openCount > 0 && <span style={ms.count} aria-label={`${openCount} offene Meldungen`}>{openCount}</span>}
      </button>

      {open && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip active={tab === "reports"} onClick={() => setTab("reports")}>🚩 Meldungen{openCount ? ` (${openCount})` : ""}</Chip>
            <Chip active={tab === "recent"} onClick={() => setTab("recent")}>💬 Neueste</Chip>
            <Chip active={tab === "users"} onClick={() => setTab("users")}>👤 Nutzer</Chip>
          </div>

          {/* ---- Meldungen ---- */}
          {tab === "reports" && (reports === null ? <div style={styles.notice}>Wird geladen…</div>
            : reports.length === 0 ? <p style={styles.mutedText}>Keine offenen Meldungen. 🎉</p>
            : reports.map((r) => (
              <div key={`${r.rating_id}-${r.reply_id}`} style={{ ...styles.card, padding: 12 }}>
                <Meta item={r} canteenName={canteenName} />
                <Quote text={r.content} />
                <div style={{ fontSize: 12, color: C.errText, marginTop: 6 }}>
                  🚩 {r.reports}× gemeldet · {String(r.reasons || "").split(", ").map((x) => REASON_LABEL[x] || x).join(", ")}
                </div>
                {r.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>„{r.notes}"</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" style={{ ...styles.ghostBtn, flex: 1, color: C.errText }} onClick={() => resolve(r, true)}>Entfernen</button>
                  <button type="button" style={{ ...styles.ghostBtn, flex: 1 }} onClick={() => resolve(r, false)}>Ist okay</button>
                </div>
              </div>
            )))}

          {/* ---- Neueste Kommentare ---- */}
          {tab === "recent" && (recent === null ? <div style={styles.notice}>Wird geladen…</div>
            : recent.length === 0 ? <p style={styles.mutedText}>Noch keine Kommentare.</p>
            : recent.map((r) => (
              <div key={`${r.rating_id}-${r.reply_id}`} style={{ ...styles.card, padding: 12 }}>
                <Meta item={r} canteenName={canteenName} when={r.created_at} />
                <Quote text={r.content} />
                {r.author_id !== userId && (
                  <button type="button" style={{ ...ms.remove }} onClick={() => resolve(r, true)}>Entfernen</button>
                )}
              </div>
            )))}

          {/* ---- Nutzer ---- */}
          {tab === "users" && (users === null ? <div style={styles.notice}>Wird geladen…</div> : (
            <UserList
              users={users} list={list} query={query} setQuery={setQuery} userId={userId}
              banned={banned} onBan={setBan} onClearAvatar={clearAvatar}
            />
          ))}
        </>
      )}
    </section>
  );
}

function Meta({ item, canteenName, when }) {
  const where = [item.meal_name, canteenName(item.canteen_id), item.meal_date && formatDate(item.meal_date)].filter(Boolean).join(" · ");
  return (
    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
      <strong style={{ color: C.text }}>{item.author}</strong>
      <span style={{ color: C.muted }}> {item.reply_id ? "antwortete" : "schrieb"}{when ? ` · ${timeAgo(when)}` : ""}</span>
      <div style={{ color: C.faint, fontSize: 12 }}>{where}</div>
    </div>
  );
}

function Quote({ text }) {
  return (
    <div style={{ margin: "6px 0 0", padding: "8px 10px", borderRadius: 10, background: C.hintBg, fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {text}
    </div>
  );
}

function UserList({ users, list, query, setQuery, userId, banned, onBan, onClearAvatar }) {
  const today = new Date(Date.now() - 24 * 3600 * 1000);
  const total = users.length;
  const activeToday = users.filter((u) => u.last_sign_in && new Date(u.last_sign_in) > today
    || u.last_rating && new Date(u.last_rating) > today).length;
  const ratingsToday = users.reduce((n, u) => n + Number(u.ratings_today || 0), 0);
  const newWeek = users.filter((u) => new Date(u.created_at) > new Date(Date.now() - 7 * 24 * 3600 * 1000)).length;

  return (
    <>
      <div style={{ ...styles.statGrid, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <Stat n={total} label="Nutzer" />
        <Stat n={newWeek} label="neu (7 Tage)" />
        <Stat n={activeToday} label="aktiv (24 Std.)" />
        <Stat n={ratingsToday} label="Bewertungen heute" />
      </div>

      <input
        style={styles.input} value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Name suchen…" aria-label="Nutzer suchen"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((u) => {
          const isBanned = banned.has(u.id);
          return (
            <div key={u.id} style={{ ...styles.card, padding: 12, display: "flex", gap: 10, alignItems: "center", ...(isBanned ? { opacity: 0.7 } : {}) }}>
              <Avatar name={u.username} path={u.avatar_path} size={36} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4 }}>
                <strong style={{ fontSize: 14, color: C.text }}>{u.username}</strong>
                {u.id === userId && <span style={{ color: C.muted }}> (du)</span>}
                {isBanned && <span style={{ color: C.errText, fontWeight: 700 }}> · gesperrt</span>}
                <div style={{ color: C.muted }}>
                  dabei seit {formatDate(u.created_at.slice(0, 10))} · {u.ratings} {Number(u.ratings) === 1 ? "Bewertung" : "Bewertungen"}
                </div>
                <div style={{ color: C.faint, fontSize: 12 }}>
                  zuletzt aktiv: {lastSeen(u)}
                </div>
              </div>
              {u.id !== userId && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {u.avatar_path && (
                    <button type="button" style={ms.remove} onClick={() => onClearAvatar(u)}>Bild entfernen</button>
                  )}
                  <button type="button" style={{ ...ms.remove, color: isBanned ? C.green : C.errText }} onClick={() => onBan(u, !isBanned)}>
                    {isBanned ? "Entsperren" : "Sperren"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <p style={styles.mutedText}>Niemand gefunden.</p>}
      </div>
    </>
  );
}

function Stat({ n, label }) {
  return (
    <div style={{ ...styles.statBox, padding: "10px 4px" }}>
      <div style={{ ...styles.statNum, fontSize: 20 }}>{n}</div>
      <div style={{ ...styles.statLabel, fontSize: 11 }}>{label}</div>
    </div>
  );
}

// Das jüngere von letzter Anmeldung und letzter Bewertung
function lastSeen(u) {
  const t = Math.max(...[u.last_sign_in, u.last_rating].filter(Boolean).map((x) => Date.parse(x)), 0);
  return t ? timeAgo(new Date(t).toISOString()) : "noch nie";
}

const ms = {
  count: {
    marginLeft: 8, display: "inline-block", minWidth: 20, padding: "1px 6px", borderRadius: 10,
    background: C.errText, color: "#fff", fontSize: 12, fontWeight: 800, textAlign: "center",
  },
  remove: {
    marginTop: 6, padding: 0, background: "none", border: "none", color: C.errText,
    fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
};
