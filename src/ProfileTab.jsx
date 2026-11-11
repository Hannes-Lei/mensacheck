import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";
import { BADGES, computeStats, dishKey, formatAvg, formatDate, friendlyError, variantIcon, variantLabel, NO_TOPPING } from "./helpers.js";
import { StarLine, Chip, Avatar, styles, C } from "./ui.jsx";
import Moderation from "./Moderation.jsx";
import { AccountSheet } from "./Legal.jsx";
import { WrappedCard } from "./Wrapped.jsx";
import { PushSettings } from "./Push.jsx";

const BADGES_SHOWN = 6; // so viele Abzeichen sind ohne Aufklappen zu sehen

// Foto quadratisch zuschneiden und klein rechnen (256 × 256 Pixel, JPG).
// So bleibt jedes Profilbild nur ca. 20–40 KB groß.
async function toSquareJpeg(file, size = 256) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d").drawImage(
      img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size
    );
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Profilbild wählen (aus der Fotogalerie) oder entfernen
function AvatarPicker({ userId, username, avatarPath, onAvatarChange, showToast }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // dasselbe Bild später nochmal wählbar
    if (!file) return;
    setBusy(true);
    try {
      const blob = await toSquareJpeg(file);
      if (!blob) throw new Error("Das Bild konnte nicht gelesen werden.");
      const path = `${userId}/${Date.now()}.jpg`;
      const up = await supabase.storage.from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
      if (error) throw error;
      if (avatarPath) supabase.storage.from("avatars").remove([avatarPath]); // altes Bild weg
      onAvatarChange(path);
      showToast("Profilbild gespeichert.");
    } catch (err) {
      showToast(err?.message?.includes("decode") ? "Dieses Bildformat geht leider nicht." : friendlyError(err));
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
    if (error) showToast(friendlyError(error));
    else {
      supabase.storage.from("avatars").remove([avatarPath]);
      onAvatarChange(null);
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <button
        type="button" onClick={() => input.current?.click()} disabled={busy}
        aria-label="Profilbild wählen"
        style={{ padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: "50%", opacity: busy ? 0.5 : 1 }}
      >
        <Avatar name={username || "?"} path={avatarPath} size={64} />
      </button>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
        <button type="button" style={styles.smallAction} onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Wird gespeichert…" : avatarPath ? "📷 Profilbild ändern" : "📷 Profilbild wählen"}
        </button>
        {avatarPath && !busy && (
          <button type="button" style={{ ...styles.smallAction, color: C.muted }} onClick={remove}>Entfernen</button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
    </div>
  );
}

// Auswahl hell / dunkel
function DesignPicker({ theme, onThemeChange }) {
  return (
    <>
      <h3 style={styles.h3}>Darstellung</h3>
      <div style={styles.chipRow}>
        <Chip active={theme === "light"} onClick={() => onThemeChange("light")}>☀️ Hell</Chip>
        <Chip active={theme === "dark"} onClick={() => onThemeChange("dark")}>🌙 Dunkel</Chip>
      </div>
    </>
  );
}

// Eine Zeile "Meine Bewertung"
function RatingRow({ r, canteenName, onRemove }) {
  return (
    <div style={{ ...styles.rankRow, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.rankName}>{r.meal_name}</div>
        <div style={styles.rankMeta}>{canteenName(r.canteen_id)} · {formatDate(r.meal_date)}</div>
        {r.variant && r.variant !== NO_TOPPING && (
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{variantIcon(r.variant)} mit {variantLabel(r.variant)}</div>
        )}
        {r.comment && <div style={{ fontSize: 13, color: C.soft, marginTop: 6, lineHeight: 1.4 }}>„{r.comment}"</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <StarLine value={r.stars} size={14} />
        {onRemove && (
          <button
            type="button" onClick={() => onRemove(r)}
            style={{ ...styles.smallAction, color: C.muted, fontSize: 12 }}
            aria-label={`Bewertung für ${r.meal_name} entfernen`}
          >
            Entfernen
          </button>
        )}
      </div>
    </div>
  );
}

// Alle eigenen Bewertungen bzw. nur die mit Kommentar – eigenes Vollbild-Fenster, nach Monaten gruppiert
const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
function MyRatingsSheet({ ratings, initial, canteenName, onRemove, onClose }) {
  const [filter, setFilter] = useState(initial);
  const list = filter === "comments" ? ratings.filter((r) => r.comment) : ratings;
  const months = [];
  for (const r of list) {
    const key = r.meal_date.slice(0, 7);
    if (!months.length || months[months.length - 1].key !== key) months.push({ key, items: [] });
    months[months.length - 1].items.push(r);
  }
  const label = (key) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  return (
    <div style={{ ...styles.overlay, zIndex: 30, alignItems: "stretch" }} onClick={onClose}>
      <div role="dialog" aria-label="Meine Bewertungen" onClick={(e) => e.stopPropagation()}
        style={{ ...styles.sheet, borderRadius: 0, height: "100%", overflowY: "auto", paddingBottom: 40 }}>
        <div style={styles.sheetHead}>
          <h2 style={{ margin: 0, fontSize: 22 }}>{filter === "comments" ? "Meine Kommentare" : "Meine Bewertungen"}</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Schließen">×</button>
        </div>
        <div style={{ ...styles.chipRow, margin: "6px 0 4px" }}>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>Alle · {ratings.length}</Chip>
          <Chip active={filter === "comments"} onClick={() => setFilter("comments")}>Mit Kommentar · {ratings.filter((r) => r.comment).length}</Chip>
        </div>
        {months.map((m) => (
          <div key={m.key}>
            <h3 style={{ ...styles.h3, fontSize: 15, margin: "16px 0 6px" }}>{label(m.key)} · {m.items.length}</h3>
            {m.items.map((r) => <RatingRow key={r.id} r={r} canteenName={canteenName} onRemove={onRemove} />)}
          </div>
        ))}
        {list.length === 0 && <div style={{ ...styles.empty, padding: "12px 8px" }}>Noch nichts hier.</div>}
      </div>
    </div>
  );
}

// ============================================================================
// Ansicht "Ich": Statistik, Abzeichen, Lieblingsgerichte, eigene Bewertungen
// ============================================================================
export default function ProfileTab({
  userId, username, canteens, favoritesList, onToggleFavorite, needLogin, onSignOut, onDeleted = () => {}, friends = new Map(),
  theme, onThemeChange, active, avatarPath = null, onAvatarChange = () => {}, showToast = () => {}, onUsernameChange = () => {},
  openWrapped = null,
}) {
  const [ratings, setRatings] = useState(null);
  const [dishAvg, setDishAvg] = useState({});
  const [listOpen, setListOpen] = useState(null); // "all" | "comments"
  const [showAccount, setShowAccount] = useState(false);
  const [allBadges, setAllBadges] = useState(false);

  useEffect(() => {
    if (!active || !userId) return;
    let cancelled = false;

    supabase
      .from("ratings")
      .select("id, canteen_id, meal_date, meal_name, category, stars, comment, variant")
      .eq("user_id", userId)
      .order("meal_date", { ascending: false })
      .limit(1000)
      .then(({ data }) => !cancelled && setRatings(data || []));

    // Durchschnitt aller Zeiten pro Gericht (für die Lieblingsgerichte)
    supabase
      .rpc("get_ranking", { p_since: null, p_canteen: null, p_min_votes: 1 })
      .then(({ data }) => {
        if (cancelled) return;
        setDishAvg(Object.fromEntries((data || []).map((r) => [dishKey(r.canteen_id, r.meal_name), r])));
      });

    return () => { cancelled = true; };
  }, [active, userId]);

  const canteenName = (id) => canteens.find((c) => c.id === id)?.name || `Mensa ${id}`;

  async function removeRating(r) {
    const hint = r.comment ? " Dein Kommentar wird dabei auch gelöscht." : "";
    if (!window.confirm(`Deine Bewertung für „${r.meal_name}" vom ${formatDate(r.meal_date)} entfernen?${hint}`)) return;
    const previous = ratings;
    setRatings((list) => list.filter((x) => x.id !== r.id));
    const { error } = await supabase.from("ratings").delete().eq("id", r.id).eq("user_id", userId);
    if (error) setRatings(previous);
  }

  if (!userId) {
    return (
      <main style={styles.main}>
        <div style={styles.empty}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
          <p style={{ fontSize: 18, margin: "0 0 6px", color: C.text, fontWeight: 700 }}>Dein Mensa-Profil</p>
          <p style={{ margin: "0 0 16px" }}>
            Melde dich an, um deine Bewertungen, Lieblingsgerichte und Abzeichen zu sehen.
          </p>
          <button type="button" style={{ ...styles.primaryBtn, maxWidth: 260 }} onClick={needLogin}>
            Anmelden oder registrieren
          </button>
        </div>
        <DesignPicker theme={theme} onThemeChange={onThemeChange} />
      </main>
    );
  }

  const stats = computeStats(ratings || []);
  const earned = BADGES.filter((b) => stats[b.metric] >= b.goal).length;
  const progress = (b) => Math.min(1, (stats[b.metric] || 0) / b.goal);
  const badgeOrder = [...BADGES].sort((a, b) => (progress(b) === 1) - (progress(a) === 1) || (progress(a) === 1 ? 0 : progress(b) - progress(a)));


  return (
    <main style={styles.main}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={styles.h2}>Hallo {username || ""} 👋</h2>
        <button type="button" style={styles.userBtn} onClick={onSignOut}>Abmelden</button>
      </div>

      <AvatarPicker
        userId={userId} username={username} avatarPath={avatarPath}
        onAvatarChange={onAvatarChange} showToast={showToast}
      />

      {/* Zahlen */}
      <div style={styles.statGrid}>
        <button type="button" onClick={() => stats.ratings && setListOpen("all")} style={{ ...styles.statBox, cursor: "pointer", font: "inherit", color: "inherit" }}><div style={styles.statNum}>{stats.ratings}</div><div style={styles.statLabel}>Bewertungen</div></button>
        <button type="button" onClick={() => stats.comments && setListOpen("comments")} style={{ ...styles.statBox, cursor: "pointer", font: "inherit", color: "inherit" }}><div style={styles.statNum}>{stats.comments}</div><div style={styles.statLabel}>Kommentare</div></button>
        <div style={styles.statBox}><div style={styles.statNum}>{stats.canteens}</div><div style={styles.statLabel}>Mensen</div></div>
      </div>

      <WrappedCard ratings={ratings} userId={userId} friends={friends} canteenName={canteenName} openRequest={openWrapped} />

      {/* Abzeichen: erst die geschafften, dann die, die am nächsten dran sind */}
      <h3 style={styles.h3}>Abzeichen · {earned} von {BADGES.length}</h3>
      <div style={styles.badgeGrid}>
        {badgeOrder.slice(0, allBadges ? undefined : BADGES_SHOWN).map((b) => {
          const have = stats[b.metric];
          const done = have >= b.goal;
          return (
            <div key={b.id} style={{ ...styles.badgeCard, ...(done ? {} : styles.badgeLocked) }}>
              <div style={{ fontSize: 26 }}>{b.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>{b.name}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{b.text}</div>
              {!done && (
                <>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${Math.min(100, (have / b.goal) * 100)}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{Math.min(have, b.goal)} / {b.goal}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {BADGES.length > BADGES_SHOWN && (
        <button type="button" style={{ ...styles.ghostBtn, width: "100%", marginTop: 8 }} onClick={() => setAllBadges((v) => !v)}>
          {allBadges ? "Weniger anzeigen" : `Alle ${BADGES.length} Abzeichen ansehen`}
        </button>
      )}

      {/* Lieblingsgerichte */}
      <h3 style={styles.h3}>❤️ Lieblingsgerichte</h3>
      {favoritesList.length === 0 ? (
        <div style={{ ...styles.empty, padding: "12px 8px" }}>
          Tippe bei einem Gericht auf 🤍, um es dir zu merken. Wenn es wieder auf dem Speiseplan steht, siehst du es sofort.
        </div>
      ) : (
        favoritesList.map((f) => {
          const avg = dishAvg[dishKey(f.canteen_id, f.meal_name)];
          return (
            <div key={dishKey(f.canteen_id, f.meal_name)} style={styles.rankRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.rankName}>{f.meal_name}</div>
                <div style={styles.rankMeta}>
                  {canteenName(f.canteen_id)}
                  {avg ? ` · Ø ${formatAvg(avg.avg_stars)} aus ${avg.votes} ${avg.votes === 1 ? "Stimme" : "Stimmen"}` : ""}
                </div>
              </div>
              <button
                type="button" style={styles.heartBtn} aria-label="Aus Lieblingsgerichten entfernen"
                onClick={() => onToggleFavorite(f.canteen_id, f.meal_name)}
              >
                ❤️
              </button>
            </div>
          );
        })
      )}

      {/* Eigene Bewertungen: nur kurz, der Rest in einem eigenen Fenster */}
      <h3 style={styles.h3}>Meine Bewertungen</h3>
      {ratings === null && <div style={styles.notice}>Wird geladen…</div>}
      {ratings?.length === 0 && (
        <div style={{ ...styles.empty, padding: "12px 8px" }}>Du hast noch nichts bewertet. Los geht's im Tab „Heute".</div>
      )}
      {(ratings || []).slice(0, 3).map((r) => <RatingRow key={r.id} r={r} canteenName={canteenName} />)}
      {ratings?.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" style={{ ...styles.ghostBtn, flex: 1 }} onClick={() => setListOpen("all")}>
            ⭐ Alle ({ratings.length})
          </button>
          <button type="button" style={{ ...styles.ghostBtn, flex: 1 }} onClick={() => setListOpen("comments")} disabled={!stats.comments}>
            💬 Kommentare ({stats.comments})
          </button>
        </div>
      )}
      {listOpen && (
        <MyRatingsSheet
          ratings={ratings || []} initial={listOpen} canteenName={canteenName}
          onRemove={removeRating} onClose={() => setListOpen(null)}
        />
      )}

      <PushSettings userId={userId} showToast={showToast} />

      <DesignPicker theme={theme} onThemeChange={onThemeChange} />

      <Moderation active={active} userId={userId} showToast={showToast} canteenName={canteenName} />

      {/* ganz unten, bewusst unauffällig */}
      <div style={{ textAlign: "center", marginTop: 28 }}>
        <button
          type="button" onClick={() => setShowAccount(true)}
          style={{ background: "none", border: "none", color: C.faint, fontSize: 13, textDecoration: "underline", cursor: "pointer", padding: 6 }}
        >
          Konto & Daten
        </button>
      </div>
      {showAccount && (
        <AccountSheet
          userId={userId} username={username} showToast={showToast} onUsernameChange={onUsernameChange}
          onClose={() => setShowAccount(false)}
          onDeleted={() => { setShowAccount(false); onDeleted(); }}
        />
      )}
    </main>
  );
}
