import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase.js";
import {
  todayBerlin, formatPrice, formatAvg, dayLabel, timeAgo, friendlyError, dishKey,
} from "./helpers.js";
import { Stars, Chip, DietBadge, formatStars, styles, C } from "./ui.jsx";
import { CommentItem, THREAD_SELECT } from "./Interactions.jsx";

// ============================================================================
// Ansicht "Heute": Speiseplan, Bewerten, Kommentieren, Favoriten
// ============================================================================

// ---- Kommentare zu einem Gericht ------------------------------------------
function CommentList({ canteenId, date, mealName, refreshKey, ...thread }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("ratings")
      .select(THREAD_SELECT)
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
      {items.map((c) => <CommentItem key={c.id} item={c} {...thread} />)}
    </ul>
  );
}

// ---- Karte für ein Gericht -------------------------------------------------
function MealCard({
  meal: m, stats, mine, isFavorite, canRate, isFuture, friendRatings = [],
  onRate, onComment, onRemove, onFavorite, onShare, needLogin, canteenId, date, compact = false,
  thread,
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
    <article data-meal={m.name} style={{ ...styles.card, ...(compact ? styles.cardCompact : {}), scrollMarginTop: 200 }}>
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
        <Stars value={mine?.stars || 0} onRate={handleRate} size={compact ? 24 : 28} disabled={isFuture} />
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

      {friendRatings.length > 0 && (
        <div style={{ fontSize: 13, color: C.soft, marginTop: 6, lineHeight: 1.5 }}>
          👥{" "}
          {friendRatings.map((f, i) => (
            <span key={f.name} style={{ whiteSpace: "nowrap" }}>
              {i > 0 && " · "}<strong>{f.name}</strong> <span style={{ color: C.gold }}>★</span> {formatStars(f.stars)}
            </span>
          ))}
        </div>
      )}

      <div style={styles.commentBar}>
        {!isFuture && mine?.stars > 0 && !editing && (
            <button type="button" style={styles.smallAction} onClick={startComment}>
              {mine.comment ? "✎ Kommentar bearbeiten" : "+ Kommentar schreiben"}
            </button>
          )}
        {!isFuture && commentCount > 0 && (
            <button type="button" style={styles.smallAction} onClick={() => setShowComments((s) => !s)}>
              💬 {commentCount} {commentCount === 1 ? "Kommentar" : "Kommentare"} {showComments ? "▴" : "▾"}
            </button>
          )}
        {!editing && (
          <button type="button" style={styles.smallAction} onClick={() => onShare(m)}>
            ↗ Teilen
          </button>
        )}
        {!isFuture && mine?.stars > 0 && !editing && (
            <button
              type="button" style={{ ...styles.smallAction, color: C.muted, marginLeft: "auto" }}
              onClick={() => { onRemove(m); setShowComments(false); setRefreshKey((k) => k + 1); }}
            >
              Bewertung entfernen
            </button>
          )}
      </div>

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

      {showComments && <CommentList canteenId={canteenId} date={date} mealName={m.name} refreshKey={refreshKey} {...thread} />}
    </article>
  );
}


// Ein Eintrag aus dem Archiv (Tabelle menu_items) als Gericht für die Anzeige
function archivedMeal(r) {
  return {
    id: `archiv-${r.meal_name}`,
    name: r.meal_name,
    category: r.category || "",
    price: r.price,
    sides: r.sides || [],
    allergens: r.allergens || [],
    diet: r.diet || null,
    isMain: r.is_main ?? true,
  };
}

// Die heutigen Gerichte in Supabase merken (Tabelle menu_items). Schon
// gemerkte Gerichte werden übersprungen, Fehler stören die Anzeige nicht.
function rememberToday(canteenId, day) {
  if (!day) return;
  const rows = new Map();
  for (const m of day.meals) {
    if (rows.has(m.name)) continue;
    rows.set(m.name, {
      canteen_id: canteenId,
      meal_date: day.date,
      meal_name: m.name,
      category: m.category,
      price: m.price,
      sides: m.sides,
      allergens: m.allergens,
      diet: m.diet,
      is_main: m.isMain,
    });
  }
  supabase
    .from("menu_items")
    .upsert([...rows.values()], { onConflict: "canteen_id,meal_date,meal_name", ignoreDuplicates: true })
    .then(({ error }) => error && console.warn("Gerichte merken:", error.message));
}

function matchesDiet(m, dietFilter) {
  if (dietFilter === "vegan") return m.diet === "vegan";
  if (dietFilter === "vegetarisch") return m.diet === "vegan" || m.diet === "vegetarisch";
  return true;
}

// ---- Die Ansicht -----------------------------------------------------------
export default function TodayTab({
  canteens, canteenId, onCanteenChange, userId, username, friends, favorites, onToggleFavorite,
  needLogin, showToast, onActivity = () => {},
}) {
  const today = todayBerlin();

  const [days, setDays] = useState([]);           // kommende Tage laut OpenMensa
  const [date, setDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dietFilter, setDietFilter] = useState("alle");
  const [showExtras, setShowExtras] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  const [stats, setStats] = useState({});
  const [mine, setMine] = useState({});
  const [archive, setArchive] = useState(null);    // gemerkte Gerichte des Tages
  const [ratedMeals, setRatedMeals] = useState({}); // bewertete Gerichte des Tages
  const [dayRatings, setDayRatings] = useState([]);  // wer hat was bewertet (für Freunde-Zeile)

  // 1) Aktueller Speiseplan laden – und die heutigen Gerichte merken
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
        rememberToday(canteenId, upcoming.find((d) => d.date === today));
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [canteenId, today]);

  // 2) Bewertungen + gemerkte Gerichte für Mensa und Tag laden
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
    const ratedReq = supabase
      .from("ratings")
      .select("meal_name, category, price, user_id, stars")
      .eq("canteen_id", canteenId)
      .eq("meal_date", date)
      .limit(1000);
    const archiveReq = supabase
      .from("menu_items")
      .select("meal_name, category, price, sides, allergens, diet, is_main")
      .eq("canteen_id", canteenId)
      .eq("meal_date", date)
      .order("first_seen", { ascending: true });

    const [{ data: s }, { data: m }, { data: rated }, { data: arch }] =
      await Promise.all([statsReq, mineReq, ratedReq, archiveReq]);

    setStats(Object.fromEntries((s || []).map((r) => [r.meal_name, r])));
    setMine(Object.fromEntries((m || []).map((r) => [r.meal_name, r])));
    const known = {};
    for (const r of rated || []) known[r.meal_name] ??= r;
    setRatedMeals(known);
    setDayRatings(rated || []);
    setArchive(arch || []);
  }, [canteenId, date, userId]);

  // Beim Wechsel von Mensa oder Tag alte Daten nicht kurz falsch anzeigen
  useEffect(() => { setStats({}); setMine({}); setRatedMeals({}); setDayRatings([]); setArchive(null); }, [canteenId, date]);

  // Welche Freunde haben welches Gericht bewertet?
  const friendsByMeal = useMemo(() => {
    const out = {};
    for (const r of dayRatings) {
      if (r.user_id === userId || !friends?.has(r.user_id)) continue;
      (out[r.meal_name] ||= []).push({ name: friends.get(r.user_id), stars: r.stars });
    }
    return out;
  }, [dayRatings, friends, userId]);
  useEffect(() => { loadRatings(); }, [loadRatings]);
  useEffect(() => {
    const t = setInterval(loadRatings, 60000);
    return () => clearInterval(t);
  }, [loadRatings]);

  // 3) Bewerten, Kommentieren, Entfernen
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
    else if (!before?.stars) onActivity(); // neue Bewertung -> vielleicht neues Abzeichen
    loadRatings();
  }

  async function removeRating(meal) {
    const before = mine[meal.name];
    const hint = before?.comment ? " Dein Kommentar wird dabei auch gelöscht." : "";
    if (!window.confirm(`Deine Bewertung für „${meal.name}" entfernen?${hint}`)) return;
    setMine((p) => { const n = { ...p }; delete n[meal.name]; return n; });
    const { error: err } = await supabase.from("ratings").delete()
      .eq("user_id", userId).eq("canteen_id", canteenId)
      .eq("meal_date", date).eq("meal_name", meal.name);
    if (err) {
      showToast(friendlyError(err));
      setMine((p) => ({ ...p, [meal.name]: before }));
    } else {
      showToast("Bewertung entfernt.");
    }
    loadRatings();
  }

  async function comment(meal, text) {
    const current = mine[meal.name];
    if (!current?.stars) { showToast("Bitte zuerst Sterne vergeben."); return false; }
    const ok = await saveRating(meal, current.stars, text);
    if (ok) { await loadRatings(); if (text && !current.comment) onActivity(); }
    return ok;
  }

  // Gericht teilen: Teilen-Menü des Handys, sonst Text kopieren
  async function share(meal) {
    const s = stats[meal.name];
    const mensa = canteens.find((c) => c.id === canteenId)?.name || "Mensa";
    const when = date === today ? "Heute" : `Am ${dayLabel(date, today).replace(" · ", ", ")}`;
    const rating = s?.votes > 0
      ? ` ⭐ ${formatAvg(s.avg_stars)} (${s.votes} ${s.votes === 1 ? "Stimme" : "Stimmen"})`
      : meal.price != null ? ` für ${formatPrice(meal.price)}` : "";
    const text = `${when} in der ${mensa}: ${meal.name}${rating}. Kommt wer mit? 🍽️`;
    const url = window.location.origin;

    if (navigator.share) {
      try { await navigator.share({ title: "MensaCheck", text, url }); } catch { /* abgebrochen */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast("Text kopiert – jetzt z.B. in WhatsApp einfügen.");
    } catch {
      showToast("Teilen ist auf diesem Gerät leider nicht möglich.");
    }
  }

  // 4) Was wird angezeigt?
  const currentDay = days.find((d) => d.date === date);
  const isFuture = date > today;
  const dayLoading = loading;

  const { mains, extras, favToday } = useMemo(() => {
    const plan = currentDay?.meals || [];

    // Heute zeigen wir alle Gerichte, die an dem Tag irgendwann auf dem
    // Plan standen. Für Tage in der Zukunft gilt nur der aktuelle Plan.
    let all = plan;
    if (!isFuture) {
      const list = [...plan];
      const seen = new Set(plan.map((m) => m.name));
      // Nicht mehr gelistete Gerichte hinter ihre Kategorie einsortieren
      const add = (m) => {
        if (seen.has(m.name)) return;
        seen.add(m.name);
        let i = -1;
        list.forEach((x, idx) => { if (x.category === m.category) i = idx; });
        if (i >= 0) list.splice(i + 1, 0, m);
        else list.push(m);
      };
      (archive || []).forEach((r) => add(archivedMeal(r)));
      Object.values(ratedMeals).forEach((r) =>
        add(archivedMeal({ meal_name: r.meal_name, category: r.category, price: r.price })));
      all = list;
    }

    const filtered = all.filter((m) => matchesDiet(m, dietFilter));
    const sorted = sortByRating
      ? [...filtered].sort((a, b) =>
          (stats[b.name]?.avg_stars || 0) - (stats[a.name]?.avg_stars || 0) ||
          (stats[b.name]?.votes || 0) - (stats[a.name]?.votes || 0))
      : filtered;

    return {
      mains: sorted.filter((m) => m.isMain),
      extras: sorted.filter((m) => !m.isMain),
      favToday: all.filter((m) => favorites.has(dishKey(canteenId, m.name))),
    };
  }, [currentDay, archive, ratedMeals, isFuture, dietFilter, sortByRating, stats, favorites, canteenId]);

  // Tagessieger: bestbewertetes Hauptgericht (bei Gleichstand mehr Stimmen)
  const winner = isFuture ? null : mains
    .filter((m) => stats[m.name]?.votes > 0)
    .sort((a, b) =>
      stats[b.name].avg_stars - stats[a.name].avg_stars || stats[b.name].votes - stats[a.name].votes)[0];

  function jumpTo(name) {
    const el = [...document.querySelectorAll("article[data-meal]")].find((a) => a.dataset.meal === name);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cardProps = (m, compact = false) => ({
    meal: m,
    stats: stats[m.name],
    mine: mine[m.name],
    isFavorite: favorites.has(dishKey(canteenId, m.name)),
    canRate: !!userId,
    isFuture,
    onRate: rate,
    onComment: comment,
    onRemove: removeRating,
    onShare: share,
    friendRatings: friendsByMeal[m.name] || [],
    thread: { userId, username, friends, needLogin, showToast },
    onFavorite: (meal) => onToggleFavorite(canteenId, meal.name),
    needLogin,
    canteenId,
    date,
    compact,
  });

  const nothingAtAll = !loading && !error && days.length === 0;

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
        {!userId && !loading && !error && date && (
          <button type="button" style={styles.hint} onClick={needLogin}>
            <strong>Mitbewerten?</strong> Melde dich an, dann sehen alle deine Sterne und Kommentare.
          </button>
        )}

        {favToday.length > 0 && !dayLoading && (
          <div style={styles.favBanner}>
            ❤️ <strong>
              {date === today ? "Heute gibt's" : "An diesem Tag gibt's"} dein Lieblingsgericht:
            </strong>{" "}
            {favToday.map((m) => m.name).join(", ")}
          </div>
        )}

        {winner && !dayLoading && (
          <button type="button" style={styles.winner} onClick={() => jumpTo(winner.name)}>
            <span style={{ fontSize: 30, lineHeight: 1 }}>🏆</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={styles.winnerLabel}>{date === today ? "Heute vorn" : "An diesem Tag vorn"}</span>
              <span style={{ display: "block", fontSize: 16, fontWeight: 800, lineHeight: 1.3, marginTop: 2 }}>{winner.name}</span>
            </span>
            <span style={{ textAlign: "right", flexShrink: 0 }}>
              <span style={{ display: "block", fontSize: 20, fontWeight: 800 }}>{formatAvg(stats[winner.name].avg_stars)} <span style={{ color: C.gold }}>★</span></span>
              <span style={{ fontSize: 12, color: C.muted }}>
                {stats[winner.name].votes} {stats[winner.name].votes === 1 ? "Stimme" : "Stimmen"}
              </span>
            </span>
          </button>
        )}

        {dayLoading && !error && !nothingAtAll && <div style={styles.notice}>Speiseplan wird geladen…</div>}
        {error && <div style={{ ...styles.notice, ...styles.noticeError }}>{error} Versuch es gleich noch einmal.</div>}

        {nothingAtAll && (
          <div style={styles.empty}>
            <p style={{ fontSize: 18, margin: "0 0 4px", color: C.text }}>Kein Speiseplan verfügbar</p>
            <p style={{ margin: 0 }}>Diese Mensa hat in den nächsten Tagen nichts eingetragen.</p>
          </div>
        )}

        {!dayLoading && !error && date && mains.length === 0 && extras.length === 0 && (
          <div style={styles.empty}>
            Für diesen Filter gibt es hier nichts.
          </div>
        )}

        {!dayLoading && !error && mains.map((m) => <MealCard key={m.id} {...cardProps(m)} />)}

        {!dayLoading && !error && extras.length > 0 && (
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
