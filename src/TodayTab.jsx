import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { usePolling } from "./usePolling.js";
import { supabase } from "./supabase.js";
import {
  todayBerlin, daysAgo, isWeekend, lastMensaDay, formatPrice, formatAvg, dayLabel, friendlyError, dishKey, dishName, mealVariants, variantLabel, variantIcon, NO_TOPPING, sameTopping, shortDate, mealGroup, isNetworkError,
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
  const sideList = variants ? (m.sides || []).filter((x) => !variants.some((v) => sameTopping(v.value, x))) : m.sides || [];

  function handleRate(stars) {
    if (!canRate) return needLogin();
    onRate(m, stars, variant || null);
  }

  function pickVariant(v) {
    if (!canRate) return needLogin();
    const next = sameTopping(variant, v) ? null : v;
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
            <Chip key={v.value} active={sameTopping(variant, v.value)} onClick={() => pickVariant(v.value)} aria-pressed={sameTopping(variant, v.value)}>
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

// Der Speiseplan wird auf dem Handy zwischengespeichert: Die App zeigt ihn sofort
// (und auch, wenn das WLAN gerade weg ist) und holt im Hintergrund den neuen.
const planCacheKey = (canteenId) => `schmausi-plan-${canteenId}`;
function readPlanCache(canteenId) {
  try {
    const c = JSON.parse(localStorage.getItem(planCacheKey(canteenId)));
    return c && Array.isArray(c.days) ? c : null;
  } catch { return null; }
}
function writePlanCache(canteenId, data) {
  try { localStorage.setItem(planCacheKey(canteenId), JSON.stringify({ days: data.days, source: data.source, saved: Date.now() })); } catch { /* Speicher voll: egal */ }
}
async function fetchPlan(canteenId) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`/api/mensa?canteen=${canteenId}`, { signal: ctrl.signal });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Fehler beim Laden.");
    return data;
  } finally { clearTimeout(timer); }
}
// "11:42 Uhr" bzw. "gestern, 13:05 Uhr"
function standText(ts, today) {
  const d = new Date(ts);
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) + " Uhr";
  return day === today ? time : `${day === daysAgo(1) ? "gestern" : shortDate(day)}, ${time}`;
}
// Alle Schlüssel eines Gerichts: der Name, der gilt, und frühere Schreibweisen
const keysOf = (m) => [...new Set([m.name, ...(m.aliases || [])].map(dishName))];

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
  const dateRef = useRef(null); // zuletzt gewählter Tag (für den Mensa-Wechsel)
  useEffect(() => { if (date) dateRef.current = date; }, [date]);
  const [anchor, setAnchor] = useState(null);     // dieser Tag steht nach dem Laden ganz links
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dietFilter, setDietFilter] = useState("alle");
  const [showExtras, setShowExtras] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  const [stats, setStats] = useState({});
  const [mine, setMine] = useState({});
  const [stale, setStale] = useState(null);         // { at, failed }: es wird ein gespeicherter Plan gezeigt
  const [planSource, setPlanSource] = useState("plan");
  const [attempt, setAttempt] = useState(0);        // +1 = Plan neu holen
  const [totals, setTotals] = useState({});         // Gesamtbewertung je Gericht (alle Tage)
  const [friendHistory, setFriendHistory] = useState([]); // letzte Bewertungen der Freunde

  // 1) Speiseplan laden. Der Server liefert letzten Mensatag, heute (samt
  //    Gerichten, die nicht mehr auf dem Plan stehen) und die kommenden Tage.
  const todayRef = useRef(today);
  const shownRef = useRef("");
  const applyPlan = useCallback((data) => {
    // Samstag und Sonntag gibt es als Tage nicht
    const open = (data.days || []).filter((d) => !d.closed && d.meals.length > 0 && !isWeekend(d.date));
    const upcoming = open.filter((d) => d.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
    // Letzter Mensatag vor heute ("gestern", am Wochenende/Montag der
    // Freitag) – nur der darf noch bewertet werden
    const past = open.find((d) => d.date === lastMensaDay(today));
    // Ausgewählt: heute. Am Wochenende weiterhin der Freitag.
    const start = upcoming.some((d) => d.date === today) ? today
      : isWeekend(today) && past ? past.date
      : upcoming[0]?.date || past?.date || null;
    const list = past ? [past, ...upcoming] : upcoming;
    const sig = JSON.stringify(list);
    if (sig !== shownRef.current) { shownRef.current = sig; setDays(list); }
    setPlanSource(data.source || "plan");
    // Beim Mensa-Wechsel den gewählten Tag behalten, wenn die neue Mensa an
    // dem Tag geöffnet hat – sonst wie bisher heute (bzw. nächster Tag)
    const keep = dateRef.current && list.some((d) => d.date === dateRef.current) ? dateRef.current : start;
    setDate(keep);
    setAnchor(keep < start ? keep : start);   // Tagesleiste wie gewohnt: heute steht links
  }, [today]);

  useEffect(() => {
    let cancelled = false;
    // Neuer Tag (App war über Nacht offen): wieder bei "Heute" anfangen
    if (todayRef.current !== today) { todayRef.current = today; dateRef.current = null; }
    setError(null);
    // Erst den gespeicherten Plan zeigen (sofort da), dann den neuen holen
    const cached = readPlanCache(canteenId);
    const usable = !!cached && cached.days.some((d) => d.date >= lastMensaDay(today) && d.meals?.length);
    if (usable) { applyPlan(cached); setLoading(false); }
    else { shownRef.current = ""; setDays([]); setDate(null); setLoading(true); }
    fetchPlan(canteenId)
      .then((data) => {
        if (cancelled) return;
        writePlanCache(canteenId, data);
        applyPlan(data);
        setStale(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (usable) setStale({ at: cached.saved, failed: true });
        else setError(isNetworkError(e) ? "Keine Verbindung – der Speiseplan lässt sich gerade nicht laden." : (e.message || "Der Speiseplan lässt sich gerade nicht laden."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [canteenId, today, attempt, applyPlan]);

  // Hat das Laden nicht geklappt: von selbst wieder versuchen, sobald das Netz
  // zurück ist oder die App wieder nach vorne kommt – sonst alle 20 Sekunden
  const failed = !!error || !!stale?.failed;
  useEffect(() => {
    if (!failed || !active) return;
    const retry = () => { if (document.visibilityState === "visible") setAttempt((a) => a + 1); };
    const id = setInterval(retry, 20000);
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => { clearInterval(id); window.removeEventListener("online", retry); document.removeEventListener("visibilitychange", retry); };
  }, [failed, active]);
  // Den Plan alle 10 Minuten auffrischen (z.B. „ausverkauft“), solange „Heute“ offen ist
  usePolling(useCallback(() => setAttempt((a) => a + 1), []), 600000, active && !failed, { minGap: 300000 });

  // Schlüssel der Gerichte des gewählten Tages (als Text, damit sich nur bei
  // echten Änderungen etwas neu lädt)
  const dayKeys = useMemo(
    () => [...new Set((days.find((d) => d.date === date)?.meals || []).flatMap(keysOf))].filter(Boolean).join("\n"),
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
    const [{ data: s }, { data: m }] = await Promise.all([statsReq, mineReq]);
    if (!s) return; // keine Verbindung: die bisherigen Zahlen stehen lassen

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

    // Gesamtbewertung aller Gerichte dieses Tages (über alle Tage hinweg)
    const keys = dayKeys ? dayKeys.split("\n") : [];
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
    if (t) setTotals(Object.fromEntries(t.map((r) => [r.dish, r])));
    if (fr) setFriendHistory(fr);
  }, [canteenId, date, userId, dayKeys, friends]);

  // Beim Wechsel von Mensa oder Tag alte Daten nicht kurz falsch anzeigen
  useEffect(() => {
    setStats({}); setMine({}); setTotals({}); setFriendHistory([]);
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

  // Gesamtbewertung – bei umbenannten Gerichten über alle Schreibweisen
  const totalOf = (m) => mergeStats(keysOf(m).map((k) => totals[k]));
  const mineOf = (m) => keysOf(m).map((k) => mine[k]).find(Boolean);
  const mineKey = (m) => keysOf(m).find((k) => mine[k]) || dishName(m.name);
  useEffect(() => { loadRatings(); }, [loadRatings]);
  // Bewertungen ändern sich vor allem heute: nur dann alle 2 Min. nachladen,
  // und nur solange „Heute“ offen und die App im Vordergrund ist
  usePolling(loadRatings, 120000, active && date === today, { refreshOnEnable: true });

  // 3) Bewerten, Kommentieren, Entfernen
  // Die Datenbank sorgt dafür, dass es je Gericht nur eine Bewertung gibt und
  // sie beim Namen landet, der gilt (auch nach einer Umbenennung).
  async function saveRating(meal, stars, comment, variant = mineOf(meal)?.variant ?? null) {
    const { error: err } = await supabase.from("ratings").upsert(
      {
        user_id: userId, canteen_id: canteenId, meal_date: date, meal_name: meal.name,
        category: meal.category, price: meal.price, stars, comment: comment || null, variant,
      },
      { onConflict: "user_id,canteen_id,meal_date,meal_name" }
    );
    if (err) {
      showToast(friendlyError(err));
      if (/nicht auf dem Plan/.test(err.message || "")) setAttempt((a) => a + 1); // Plan ist veraltet: neu holen
      return false;
    }
    return true;
  }

  async function rate(meal, stars, variant = null) {
    const k = mineKey(meal);
    const before = mine[k];
    const v = variant ?? before?.variant ?? null;
    setMine((p) => ({ ...p, [k]: { ...before, meal_name: before?.meal_name || meal.name, stars, variant: v } }));
    const ok = await saveRating(meal, stars, before?.comment, v);
    if (!ok) setMine((p) => ({ ...p, [k]: before }));
    else if (!before?.stars) onActivity(); // neue Bewertung -> vielleicht neues Abzeichen
    loadRatings();
  }

  async function removeRating(meal) {
    const k = mineKey(meal);
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
    const k = mineKey(meal);
    const before = mine[k];
    if (!before?.stars) return;
    setMine((p) => ({ ...p, [k]: { ...before, variant } }));
    const ok = await saveRating(meal, before.stars, before.comment, variant);
    if (!ok) setMine((p) => ({ ...p, [k]: before }));
    loadRatings();
  }

  async function comment(meal, text) {
    const current = mineOf(meal);
    if (!current?.stars) { showToast("Bitte zuerst Sterne vergeben."); return false; }
    const ok = await saveRating(meal, current.stars, text);
    if (ok) { await loadRatings(); if (text && !current.comment) onActivity(); }
    return ok;
  }

  // Gericht teilen: Teilen-Menü des Handys, sonst Text kopieren
  async function share(meal) {
    const s = totalOf(meal);
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

  // Tag-Auswahl so scrollen, dass "Heute" ganz links steht. Der letzte
  // Mensatag (zum Nachbewerten) liegt links daneben und erscheint erst,
  // wenn man die Leiste in die andere Richtung wischt.
  const dayRowRef = useRef(null);
  useLayoutEffect(() => {
    const row = dayRowRef.current;
    const chip = row?.querySelector(`[data-day="${anchor}"]`);
    if (!active || !row || !chip || row.offsetWidth === 0) return; // unsichtbar -> später
    row.scrollLeft = chip.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
    // gewählter Tag weiter rechts (z.B. nach Mensa-Wechsel behalten) -> ins Bild holen
    const sel = date && row.querySelector(`[data-day="${date}"]`);
    if (sel) {
      const over = sel.getBoundingClientRect().right - row.getBoundingClientRect().right;
      if (over > 0) row.scrollLeft += over + 8;
    }
  }, [days, anchor, active]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isFav = (m) => [m.name, ...(m.aliases || [])].find((n) => favorites.has(dishKey(canteenId, n)));
  const { mains, extras, favToday } = useMemo(() => {
    // Die Liste kommt fertig vom Server: ohne doppelte Gerichte, und heute samt
    // allem, was an dem Tag schon einmal auf dem Plan stand.
    const all = currentDay?.meals || [];
    const filtered = all.filter((m) => matchesDiet(m, dietFilter));
    // Standard: erst Fleisch/Fisch, dann vegan/vegetarisch, dann Pasta, dann der Rest
    const sorted = sortByRating
      ? [...filtered].sort((a, b) => byTotal(totalOf(a), totalOf(b)))
      : [...filtered].sort((a, b) => mealGroup(a) - mealGroup(b));

    return {
      mains: sorted.filter((m) => m.isMain),
      extras: sorted.filter((m) => !m.isMain),
      favToday: all.filter(isFav),
    };
  }, [currentDay, dietFilter, sortByRating, totals, favorites, canteenId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tagessieger: Hauptgericht mit der besten Gesamtbewertung. Gerichte mit
  // mindestens 2 Stimmen gehen vor, damit nicht eine einzelne 5 gewinnt.
  const winner = mains
    .filter((m) => totalOf(m)?.votes > 0)
    .sort((a, b) => byTotal(totalOf(a), totalOf(b)))[0];
  const winnerTotal = winner && totalOf(winner);

  function jumpTo(name) {
    const el = [...document.querySelectorAll("article[data-meal]")].find((a) => a.dataset.meal === name);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cardProps = (m, compact = false) => ({
    meal: m,
    stats: mergeStats(keysOf(m).map((k) => stats[k])),
    total: totalOf(m),
    mine: mineOf(m),
    dishes: keysOf(m),
    isFavorite: !!isFav(m),
    canRate: !!userId,
    isFuture,
    onRate: rate,
    onComment: comment,
    onRemove: removeRating,
    onVariant: changeVariant,
    onShare: share,
    // je Freund nur die neueste Bewertung (auch wenn das Gericht früher anders hieß)
    friendRatings: Object.values(Object.fromEntries(keysOf(m).flatMap((k) => friendsByDish[k] || []).sort((a, b) => (a.date < b.date ? -1 : 1)).map((f) => [f.name, f]))),
    thread: { userId, username, friends, needLogin, showToast, noTextLimit },
    onFavorite: (meal) => onToggleFavorite(canteenId, isFav(meal) || meal.name),
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

        {stale?.failed && (
          <div style={styles.notice} role="status">
            📡 Keine Verbindung – du siehst den Stand von {standText(stale.at, today)}. Die App versucht es von selbst wieder.
          </div>
        )}
        {!stale?.failed && planSource === "archiv" && !dayLoading && !error && date <= today && (
          <div style={styles.notice} role="status">
            Der Speiseplan-Dienst ist gerade nicht erreichbar. Du siehst die Gerichte, die Schmausi sich für heute gemerkt hat.
          </div>
        )}
        {dayLoading && !error && !nothingAtAll && <div style={styles.notice}>Speiseplan wird geladen…</div>}
        {error && (
          <div style={{ ...styles.notice, ...styles.noticeError }}>
            {error}{" "}
            <button type="button" onClick={() => setAttempt((a) => a + 1)} style={{ ...styles.smallAction, display: "inline" }}>Nochmal versuchen</button>
          </div>
        )}

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
