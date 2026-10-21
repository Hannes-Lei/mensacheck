import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";
import { BADGES, computeStats, dishKey, formatAvg, formatDate, friendlyError } from "./helpers.js";
import { StarLine, Chip, Avatar, styles, C } from "./ui.jsx";
import Moderation from "./Moderation.jsx";

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

// ============================================================================
// Ansicht "Ich": Statistik, Abzeichen, Lieblingsgerichte, eigene Bewertungen
// ============================================================================
export default function ProfileTab({
  userId, username, canteens, favoritesList, onToggleFavorite, needLogin, onSignOut,
  theme, onThemeChange, active, avatarPath = null, onAvatarChange = () => {}, showToast = () => {},
}) {
  const [ratings, setRatings] = useState(null);
  const [dishAvg, setDishAvg] = useState({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!active || !userId) return;
    let cancelled = false;

    supabase
      .from("ratings")
      .select("id, canteen_id, meal_date, meal_name, stars, comment")
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
  const visibleRatings = showAll ? ratings || [] : (ratings || []).slice(0, 15);

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
        <div style={styles.statBox}><div style={styles.statNum}>{stats.ratings}</div><div style={styles.statLabel}>Bewertungen</div></div>
        <div style={styles.statBox}><div style={styles.statNum}>{stats.comments}</div><div style={styles.statLabel}>Kommentare</div></div>
        <div style={styles.statBox}><div style={styles.statNum}>{stats.canteens}</div><div style={styles.statLabel}>Mensen</div></div>
      </div>

      {/* Abzeichen */}
      <h3 style={styles.h3}>Abzeichen · {earned} von {BADGES.length}</h3>
      <div style={styles.badgeGrid}>
        {BADGES.map((b) => {
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
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{have} / {b.goal}</div>
                </>
              )}
            </div>
          );
        })}
      </div>

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

      {/* Eigene Bewertungen */}
      <h3 style={styles.h3}>Meine Bewertungen</h3>
      {ratings === null && <div style={styles.notice}>Wird geladen…</div>}
      {ratings?.length === 0 && (
        <div style={{ ...styles.empty, padding: "12px 8px" }}>Du hast noch nichts bewertet. Los geht's im Tab „Heute".</div>
      )}
      {visibleRatings.map((r) => (
        <div key={r.id} style={{ ...styles.rankRow, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.rankName}>{r.meal_name}</div>
            <div style={styles.rankMeta}>{canteenName(r.canteen_id)} · {formatDate(r.meal_date)}</div>
            {r.comment && <div style={{ fontSize: 13, color: C.soft, marginTop: 6, lineHeight: 1.4 }}>„{r.comment}"</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <StarLine value={r.stars} size={14} />
            <button
              type="button" onClick={() => removeRating(r)}
              style={{ ...styles.smallAction, color: C.muted, fontSize: 12 }}
              aria-label={`Bewertung für ${r.meal_name} entfernen`}
            >
              Entfernen
            </button>
          </div>
        </div>
      ))}
      {ratings && ratings.length > 15 && !showAll && (
        <button type="button" style={styles.extrasToggle} onClick={() => setShowAll(true)}>
          Alle {ratings.length} Bewertungen anzeigen
        </button>
      )}

      <DesignPicker theme={theme} onThemeChange={onThemeChange} />

      <Moderation active={active} userId={userId} showToast={showToast} />
    </main>
  );
}
