import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { formatDate, timeAgo, friendlyError } from "./helpers.js";
import { Avatar, styles, C } from "./ui.jsx";

// ============================================================================
// Bereich "Moderation" im Tab Ich – erscheint nur für Moderatoren.
// Ob jemand Moderator ist, entscheidet die Datenbank (Tabelle moderators),
// nicht die App. Alle Daten kommen über die Funktion mod_users().
// ============================================================================

export default function Moderation({ active, userId, showToast }) {
  const [isMod, setIsMod] = useState(false);
  const [users, setUsers] = useState(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Bin ich Moderator? (bei allen anderen passiert hier einfach nichts)
  useEffect(() => {
    if (!userId) { setIsMod(false); return; }
    supabase.rpc("is_moderator").then(({ data }) => setIsMod(data === true));
  }, [userId]);

  async function load() {
    const { data, error } = await supabase.rpc("mod_users");
    if (error) { showToast(friendlyError(error)); return; }
    setUsers(data || []);
  }

  useEffect(() => { if (isMod && active && open) load(); }, [isMod, active, open]); // eslint-disable-line

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users || []).filter((u) => !q || u.username.toLowerCase().includes(q));
  }, [users, query]);

  if (!isMod) return null;

  const today = new Date(Date.now() - 24 * 3600 * 1000);
  const total = users?.length ?? 0;
  const activeToday = (users || []).filter((u) => u.last_sign_in && new Date(u.last_sign_in) > today
    || u.last_rating && new Date(u.last_rating) > today).length;
  const ratingsToday = (users || []).reduce((n, u) => n + Number(u.ratings_today || 0), 0);
  const newWeek = (users || []).filter((u) => new Date(u.created_at) > new Date(Date.now() - 7 * 24 * 3600 * 1000)).length;

  async function clearAvatar(u) {
    if (!window.confirm(`Profilbild von „${u.username}" entfernen?`)) return;
    const { error } = await supabase.rpc("mod_clear_avatar", { p_user: u.id });
    if (error) showToast(friendlyError(error));
    else { showToast("Profilbild entfernt."); load(); }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" style={{ ...styles.extrasToggle, marginTop: 8 }} onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} 🛡️ Moderation
      </button>

      {open && users === null && <div style={styles.notice}>Wird geladen…</div>}

      {open && users && (
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
            {list.map((u) => (
              <div key={u.id} style={{ ...styles.card, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
                <Avatar name={u.username} path={u.avatar_path} size={36} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4 }}>
                  <strong style={{ fontSize: 14, color: C.text }}>{u.username}</strong>
                  {u.id === userId && <span style={{ color: C.muted }}> (du)</span>}
                  <div style={{ color: C.muted }}>
                    dabei seit {formatDate(u.created_at.slice(0, 10))} · {u.ratings} {Number(u.ratings) === 1 ? "Bewertung" : "Bewertungen"}
                  </div>
                  <div style={{ color: C.faint, fontSize: 12 }}>
                    zuletzt aktiv: {lastSeen(u)}
                  </div>
                </div>
                {u.avatar_path && u.id !== userId && (
                  <button type="button" style={{ ...styles.smallAction, color: C.errText, fontSize: 12 }} onClick={() => clearAvatar(u)}>
                    Bild entfernen
                  </button>
                )}
              </div>
            ))}
            {list.length === 0 && <p style={styles.mutedText}>Niemand gefunden.</p>}
          </div>
        </>
      )}
    </section>
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
