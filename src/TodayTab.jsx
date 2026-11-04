import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import {
  todayBerlin, daysAgo, isWeekend, lastMensaDay, formatPrice, formatAvg, dayLabel, friendlyError, dishKey, dishName, sameDish, mealVariants, variantLabel, variantIcon, NO_TOPPING, nameHasMeat, shortDate, isPastaExtra, isPlaceholderMeal, cleanSidesAndAllergens, mealGroup,
} from "./helpers.js";
import { Stars, StarLine, Chip, DietBadge, Avatar, formatStars, styles, C, FONT_HEAD } from "./ui.jsx";
import { CommentItem, THREAD_SELECT } from "./Interactions.jsx";

// ============================================================================
// Ansicht "Heute": Speiseplan, Bewerten, Kommentieren, Favoriten
// ============================================================================

// ---- Kommentare zu einem Gericht (aus allen Tagen) ------------------------
function CommentList({ canteenId, date, mealName, dishes, refreshKey, ...thread }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("ratings")
      .select(THREAD_SELECT)
      .eq("canteen_id", canteenId)
      .in("dish", dishes?.length ? dishes : [dishName(mealName)])
      .not("comment", "is", null)
      .neq("comment", "")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("Kommentare:", error.message);
        setItems(error ? "fehler" : data || []);
      });
    return () => { cancelled = true; };
  }, [canteenId, mealName, (dishes || []).join("|"), refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items === null) return <p style={styles.mutedText}>Kommentare werden geladen…</p>;
  if (items === "fehler") return <p style={styles.mutedText}>Kommentare konnten nicht geladen werden.</p>;
  if (items.length === 0) return <p style={styles.mutedText}>Noch keine Kommentare.</p>;

  return (
    <ul style={styles.commentList}>
      {items.map((c) => (
        <CommentItem
          key={c.id} item={c} {...thread}
          dayNote={c.meal_date !== date ? `am ${shortDate(c.meal_date)}` : null}
        />
      ))}
    </ul>
  );
}

// Bewertung der anderen, gut sichtbar: große Zahl, Sterne, Anzahl Stimmen,
// darunter klein der Tag ("heute 4,5 · 3 Stimmen" bzw. "zuletzt am 13.10.")
function ScoreBar({ total, day, date, today, compact }) {
  const votes = (n) => `${n} ${n === 1 ? "Stimme" : "Stimmen"}`;
  if (!total?.votes) {
    return (
      <div style={{ ...scoreBox, ...scoreEmpty }}>
        <span style={{ fontSize: 15 }}>☆</span>
        <span>Noch keine Bewertung</span>
      </div>
    );
  }
  let sub = null;
  if (day?.votes > 0 && day.votes < total.votes) {
    sub = `${date === today ? "heute" : date === daysAgo(1) ? "gestern" : "an dem Tag"} ${formatAvg(day.avg_stars)} · ${votes(day.votes)}`;
  } else if (!(day?.votes > 0) && total.last_date) {
    sub = `zuletzt gegessen am ${shortDate(total.last_date)}`;
  }
  return (
    <div style={scoreBox} aria-label={`Bewertung ${formatAvg(total.avg_stars)} von 5, ${votes(total.votes)}`}>
      <span style={{ fontFamily: FONT_HEAD, fontSize: compact ? 22 : 26, fontWeight: 800, lineHeight: 1, color: C.text }}>
        {formatAvg(total.avg_stars)}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StarLine value={total.avg_stars} size={compact ? 13 : 15} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.soft }}>{votes(total.votes)}</span>
        </span>
        {sub && <span style={{ fontSize: 12, color: C.muted }}>{sub}</span>}
      </span>
    </div>
  );
}

const friendRow = {
  display: "flex", alignItems: "center", gap: 6, marginTop: 8, overflowX: "auto",
  scrollbarWidth: "none", WebkitOverflowScrolling: "touch", maxWidth: "100%",
};
const friendChip = {
  flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px 3px 4px",
  borderRadius: 14, background: C.card, border: `2px solid ${C.ink}`, fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap",
};
const scoreBox = { display: "flex", alignItems: "center", gap: 10, marginTop: 10 };
const scoreEmpty = { gap: 6, fontSize: 13, color: C.faint };

// ---- Karte für ein Gericht -------------------------------------------------
function MealCard({
  meal: m, stats, total, mine, isFavorite, canRate, isFuture, friendRatings = [],
  onRate, onComment, onRemove, onFavorite, onShare, onVariant, needLogin, canteenId, date, today, compact = false,
  thread, dishes,
}) {
  const [showAllergens, setShowAllergens] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Wok: Topping antippen (nochmal tippen = wieder ohne Topping)
  const variants = mealVariants(m);
  const [picked, setPicked] = useState(null);
  const variant = mine?.variant || picked;
  const sideList = variants ? m.sides.filter((x) => !variants.some((v) => v.value === x)) : m.sides;

  function handleRate(stars) {
    if (!canRate) return needLogin();
    onRate(m, stars, variant || null);
  }

  function pickVariant(v) {
    if (!canRate) return needLogin();
    const next = variant === v ? null : v;
    setPicked(next);
    if (mine?.stars) onVariant(m, next);
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

  const commentCount = total?.comments || 0;

  return (
    <article data-meal={m.name} style={{ ...styles.card, ...(compact ? styles.cardCompact : {}), scrollMarginTop: 200, minWidth: 0 }}>
      <div style={styles.cardTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.metaRow}>
            {m.category && <span style={styles.category}>{m.category}</span>}
            <DietBadge diet={m.diet} />
          </div>
          <h3 style={{ ...styles.mealName, ...(compact ? { fontSize: 15 } : {}) }}>{m.name}</h3>
          {/* beim Wok stehen die Toppings unten zur Auswahl, hier nur die übrigen Beilagen */}
          {sideList.length > 0 && <p style={styles.sides}>mit {sideList.join(", ")}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {formatPrice(m.price) && (
            <div style={styles.price}>
              {formatPrice(m.price)}
              <span style={styles.priceLabel}>Studierende</span>
              {m.toppingPrice != null && (
                <span style={{ ...styles.priceLabel, marginTop: 2, textTransform: "none", letterSpacing: 0 }}>mit Topping {formatPrice(m.toppingPrice)}</span>
              )}
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
          {showAllergens
            ? `${/pasta|pizza/i.test(m.category) ? "Allergene der ganzen Theke" : "Allergene"}: ${m.allergens.join(", ")}`
            : "Allergene anzeigen"}
        </button>
      )}

      <ScoreBar total={total} day={stats} date={date} today={today} compact={compact} />

      {variants && !isFuture && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 }} role="group" aria-label="Mit Topping?">
          <span style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginRight: 2 }}>Mit Topping?</span>
          {variants.map((v) => (
            <Chip key={v.value} active={variant === v.value} onClick={() => pickVariant(v.value)} aria-pressed={variant === v.value}>
              {v.icon} {v.label}
            </Chip>
          ))}
        </div>
      )}

      <div style={styles.rateRow}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>
          {isFuture ? "Bewerten ab dem Tag" : mine?.stars ? "Deine Bewertung" : "Wie war's?"}
        </span>
        <Stars value={mine?.stars || 0} onRate={handleRate} size={compact ? 24 : 28} disabled={isFuture} />
      </div>

      {/* Freunde als Leiste zum seitlichen Wischen, egal wie viele es sind */}
      {friendRatings.length > 0 && (
        <div className="hscroll" style={friendRow} aria-label="Bewertungen deiner Freunde">
          <span style={{ flexShrink: 0, fontSize: 14 }}>👥</span>
          {friendRatings.map((f) => (
            <span key={f.name} style={friendChip}>
              <Avatar name={f.name} path={f.avatar} size={18} />
              <strong style={{ color: C.text }}>{f.name}</strong>
              {f.variant && <span title={f.variant === NO_TOPPING ? "ohne Topping" : variantLabel(f.variant)}>{variantIcon(f.variant)}</span>}
              <span style={{ color: C.gold }}>★</span>{formatStars(f.stars)}
              {f.date !== date && <span style={{ color: C.faint, fontSize: 11 }}>{shortDate(f.date)}</span>}
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
        {commentCount > 0 && (
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
            maxLength={thread?.noTextLimit ? 25000 : 500} rows={3} placeholder="Wie war's? Portion, Geschmack, Preis-Leistung …" autoFocus
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button type="button" style={styles.ghostBtn} onClick={() => setEditing(false)}>Abbrechen</button>
            <button type="button" style={styles.smallPrimary} onClick={saveComment} disabled={saving}>
              {saving ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {showComments && <CommentList canteenId={canteenId} date={date} mealName={m.name} dishes={dishes} refreshKey={refreshKey} {...thread} />}
    </article>
  );
}


// Ein Eintrag aus dem Archiv (Tabelle menu_items) als Gericht für die Anzeige
function archivedMeal(r) {
  const { sides, allergens } = cleanSidesAndAllergens(r.sides || [], r.allergens || []);
  return {
    id: `archiv-${r.meal_name}`,
    name: r.meal_name,
    category: r.category || "",
    price: r.price,
    sides,
    allergens,
    // Wok ohne Topping ist immer vegetarisch (gleiche Regel wie in api/mensa.js)
    diet: r.diet || (/wok/i.test(r.category || "") && !nameHasMeat(r.meal_name) ? "vegetarisch" : null),
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

// Zwei Einträge desselben Gerichts zusammenführen (Beilagen, Allergene, Preise)
function mergeMeal(t, m) {
  t.sides = [...new Set([...(t.sides || []), ...(m.sides || [])])];
  t.allergens = [...new Set([...(t.allergens || []), ...(m.allergens || [])])];
  const prices = [t.price, t.toppingPrice, m.price, m.toppingPrice].filter((p) => p != null).map(Number);
  if (prices.length) {
    t.price = Math.min(...prices);
    const max = Math.max(...prices);
    t.toppingPrice = max > t.price ? max : null;
  }
  if (t.diet && m.diet && t.diet !== m.diet) t.diet = "vegetarisch";
}

// Bewertungen mehrerer Schreibweisen eines Gerichts zusammenrechnen
function mergeStats(list) {
  const xs = list.filter(Boolean);
  if (xs.length <= 1) return xs[0];
  return xs.reduce((o, r) => {
    const v = Number(o.votes) + Number(r.votes);
    return {
      ...o, votes: v,
      avg_stars: (Number(o.avg_stars) * o.votes + Number(r.avg_stars) * r.votes) / v,
      comments: Number(o.comments || 0) + Number(r.comments || 0),
      days: Math.max(o.days || 0, r.days || 0),
      last_date: o.last_date > r.last_date ? o.last_date : r.last_date,
    };
  });
}

// Reihenfolge nach Gesamtbewertung: erst Gerichte mit mindestens 2 Stimmen
// (damit nicht eine einzelne 5 gewinnt), dann Schnitt, dann Anzahl Stimmen
function byTotal(A, B) {
  const a = A || { votes: 0, avg_stars: 0 }, b = B || { votes: 0, avg_stars: 0 };
  return (b.votes >= 2) - (a.votes >= 2) || b.avg_stars - a.avg_stars || b.votes - a.votes;
}

// Letzter Mensatag aus den gemerkten Gerichten (falls OpenMensa den Tag
// nicht mehr liefert)
async function archivedPastDay(canteenId, date) {
  const { data } = await supabase
    .from("menu_items")
    .select("meal_date")
    .eq("canteen_id", canteenId)
    .eq("meal_date", date)
    .limit(1);
  return data?.length ? { date, closed: false, meals: [] } : null;
}

function matchesDiet(m, dietFilter) {
  if (dietFilter === "vegan") return m.diet === "vegan";
  if (dietFilter === "vegetarisch") return m.diet === "vegan" || m.diet === "vegetarisch";
  return true;
}

// ---- Die Ansicht -----------------------------------------------------------
export default function TodayTab({
  canteens, canteenId, onCanteenChange, userId, username, friends, avatars, favorites, onToggleFavorite,
  needLogin, showToast, onActivity = () => {}, active = true, noTextLimit = false,
}) {
  const today = todayBerlin();

  const [days, setDays] = useState([]);           // letzter Mensatag + kommende Tage
  const [date, setDate] = useState(null);
  const [anchor, setAnchor] = useState(null);     // dieser Tag steht nach dem Laden ganz links
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dietFilter, setDietFilter] = useState("alle");
  const [showExtras, setShowExtras] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  const [stats, setStats] = useState({});
  const [mine, setMine] = useState({});
  const [archive, setArchive] = useState(null);    // gemerkte Gerichte des Tages
  const [ratedMeals, setRatedMeals] = useState({}); // bewertete Gerichte des Tages
  const [totals, setTotals] = useState({});         // Gesamtbewertung je Gericht (alle Tage)
  const [friendHistory, setFriendHistory] = useState([]); // letzte Bewertungen der Freunde

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
      .then(async (data) => {
        if (cancelled) return;
        // Samstag und Sonntag gibt es als Tage nicht
        const open = (data.days || []).filter((d) => !d.closed && d.meals.length > 0 && !isWeekend(d.date));
        const upcoming = open.filter((d) => d.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
        rememberToday(canteenId, upcoming.find((d) => d.date === today));
        // Letzter Mensatag vor heute ("gestern", am Wochenende/Montag der
        // Freitag) – nur der darf noch bewertet werden
        const prevDate = lastMensaDay(today);
        const past = open.find((d) => d.date === prevDate) || (await archivedPastDay(canteenId, prevDate));
        if (cancelled) return;
        // Ausgewählt: heute. Am Wochenende weiterhin der Freitag.
        const start = upcoming.some((d) => d.date === today) ? today
          : isWeekend(today) && past ? past.date
          : upcoming[0]?.date || past?.date || null;
        setDays(past ? [past, ...upcoming] : upcoming);
        setDate(start);
        setAnchor(start);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [canteenId, today]);

  // Namen der Gerichte laut Plan für den gewählten Tag
  const planNames = useMemo(
    () => (days.find((d) => d.date === date)?.meals || []).map((m) => m.name),
    [days, date]
  );

  // 2) Bewertungen + gemerkte Gerichte für Mensa und Tag laden,
  //    danach die Gesamtbewertung dieser Gerichte über alle Tage
  const loadRatings = useCallback(async () => {
    if (!date) return;
    const statsReq = supabase
      .from("meal_stats")
      .select("meal_name, avg_stars, votes, comments")
      .eq("canteen_id", canteenId)
      .eq("meal_date", date);
    const mineReq = userId
      ? supabase.from("ratings").select("meal_name, stars, comment, variant")
          .eq("user_id", userId).eq("canteen_id", canteenId).eq("meal_date", date)
      : Promise.resolve({ data: [] });
    const ratedReq = supabase
      .from("ratings")
      .select("meal_name, category, price")
      .eq("canteen_id", canteenId)
      .eq("meal_date", date)
      .limit(1000);
    const archiveReq = supabase
      .from("menu_items")
      .select("meal_name, category, price, sides, allergens, diet, is_main, first_seen")
      .eq("canteen_id", canteenId)
      .eq("meal_date", date)
      .order("first_seen", { ascending: true });

    const [{ data: s }, { data: m }, { data: rated }, { data: arch }] =
      await Promise.all([statsReq, mineReq, ratedReq, archiveReq]);

    // Nach Gericht (dishName) zusammenfassen: korrigiert das Studentenwerk einen
    // Namen im Laufe des Tages, zählen beide Schreibweisen als ein Gericht.
    const byDish = {};
    for (const r of s || []) {
      const k = dishName(r.meal_name), o = byDish[k];
      byDish[k] = !o ? r : {
        ...o, votes: o.votes + r.votes, comments: (o.comments || 0) + (r.comments || 0),
        avg_stars: (o.avg_stars * o.votes + r.avg_stars * r.votes) / (o.votes + r.votes),
      };
    }
    setStats(byDish);
    setMine(Object.fromEntries((m || []).map((r) => [dishName(r.meal_name), r])));
    const known = {};
    for (const r of rated || []) known[r.meal_name] ??= r;
    setRatedMeals(known);
    setArchive(arch || []);

    // Gesamtbewertung aller Gerichte dieses Tages (über alle Tage hinweg)
    const keys = [...new Set(
      [...planNames, ...(arch || []).map((r) => r.meal_name), ...Object.keys(known)].map(dishName)
    )].filter(Boolean);
    if (keys.length === 0) { setTotals({}); setFriendHistory([]); return; }

    const friendIds = [...(friends?.keys() || [])].filter((id) => id !== userId);
    const totalsReq = supabase
      .from("dish_stats")
      .select("dish, avg_stars, votes, comments, days, last_date")
      .eq("canteen_id", canteenId)
      .in("dish", keys);
    const friendsReq = friendIds.length
      ? supabase.from("ratings").select("user_id, dish, stars, meal_date, variant")
          .eq("canteen_id", canteenId).in("dish", keys).in("user_id", friendIds)
          .order("meal_date", { ascending: false }).limit(1000)
      : Promise.resolve({ data: [] });
    const [{ data: t }, { data: fr }] = await Promise.all([totalsReq, friendsReq]);
    setTotals(Object.fromEntries((t || []).map((r) => [r.dish, r])));
    setFriendHistory(fr || []);
  }, [canteenId, date, userId, planNames, friends]);

  // Beim Wechsel von Mensa oder Tag alte Daten nicht kurz falsch anzeigen
  useEffect(() => {
    setStats({}); setMine({}); setRatedMeals({}); setArchive(null); setTotals({}); setFriendHistory([]);
  }, [canteenId, date]);

  // Was haben die Freunde zuletzt zu welchem Gericht gesagt? (neueste je Freund)
  const friendsByDish = useMemo(() => {
    const out = {};
    const seen = new Set();
    for (const r of friendHistory) {          // ist nach Datum absteigend sortiert
      if (!friends?.has(r.user_id) || seen.has(r.dish + "|" + r.user_id)) continue;
      seen.add(r.dish + "|" + r.user_id);
      (out[r.dish] ||= []).push({
        name: friends.get(r.user_id), avatar: avatars?.get(r.user_id), stars: r.stars, date: r.meal_date, variant: r.variant,
      });
    }
    return out;
  }, [friendHistory, friends, avatars]);

  // Gesamtbewertung – bei umbenannten Gerichten über alle Schreibweisen (siehe renames)
  const totalOf = (name) => mergeStats(variants(name).map((k) => totals[k]));
  const mineOf = (name) => variants(name).map((k) => mine[k]).find(Boolean);
  const mineKey = (name) => variants(name).find((k) => mine[k]) || dishName(name);
  useEffect(() => { loadRatings(); }, [loadRatings]);
  useEffect(() => {
    const t = setInterval(loadRatings, 60000);
    return () => clearInterval(t);
  }, [loadRatings]);

  // 3) Bewerten, Kommentieren, Entfernen
  // Hast du das Gericht schon unter einer älteren Schreibweise bewertet,
  // wird diese Bewertung geändert statt eine zweite angelegt.
  const savedName = (meal) => mineOf(meal.name)?.meal_name || meal.name;

  async function saveRating(meal, stars, comment, variant = mineOf(meal.name)?.variant ?? null) {
    const { error: err } = await supabase.from("ratings").upsert(
      {
        user_id: userId, canteen_id: canteenId, meal_date: date, meal_name: savedName(meal),
        category: meal.category, price: meal.price, stars, comment: comment || null, variant,
      },
      { onConflict: "user_id,canteen_id,meal_date,meal_name" }
    );
    if (err) { showToast(friendlyError(err)); return false; }
    return true;
  }

  async function rate(meal, stars, variant = null) {
    const k = mineKey(meal.name);
    const before = mine[k];
    const v = variant ?? before?.variant ?? null;
    setMine((p) => ({ ...p, [k]: { ...before, meal_name: before?.meal_name || meal.name, stars, variant: v } }));
    const ok = await saveRating(meal, stars, before?.comment, v);
    if (!ok) setMine((p) => ({ ...p, [k]: before }));
    else if (!before?.stars) onActivity(); // neue Bewertung -> vielleicht neues Abzeichen
    loadRatings();
  }

  async function removeRating(meal) {
    const k = mineKey(meal.name);
    const before = mine[k];
    const hint = before?.comment ? " Dein Kommentar wird dabei auch gelöscht." : "";
    if (!window.confirm(`Deine Bewertung für „${meal.name}" entfernen?${hint}`)) return;
    setMine((p) => { const n = { ...p }; delete n[k]; return n; });
    const { error: err } = await supabase.from("ratings").delete()
      .eq("user_id", userId).eq("canteen_id", canteenId)
      .eq("meal_date", date).eq("meal_name", before?.meal_name || meal.name);
    if (err) {
      showToast(friendlyError(err));
      setMine((p) => ({ ...p, [k]: before }));
    } else {
      showToast("Bewertung entfernt.");
    }
    loadRatings();
  }

  // Wok: nachträglich ändern, was man dazu hatte
  async function changeVariant(meal, variant) {
    const k = mineKey(meal.name);
    const before = mine[k];
    if (!before?.stars) return;
    setMine((p) => ({ ...p, [k]: { ...before, variant } }));
    const ok = await saveRating(meal, before.stars, before.comment, variant);
    if (!ok) setMine((p) => ({ ...p, [k]: before }));
    loadRatings();
  }

  async function comment(meal, text) {
    const current = mineOf(meal.name);
    if (!current?.stars) { showToast("Bitte zuerst Sterne vergeben."); return false; }
    const ok = await saveRating(meal, current.stars, text);
    if (ok) { await loadRatings(); if (text && !current.comment) onActivity(); }
    return ok;
  }

  // Gericht teilen: Teilen-Menü des Handys, sonst Text kopieren
  async function share(meal) {
    const s = totalOf(meal.name);
    const mensa = canteens.find((c) => c.id === canteenId)?.name || "Mensa";
    const when = date === today ? "Heute" : date === daysAgo(1) ? "Gestern"
      : `Am ${dayLabel(date, today).replace(" · ", ", ")}`;
    const rating = s?.votes > 0
      ? ` ⭐ ${formatAvg(s.avg_stars)} (${s.votes} ${s.votes === 1 ? "Stimme" : "Stimmen"})`
      : meal.price != null ? ` für ${formatPrice(meal.price)}` : "";
    const text = `${when} in der ${mensa}: ${meal.name}${rating}.${date >= today ? " Kommt wer mit? 🍽️" : ""}`;
    const url = window.location.origin;

    if (navigator.share) {
      try { await navigator.share({ title: "Schmausi", text, url }); } catch { /* abgebrochen */ }
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
  const isPast = !!date && date < today;

  // Umbenannte Gerichte erkennen: Ein Name ist vom Plan verschwunden und ein fast
  // gleicher Name derselben Kategorie ist erst später dazugekommen
  // („Quarkkeulchen mit Apfelmus" → „sächsische Quarkkeulchen mit Apfelmus").
  // Standen beide gleichzeitig auf dem Plan, sind es zwei verschiedene Gerichte.
  const renames = useMemo(() => {
    const out = {}; // dishName(alter Name) -> { from, to }
    if (isFuture || !currentDay) return out;
    const plan = currentDay.meals || [];
    const planKeys = new Set(plan.map((m) => dishName(m.name)));
    const seenAt = {};
    for (const r of archive || []) seenAt[dishName(r.meal_name)] ??= Date.parse(r.first_seen);
    for (const r of archive || []) {
      const k = dishName(r.meal_name);
      if (planKeys.has(k) || out[k]) continue;
      const to = plan.find((m) => (m.category || "") === (r.category || "") && sameDish(m.name, r.meal_name)
        && !(seenAt[dishName(m.name)] <= seenAt[k] + 60000));
      if (to) out[k] = { from: r.meal_name, to: to.name };
    }
    return out;
  }, [currentDay, archive, isFuture]);
  // alle Schreibweisen eines Gerichts (der aktuelle Name zuerst)
  function variants(name) {
    const k = dishName(name);
    return [k, ...Object.keys(renames).filter((o) => dishName(renames[o].to) === k)];
  }

  // Umbenennung auch in der Datenbank festhalten: Bewertungen wandern zum neuen
  // Namen (Supabase prüft selbst noch einmal, siehe SQL 16). Danach neu laden.
  const mergedRef = useRef(new Set());
  useEffect(() => {
    const todo = Object.values(renames).filter((r) => !mergedRef.current.has(`${canteenId}|${date}|${r.from}`));
    if (todo.length === 0) return;
    todo.forEach((r) => mergedRef.current.add(`${canteenId}|${date}|${r.from}`));
    Promise.all(todo.map((r) => supabase.rpc("merge_dish_rename", { p_canteen: canteenId, p_date: date, p_old: r.from, p_new: r.to })))
      .then((res) => { if (res.some((x) => !x.error && x.data > 0)) loadRatings(); });
  }, [renames]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tag-Auswahl so scrollen, dass "Heute" ganz links steht. Der letzte
  // Mensatag (zum Nachbewerten) liegt links daneben und erscheint erst,
  // wenn man die Leiste in die andere Richtung wischt.
  const dayRowRef = useRef(null);
  useLayoutEffect(() => {
    const row = dayRowRef.current;
    const chip = row?.querySelector(`[data-day="${anchor}"]`);
    if (!active || !row || !chip || row.offsetWidth === 0) return; // unsichtbar -> später
    row.scrollLeft = chip.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
  }, [days, anchor, active]);

  // Nach jeder Tagesauswahl wieder die Startansicht: "Heute" ganz links,
  // der letzte Mensatag verschwindet nach links. Nur wenn man genau den
  // letzten Mensatag antippt, bleibt er sichtbar.
  useEffect(() => {
    const row = dayRowRef.current;
    const chip = row?.querySelector(`[data-day="${anchor}"]`);
    if (!active || !row || !chip || !date || date < anchor) return;
    const target = chip.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
    // nur zurückschieben, wenn "Gestern" gerade sichtbar ist – ein weiter
    // rechts gewählter Tag bleibt so im Bild
    if (row.scrollLeft < target - 2) row.scrollTo({ left: target, behavior: "smooth" });
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayChipLabel = (d) => (d === daysAgo(1) ? `Gestern · ${shortDate(d)}` : dayLabel(d, today));
  const dayLoading = loading;

  const { mains, extras, favToday } = useMemo(() => {
    const plan = currentDay?.meals || [];

    // Heute zeigen wir alle Gerichte, die an dem Tag irgendwann auf dem
    // Plan standen. Für Tage in der Zukunft gilt nur der aktuelle Plan.
    let all = plan;
    if (!isFuture) {
      const list = plan.map((m) => ({ ...m }));
      // gleiches Gericht in anderer Schreibweise nicht doppelt zeigen (der aktuelle
      // Plan gewinnt) – aber Beilagen und Preise zusammenführen. Wichtig beim Wok:
      // Ist er nicht mehr im Plan, stehen Grundpreis und Topping-Eintrag getrennt
      // in den gemerkten Gerichten, und nur einer von beiden hat die Toppings.
      const byKey = new Map(list.map((m) => [dishName(m.name), m]));
      const wokTwin = (m) => /wok/i.test(m.category || "")
        && list.find((x) => x.category === m.category && sameDish(x.name, m.name));
      // Nicht mehr gelistete Gerichte hinter ihre Kategorie einsortieren
      const add = (m) => {
        const k = dishName(m.name);
        if (renames[k]) return;
        const twin = byKey.get(k) || wokTwin(m);
        if (twin) { mergeMeal(twin, m); return; }
        byKey.set(k, m);
        let i = -1;
        list.forEach((x, idx) => { if (x.category === m.category) i = idx; });
        if (i >= 0) list.splice(i + 1, 0, m);
        else list.push(m);
      };
      (archive || []).filter((r) => !isPastaExtra(r.category, r.meal_name) && !isPlaceholderMeal(r.meal_name)).forEach((r) => add(archivedMeal(r)));
      Object.values(ratedMeals).filter((r) => !isPlaceholderMeal(r.meal_name)).forEach((r) =>
        add(archivedMeal({ meal_name: r.meal_name, category: r.category, price: r.price })));
      all = list;
    }

    const filtered = all.filter((m) => matchesDiet(m, dietFilter));
    // Standard: erst Fleisch/Fisch, dann vegan/vegetarisch, dann Pasta, dann der Rest
    const sorted = sortByRating
      ? [...filtered].sort((a, b) => byTotal(totalOf(a.name), totalOf(b.name)))
      : [...filtered].sort((a, b) => mealGroup(a) - mealGroup(b));

    return {
      mains: sorted.filter((m) => m.isMain),
      extras: sorted.filter((m) => !m.isMain),
      favToday: all.filter((m) => favorites.has(dishKey(canteenId, m.name))),
    };
  }, [currentDay, archive, ratedMeals, isFuture, dietFilter, sortByRating, totals, favorites, canteenId, renames]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tagessieger: Hauptgericht mit der besten Gesamtbewertung. Gerichte mit
  // mindestens 2 Stimmen gehen vor, damit nicht eine einzelne 5 gewinnt.
  const winner = mains
    .filter((m) => totalOf(m.name)?.votes > 0)
    .sort((a, b) => byTotal(totalOf(a.name), totalOf(b.name)))[0];
  const winnerTotal = winner && totalOf(winner.name);

  function jumpTo(name) {
    const el = [...document.querySelectorAll("article[data-meal]")].find((a) => a.dataset.meal === name);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cardProps = (m, compact = false) => ({
    meal: m,
    stats: mergeStats(variants(m.name).map((k) => stats[k])),
    total: totalOf(m.name),
    mine: mineOf(m.name),
    dishes: variants(m.name),
    isFavorite: favorites.has(dishKey(canteenId, m.name)),
    canRate: !!userId,
    isFuture,
    onRate: rate,
    onComment: comment,
    onRemove: removeRating,
    onVariant: changeVariant,
    onShare: share,
    friendRatings: variants(m.name).flatMap((k) => friendsByDish[k] || []),
    thread: { userId, username, friends, needLogin, showToast, noTextLimit },
    onFavorite: (meal) => onToggleFavorite(canteenId, meal.name),
    needLogin,
    canteenId,
    date,
    today,
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
          <div style={styles.chipRow} ref={dayRowRef}>
            {days.map((d) => (
              <Chip key={d.date} data-day={d.date} active={d.date === date} onClick={() => setDate(d.date)}>
                {dayChipLabel(d.date)}
              </Chip>
            ))}
            {/* Platz am Ende, damit "Heute" auch bei wenigen Tagen ganz links stehen kann */}
            {days[0]?.date !== anchor && <span aria-hidden="true" style={{ flex: "0 0 100%" }} />}
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

        {isPast && !dayLoading && (
          <div style={styles.favBanner}>
            📅 <strong>Nachbewerten:</strong> Hier kannst du noch bewerten, was du{" "}
            {date === daysAgo(1) ? "gestern" : `am ${dayLabel(date, today).replace(" · ", ", ")}`} gegessen hast.
          </div>
        )}

        {favToday.length > 0 && !dayLoading && (
          <div style={styles.favBanner}>
            ❤️ <strong>
              {date === today ? "Heute gibt's" : isPast ? "An diesem Tag gab's" : "An diesem Tag gibt's"} dein Lieblingsgericht:
            </strong>{" "}
            {favToday.map((m) => m.name).join(", ")}
          </div>
        )}

        {winner && !dayLoading && (
          <button type="button" style={styles.winner} onClick={() => jumpTo(winner.name)}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={styles.winnerLabel}>🏆 {date === today ? "Heute vorn" : date === daysAgo(1) ? "Gestern vorn" : "An diesem Tag vorn"}</span>
              <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 800, lineHeight: 1.1, marginTop: 4, letterSpacing: "-0.02em" }}>{winner.name}</span>
            </span>
            <span
              style={{
                width: 72, height: 72, borderRadius: "50%", flexShrink: 0, background: C.yellow, border: `2.5px solid ${C.ink}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(8deg)", color: C.onAccent,
              }}
            >
              <span style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{formatAvg(winnerTotal.avg_stars)}</span>
              <span style={{ fontSize: 10, fontWeight: 800 }}>
                {winnerTotal.votes} {winnerTotal.votes === 1 ? "Stimme" : "Stimmen"}
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
