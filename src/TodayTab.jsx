import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase.js";
import {
  todayBerlin, formatPrice, formatAvg, dayLabel, timeAgo, friendlyError, dishKey,
} from "./helpers.js";
import { Stars, Chip, DietBadge, styles, C } from "./ui.jsx";

// ============================================================================
// Ansicht "Heute": Speiseplan, Bewerten, Kommentieren, Favoriten
// ============================================================================

// ---- Kommentare zu einem Gericht ------------------------------------------
function CommentList({ canteenId, date, mealName, refreshKey }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("ratings")
      .select("id, stars, comment, created_at, profiles(username)")
      .eq("canteen_id", canteenId)
      .eq("meal_date", date)
      .eq("meal_name", mealName)
      .not("comment", "is", null)
      .neq("comment", "")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => !cancelled && setItems(data || []));
    return () => { cancelled = true; };
  }, [canteenId, date, mealName, refreshKey]);

  if (items === null) return <p style={styles.mutedText}>Kommentare werden geladen…</p>;
  if (items.length === 0) return <p style={styles.mutedText}>Noch keine Kommentare.</p>;

  return (
    <ul style={styles.commentList}>
      {items.map((c) => (
        <li key={c.id} style={styles.comment}>
          <div style={styles.commentHead}>
            <strong>{c.profiles?.username || "Jemand"}</strong>
            <span style={{ color: C.gold }}>{"★".repeat(c.stars)}</span>
            <span style={styles.mutedText}>{timeAgo(c.created_at)}</span>
          </div>
          <p style={{ margin: "2px 0 0", lineHeight: 1.4 }}>{c.comment}</p>
        </li>
      ))}
    </ul>
  );
}

// ---- Karte für ein Gericht -------------------------------------------------
function MealCard({
  meal: m, stats, mine, isFavorite, canRate, isFuture,
  onRate, onComment, onFavorite, needLogin, canteenId, date, compact = false,
}) {
  const [showAllergens, setShowAllergens] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleRate(stars) {
    if (!canRate) return needLogin();
    onRate(m, stars);
  }

  function startComment() {
    if (!canRate) return needLogin();
    setDraft(mine?.comment || "");
    setEditing(true);
  }

  async function saveComment() {
    setSaving(true);
    const ok = await onComment(m, draft.trim());
    setSaving(false);
    if (ok) {
      setEditing(false);
      setShowComments(true);
      setRefreshKey((k) => k + 1);
    }
  }

  const commentCount = stats?.comments || 0;

  return (
    <article style={{ ...styles.card, ...(compact ? styles.cardCompact : {}) }}>
      <div style={styles.cardTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.metaRow}>
            <span style={styles.category}>{m.category}</span>
            <DietBadge diet={m.diet} />
          </div>
          <h3 style={{ ...styles.mealName, ...(compact ? { fontSize: 15 } : {}) }}>{m.name}</h3>
          {m.sides.length > 0 && <p style={styles.sides}>mit {m.sides.join(", ")}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {formatPrice(m.price) && (
            <div style={styles.price}>
              {formatPrice(m.price)}
              <span style={styles.priceLabel}>Studierende</span>
            </div>
          )}
          <button
            type="button" style={styles.heartBtn}
            onClick={() => (canRate ? onFavorite(m) : needLogin())}
            aria-label={isFavorite ? "Aus Lieblingsgerichten entfernen" : "Als Lieblingsgericht merken"}
            title={isFavorite ? "Lieblingsgericht" : "Als Lieblingsgericht merken"}
          >
            {isFavorite ? "❤️" : "🤍"}
          </button>
        </div>
      </div>

      {m.allergens.length > 0 && (
        <button type="button" onClick={() => setShowAllergens((s) => !s)} style={styles.smallToggle}>
          {showAllergens ? `Allergene: ${m.allergens.join(", ")}` : "Allergene anzeigen"}
        </button>
      )}

      <div style={styles.rateRow}>
        <Stars value={mine?.stars || 0} onRate={handleRate} size={compact ? 22 : 26} disabled={isFuture} />
        <div style={{ fontSize: 14 }}>
          {stats?.votes > 0 ? (
            <>
              <strong>{formatAvg(stats.avg_stars)}</strong>
              <span style={{ color: C.muted }}> · {stats.votes} {stats.votes === 1 ? "Stimme" : "Stimmen"}</span>
            </>
          ) : (
            <span style={{ color: C.faint }}>{isFuture ? "Bewertbar ab dem Tag" : "Noch keine Bewertung"}</span>
          )}
        </div>
      </div>

      {!isFuture && (
        <div style={styles.commentBar}>
          {mine?.stars > 0 && !editing && (
            <button type="button" style={styles.smallAction} onClick={startComment}>
              {mine.comment ? "✎ Kommentar bearbeiten" : "+ Kommentar schreiben"}
            </button>
          )}
          {commentCount > 0 && (
            <button type="button" style={styles.smallAction} onClick={() => setShowComments((s) => !s)}>
              💬 {commentCount} {commentCount === 1 ? "Kommentar" : "Kommentare"} {showComments ? "▴" : "▾"}
            </button>
          )}
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 10 }}>
          <textarea
            style={styles.textarea} value={draft} onChange={(e) => setDraft(e.target.value)}
            maxLength={500} rows={3} placeholder="Wie war's? Portion, Geschmack, Preis-Leistung …" autoFocus
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button type="button" style={styles.ghostBtn} onClick={() => setEditing(false)}>Abbrechen</button>
            <button type="button" style={styles.smallPrimary} onClick={saveComment} disabled={saving}>
              {saving ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {showComments && <CommentList canteenId={canteenId} date={date} mealName={m.name} refreshKey={refreshKey} />}
    </article>
  );
}

// ---- Die Ansicht -----------------------------------------------------------
export default function TodayTab({
  canteens, canteenId, onCanteenChange, userId, favorites, onToggleFavorite, needLogin, showToast,
}) {
  const today = todayBerlin();

  const [days, setDays] = useState([]);
  const [date, setDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dietFilter, setDietFilter] = useState("alle");
  const [showExtras, setShowExtras] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  const [stats, setStats] = useState({});
  const [mine, setMine] = useState({});

  // Speiseplan laden
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/mensa?canteen=${canteenId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Fehler beim Laden.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const upcoming = (data.days || []).filter((d) => d.date >= today && !d.closed && d.meals.length > 0);
        setDays(upcoming);
        setDate(upcoming.some((d) => d.date === today) ? today : upcoming[0]?.date || null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [canteenId, today]);

  // Bewertungen für Mensa + Tag laden
  const loadRatings = useCallback(async () => {
    if (!date) return;
    const statsReq = supabase
      .from("meal_stats")
      .select("meal_name, avg_stars, votes, comments")
      .eq("canteen_id", canteenId)
      .eq("meal_date", date);
    const mineReq = userId
      ? supabase.from("ratings").select("meal_name, stars, comment")
          .eq("user_id", userId).eq("canteen_id", canteenId).eq("meal_date", date)
      : Promise.resolve({ data: [] });
    const [{ data: s }, { data: m }] = await Promise.all([statsReq, mineReq]);
    setStats(Object.fromEntries((s || []).map((r) => [r.meal_name, r])));
    setMine(Object.fromEntries((m || []).map((r) => [r.meal_name, r])));
  }, [canteenId, date, userId]);

  useEffect(() => { loadRatings(); }, [loadRatings]);
  useEffect(() => {
    const t = setInterval(loadRatings, 60000);
    return () => clearInterval(t);
  }, [loadRatings]);

  async function saveRating(meal, stars, comment) {
    const { error: err } = await supabase.from("ratings").upsert(
      {
        user_id: userId, canteen_id: canteenId, meal_date: date, meal_name: meal.name,
        category: meal.category, price: meal.price, stars, comment: comment || null,
      },
      { onConflict: "user_id,canteen_id,meal_date,meal_name" }
    );
    if (err) { showToast(friendlyError(err)); return false; }
    return true;
  }

  async function rate(meal, stars) {
    const before = mine[meal.name];
    setMine((p) => ({ ...p, [meal.name]: { ...before, meal_name: meal.name, stars } }));
    const ok = await saveRating(meal, stars, before?.comment);
    if (!ok) setMine((p) => ({ ...p, [meal.name]: before }));
    loadRatings();
  }

  async function comment(meal, text) {
    const current = mine[meal.name];
    if (!current?.stars) { showToast("Bitte zuerst Sterne vergeben."); return false; }
    const ok = await saveRating(meal, current.stars, text);
    if (ok) await loadRatings();
    return ok;
  }

  const currentDay = days.find((d) => d.date === date);
  const isFuture = date > today;

  const { mains, extras, favToday } = useMemo(() => {
    const all = currentDay?.meals || [];
    const meals = all.filter((m) => {
      if (dietFilter === "vegan") return m.diet === "vegan";
      if (dietFilter === "vegetarisch") return m.diet === "vegan" || m.diet === "vegetarisch";
      return true;
    });
    const sorted = sortByRating
      ? [...meals].sort((a, b) =>
          (stats[b.name]?.avg_stars || 0) - (stats[a.name]?.avg_stars || 0) ||
          (stats[b.name]?.votes || 0) - (stats[a.name]?.votes || 0))
      : meals;
    return {
      mains: sorted.filter((m) => m.isMain),
      extras: sorted.filter((m) => !m.isMain),
      favToday: all.filter((m) => favorites.has(dishKey(canteenId, m.name))),
    };
  }, [currentDay, dietFilter, sortByRating, stats, favorites, canteenId]);

  const cardProps = (m, compact = false) => ({
    meal: m,
    stats: stats[m.name],
    mine: mine[m.name],
    isFavorite: favorites.has(dishKey(canteenId, m.name)),
    canRate: !!userId,
    isFuture,
    onRate: rate,
    onComment: comment,
    onFavorite: (meal) => onToggleFavorite(canteenId, meal.name),
    needLogin,
    canteenId,
    date,
    compact,
  });

  return (
    <>
      <div style={styles.controls}>
        <select
          aria-label="Mensa auswählen" value={canteenId}
          onChange={(e) => onCanteenChange(Number(e.target.value))} style={styles.select}
        >
          {canteens.length === 0 && <option value={canteenId}>Mensen werden geladen…</option>}
          {canteens.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {days.length > 0 && (
          <div style={styles.chipRow}>
            {days.map((d) => (
              <Chip key={d.date} active={d.date === date} onClick={() => setDate(d.date)}>
                {dayLabel(d.date, today)}
              </Chip>
            ))}
          </div>
        )}

        <div style={styles.chipRow}>
          <Chip active={dietFilter === "alle"} onClick={() => setDietFilter("alle")}>Alle</Chip>
          <Chip active={dietFilter === "vegetarisch"} onClick={() => setDietFilter("vegetarisch")}>Vegetarisch</Chip>
          <Chip active={dietFilter === "vegan"} onClick={() => setDietFilter("vegan")}>Vegan</Chip>
          <span style={{ flex: 1 }} />
          <Chip active={sortByRating} onClick={() => setSortByRating((s) => !s)}>
            {sortByRating ? "★ Beste zuerst" : "★ Sortieren"}
          </Chip>
        </div>
      </div>

      <main style={styles.main}>
        {!userId && !loading && !error && days.length > 0 && (
          <button type="button" style={styles.hint} onClick={needLogin}>
            <strong>Mitbewerten?</strong> Melde dich an, dann sehen alle deine Sterne und Kommentare.
          </button>
        )}

        {favToday.length > 0 && !loading && (
          <div style={styles.favBanner}>
            ❤️ <strong>{date === today ? "Heute" : "An diesem Tag"} gibt's dein Lieblingsgericht:</strong>{" "}
            {favToday.map((m) => m.name).join(", ")}
          </div>
        )}

        {loading && <div style={styles.notice}>Speiseplan wird geladen…</div>}
        {!loading && error && <div style={{ ...styles.notice, ...styles.noticeError }}>{error} Versuch es gleich noch einmal.</div>}

        {!loading && !error && days.length === 0 && (
          <div style={styles.empty}>
            <p style={{ fontSize: 18, margin: "0 0 4px", color: C.text }}>Kein Speiseplan verfügbar</p>
            <p style={{ margin: 0 }}>Diese Mensa hat in den nächsten Tagen nichts eingetragen.</p>
          </div>
        )}

        {!loading && !error && currentDay && mains.length === 0 && extras.length === 0 && (
          <div style={styles.empty}>Für diesen Filter gibt es heute nichts.</div>
        )}

        {!loading && !error && mains.map((m) => <MealCard key={m.id} {...cardProps(m)} />)}

        {!loading && !error && extras.length > 0 && (
          <>
            <button type="button" onClick={() => setShowExtras((s) => !s)} style={styles.extrasToggle}>
              {showExtras ? "▾" : "▸"} Beilagen, Desserts & Smoothies ({extras.length})
            </button>
            {showExtras && extras.map((m) => <MealCard key={m.id} {...cardProps(m, true)} />)}
          </>
        )}
      </main>
    </>
  );
}
