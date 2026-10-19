import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase.js";

// ============================================================================
// MensaCheck Leipzig – Version 3: Anmeldung + gemeinsame Bewertungen
// ----------------------------------------------------------------------------
// Speisepläne:   /api/mensa (Datei api/mensa.js, holt Daten von OpenMensa)
// Bewertungen:   Supabase-Datenbank (Tabellen profiles, ratings, meal_stats)
// Ein Gericht wird erkannt an: Mensa + Datum + Name.
// ============================================================================

const STORAGE_KEY = "mensacheck-mensa";

// ---- Hilfsfunktionen -------------------------------------------------------
function todayBerlin() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

function formatPrice(p) {
  if (p == null) return null;
  return Number(p).toFixed(2).replace(".", ",") + " €";
}

function formatAvg(n) {
  return Number(n).toFixed(1).replace(".", ",");
}

function dayLabel(iso, today) {
  const d = new Date(iso + "T12:00:00");
  const weekday = d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
  const date = d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
  return iso === today ? `Heute · ${date}` : `${weekday} · ${date}`;
}

function timeAgo(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
}

function loadSavedCanteen() {
  try { return Number(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}
function saveCanteen(id) {
  try { localStorage.setItem(STORAGE_KEY, String(id)); } catch { /* egal */ }
}

// Fehlermeldungen von Supabase verständlich machen
function friendlyError(err) {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("invalid login")) return "E-Mail oder Passwort stimmt nicht.";
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return "Mit dieser E-Mail gibt es schon ein Konto. Melde dich an.";
  if (msg.includes("password") && msg.includes("6")) return "Das Passwort braucht mindestens 6 Zeichen.";
  if (msg.includes("email") && msg.includes("invalid")) return "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (msg.includes("rate limit")) return "Zu viele Versuche. Bitte kurz warten.";
  if (msg.includes("row-level security")) return "Das darfst du (noch) nicht bewerten.";
  if (msg.includes("fetch")) return "Keine Verbindung. Bist du online?";
  return err?.message || "Da ist etwas schiefgelaufen.";
}

// ---- Kleine Bausteine ------------------------------------------------------
function Stars({ value, onRate, size = 26, disabled = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "inline-flex", gap: 2, opacity: disabled ? 0.45 : 1 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onRate(n)}
            aria-label={`${n} von 5 Sternen`}
            style={{
              background: "none", border: "none", padding: 2,
              cursor: disabled ? "default" : "pointer", fontSize: size, lineHeight: 1,
              color: active ? "#E8A317" : "#D9D4C9",
              transition: "color .12s, transform .12s",
              transform: hover === n ? "scale(1.18)" : "scale(1)",
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{ ...styles.chip, ...(active ? styles.chipOn : {}) }}>
      {children}
    </button>
  );
}

function DietBadge({ diet }) {
  if (!diet) return null;
  const vegan = diet === "vegan";
  return (
    <span style={{ ...styles.badge, ...(vegan ? styles.badgeVegan : styles.badgeVeggie) }}>
      {vegan ? "vegan" : "vegetarisch"}
    </span>
  );
}

// ---- Anmelden / Registrieren -----------------------------------------------
function AuthSheet({ onClose }) {
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
          <h2 style={{ margin: 0, fontSize: 20 }}>
            {mode === "register" ? "Konto erstellen" : "Anmelden"}
          </h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Schließen">×</button>
        </div>
        <p style={{ margin: "0 0 14px", color: "#8A8579", fontSize: 14 }}>
          {mode === "register"
            ? "Damit deine Bewertungen für alle sichtbar werden."
            : "Schön, dass du wieder da bist."}
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

  if (items === null) return <p style={styles.muted}>Kommentare werden geladen…</p>;
  if (items.length === 0) return <p style={styles.muted}>Noch keine Kommentare.</p>;

  return (
    <ul style={styles.commentList}>
      {items.map((c) => (
        <li key={c.id} style={styles.comment}>
          <div style={styles.commentHead}>
            <strong>{c.profiles?.username || "Jemand"}</strong>
            <span style={{ color: "#E8A317" }}>{"★".repeat(c.stars)}</span>
            <span style={styles.muted}>{timeAgo(c.created_at)}</span>
          </div>
          <p style={{ margin: "2px 0 0", lineHeight: 1.4 }}>{c.comment}</p>
        </li>
      ))}
    </ul>
  );
}

// ---- Karte für ein Gericht -------------------------------------------------
function MealCard({ meal: m, stats, mine, canRate, isFuture, onRate, onComment, needLogin, canteenId, date, compact = false }) {
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
        {formatPrice(m.price) && (
          <div style={styles.price}>
            {formatPrice(m.price)}
            <span style={styles.priceLabel}>Studierende</span>
          </div>
        )}
      </div>

      {m.allergens.length > 0 && (
        <button type="button" onClick={() => setShowAllergens((s) => !s)} style={styles.smallToggle}>
          {showAllergens ? `Allergene: ${m.allergens.join(", ")}` : "Allergene anzeigen"}
        </button>
      )}

      <div style={styles.rateRow}>
        <Stars value={mine?.stars || 0} onRate={handleRate} size={compact ? 22 : 26} disabled={isFuture} />
        <div style={styles.avgBox}>
          {stats?.votes > 0 ? (
            <>
              <strong style={{ color: "#2B2A26" }}>{formatAvg(stats.avg_stars)}</strong>
              <span style={{ color: "#8A8579" }}>
                {" "}· {stats.votes} {stats.votes === 1 ? "Stimme" : "Stimmen"}
              </span>
            </>
          ) : (
            <span style={{ color: "#A8A294" }}>{isFuture ? "Bewertbar ab dem Tag" : "Noch keine Bewertung"}</span>
          )}
        </div>
      </div>

      {!isFuture && (
        <div style={styles.commentBar}>
          {mine?.stars && !editing && (
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

      {showComments && (
        <CommentList canteenId={canteenId} date={date} mealName={m.name} refreshKey={refreshKey} />
      )}
    </article>
  );
}

// ---- Haupt-App -------------------------------------------------------------
export default function MensaCheck() {
  const today = todayBerlin();

  // Speiseplan
  const [canteens, setCanteens] = useState([]);
  const [canteenId, setCanteenId] = useState(loadSavedCanteen() || 63);
  const [days, setDays] = useState([]);
  const [date, setDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter
  const [dietFilter, setDietFilter] = useState("alle");
  const [showExtras, setShowExtras] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  // Anmeldung
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  // Bewertungen (aus Supabase), jeweils nach Gerichtname
  const [stats, setStats] = useState({});
  const [mine, setMine] = useState({});
  const [toast, setToast] = useState(null);

  const userId = session?.user?.id || null;

  // --- Anmeldestatus beobachten ---------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return setUsername(null);
    supabase.from("profiles").select("username").eq("id", userId).single()
      .then(({ data }) => setUsername(data?.username || null));
  }, [userId]);

  // --- Mensen + Speiseplan laden --------------------------------------------
  useEffect(() => {
    fetch("/api/mensa")
      .then((r) => r.json())
      .then((data) => setCanteens(data.canteens || []))
      .catch(() => setError("Die Mensa-Liste konnte nicht geladen werden."));
  }, []);

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

  // --- Bewertungen für Mensa + Tag laden ------------------------------------
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

  // Alle 60 Sekunden aktualisieren, damit man Bewertungen der anderen sieht
  useEffect(() => {
    const t = setInterval(loadRatings, 60000);
    return () => clearInterval(t);
  }, [loadRatings]);

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  }

  async function saveRating(meal, stars, comment) {
    const { error: err } = await supabase.from("ratings").upsert(
      {
        user_id: userId,
        canteen_id: canteenId,
        meal_date: date,
        meal_name: meal.name,
        category: meal.category,
        price: meal.price,
        stars,
        comment: comment || null,
      },
      { onConflict: "user_id,canteen_id,meal_date,meal_name" }
    );
    if (err) {
      showToast(friendlyError(err));
      return false;
    }
    return true;
  }

  async function rate(meal, stars) {
    const before = mine[meal.name];
    setMine((p) => ({ ...p, [meal.name]: { ...before, meal_name: meal.name, stars } })); // sofort anzeigen
    const ok = await saveRating(meal, stars, before?.comment);
    if (!ok) setMine((p) => ({ ...p, [meal.name]: before }));
    loadRatings();
  }

  async function comment(meal, text) {
    const current = mine[meal.name];
    if (!current?.stars) {
      showToast("Bitte zuerst Sterne vergeben.");
      return false;
    }
    const ok = await saveRating(meal, current.stars, text);
    if (ok) await loadRatings();
    return ok;
  }

  function chooseCanteen(id) {
    setCanteenId(id);
    saveCanteen(id);
  }

  // --- Anzeige vorbereiten --------------------------------------------------
  const currentDay = days.find((d) => d.date === date);
  const isFuture = date > today;

  const { mains, extras } = useMemo(() => {
    const meals = (currentDay?.meals || []).filter((m) => {
      if (dietFilter === "vegan") return m.diet === "vegan";
      if (dietFilter === "vegetarisch") return m.diet === "vegan" || m.diet === "vegetarisch";
      return true;
    });
    const sorted = sortByRating
      ? [...meals].sort((a, b) =>
          (stats[b.name]?.avg_stars || 0) - (stats[a.name]?.avg_stars || 0) ||
          (stats[b.name]?.votes || 0) - (stats[a.name]?.votes || 0))
      : meals;
    return { mains: sorted.filter((m) => m.isMain), extras: sorted.filter((m) => !m.isMain) };
  }, [currentDay, dietFilter, sortByRating, stats]);

  const canteenName = canteens.find((c) => c.id === canteenId)?.name || "Mensa";

  const cardProps = (m, compact = false) => ({
    meal: m,
    stats: stats[m.name],
    mine: mine[m.name],
    canRate: !!userId,
    isFuture,
    onRate: rate,
    onComment: comment,
    needLogin: () => setShowAuth(true),
    canteenId,
    date,
    compact,
  });

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      <header style={styles.header}>
        <div style={styles.topRow}>
          <div style={styles.brandRow}>
            <span style={styles.logo}>◆</span>
            <h1 style={styles.title}>MensaCheck</h1>
            <span style={styles.city}>Leipzig</span>
          </div>
          {userId ? (
            <button type="button" style={styles.userBtn} onClick={() => supabase.auth.signOut()} title="Abmelden">
              {username || "…"} · Abmelden
            </button>
          ) : (
            <button type="button" style={styles.loginBtn} onClick={() => setShowAuth(true)}>Anmelden</button>
          )}
        </div>
        <p style={styles.subtitle}>Was schmeckt heute in der {canteenName}?</p>
      </header>

      <div style={styles.controls}>
        <select
          aria-label="Mensa auswählen" value={canteenId}
          onChange={(e) => chooseCanteen(Number(e.target.value))} style={styles.select}
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
          <button type="button" style={styles.loginHint} onClick={() => setShowAuth(true)}>
            <strong>Mitbewerten?</strong> Melde dich an, dann sehen alle deine Sterne und Kommentare.
          </button>
        )}

        {loading && <div style={styles.notice}>Speiseplan wird geladen…</div>}

        {!loading && error && (
          <div style={{ ...styles.notice, ...styles.noticeError }}>{error} Versuch es gleich noch einmal.</div>
        )}

        {!loading && !error && days.length === 0 && (
          <div style={styles.empty}>
            <p style={{ fontSize: 18, margin: "0 0 4px", color: "#2B2A26" }}>Kein Speiseplan verfügbar</p>
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

      <footer style={styles.footer}>
        Speiseplan: OpenMensa / Studentenwerk Leipzig · Preise für Studierende, ohne Gewähr.<br />
        Testversion von MensaCheck.
      </footer>

      {toast && <div style={styles.toast} role="status">{toast}</div>}
      {showAuth && <AuthSheet onClose={() => setShowAuth(false)} />}
    </div>
  );
}

// ---- Styles ----------------------------------------------------------------
const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #FBF9F4; }
  input, textarea, select, button { font-family: inherit; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const styles = {
  page: {
    minHeight: "100vh", background: "#FBF9F4", color: "#2B2A26",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    maxWidth: 640, margin: "0 auto", padding: "0 0 40px",
  },
  header: { padding: "20px 16px 14px" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "baseline", gap: 10 },
  logo: { color: "#E8A317", fontSize: 22 },
  title: { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" },
  city: { fontSize: 13, fontWeight: 700, color: "#fff", background: "#3C6E47", padding: "3px 9px", borderRadius: 20 },
  subtitle: { margin: "8px 0 0", color: "#8A8579", fontSize: 15 },
  loginBtn: {
    padding: "8px 14px", borderRadius: 20, border: "1px solid #3C6E47", background: "#3C6E47",
    color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  userBtn: {
    padding: "7px 12px", borderRadius: 20, border: "1px solid #D9D4C9", background: "#fff",
    color: "#4A473F", fontWeight: 600, fontSize: 13, cursor: "pointer", maxWidth: "100%",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  controls: {
    position: "sticky", top: 0, zIndex: 5, background: "#FBF9F4", display: "flex",
    flexDirection: "column", gap: 10, padding: "10px 16px 12px", borderBottom: "1px solid #ECE7DC",
  },
  select: {
    width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D9D4C9",
    background: "#fff", fontSize: 16, color: "#2B2A26", cursor: "pointer",
  },
  chipRow: { display: "flex", gap: 6, overflowX: "auto", alignItems: "center", scrollbarWidth: "none" },
  chip: {
    flexShrink: 0, padding: "7px 12px", borderRadius: 20, border: "1px solid #D9D4C9",
    background: "#fff", fontSize: 13, fontWeight: 600, color: "#4A473F", cursor: "pointer", whiteSpace: "nowrap",
  },
  chipOn: { background: "#3C6E47", color: "#fff", border: "1px solid #3C6E47" },
  main: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
  loginHint: {
    textAlign: "left", padding: "12px 14px", borderRadius: 12, border: "1px dashed #3C6E47",
    background: "#F1F7EF", color: "#2F5B37", fontSize: 14, lineHeight: 1.4, cursor: "pointer",
  },
  notice: {
    padding: "12px 14px", background: "#FFF6E2", border: "1px solid #F0DFB0",
    borderRadius: 10, color: "#7A5B16", fontSize: 14,
  },
  noticeError: { background: "#FDECEA", border: "1px solid #F3C4BE", color: "#8A2E22" },
  empty: { textAlign: "center", padding: "40px 16px", color: "#6B675D", fontSize: 14 },
  card: { background: "#fff", border: "1px solid #ECE7DC", borderRadius: 14, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" },
  cardCompact: { padding: 12, background: "#FDFCF9" },
  cardTop: { display: "flex", gap: 12, alignItems: "flex-start" },
  metaRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  category: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#3C6E47" },
  badge: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, textTransform: "uppercase", letterSpacing: ".04em" },
  badgeVegan: { background: "#E3F1E1", color: "#2F6B2A" },
  badgeVeggie: { background: "#FFF1D6", color: "#8A5A00" },
  mealName: { margin: "4px 0 0", fontSize: 17, fontWeight: 700, lineHeight: 1.3 },
  sides: { margin: "4px 0 0", fontSize: 13, color: "#6B675D", lineHeight: 1.4 },
  price: { textAlign: "right", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap" },
  priceLabel: { display: "block", fontSize: 10, fontWeight: 600, color: "#A8A294", textTransform: "uppercase", letterSpacing: ".04em" },
  smallToggle: {
    marginTop: 10, padding: 0, background: "none", border: "none", fontSize: 12,
    color: "#8A8579", textAlign: "left", cursor: "pointer", lineHeight: 1.5,
  },
  rateRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1EDE3", flexWrap: "wrap",
  },
  avgBox: { fontSize: 14 },
  commentBar: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 },
  smallAction: {
    padding: "4px 0", background: "none", border: "none", fontSize: 13, fontWeight: 600,
    color: "#3C6E47", cursor: "pointer",
  },
  textarea: {
    width: "100%", padding: 10, borderRadius: 10, border: "1px solid #D9D4C9",
    fontSize: 15, resize: "vertical", color: "#2B2A26",
  },
  ghostBtn: {
    padding: "8px 12px", borderRadius: 8, border: "1px solid #D9D4C9", background: "#fff",
    fontSize: 14, cursor: "pointer", color: "#4A473F",
  },
  smallPrimary: {
    padding: "8px 14px", borderRadius: 8, border: "1px solid #3C6E47", background: "#3C6E47",
    color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  commentList: { listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  comment: { background: "#F7F4EC", borderRadius: 10, padding: "8px 10px", fontSize: 14 },
  commentHead: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 13 },
  muted: { color: "#A8A294", fontSize: 12, margin: "8px 0 0" },
  extrasToggle: {
    marginTop: 8, padding: "10px 0", background: "none", border: "none", fontSize: 14,
    fontWeight: 700, color: "#3C6E47", textAlign: "left", cursor: "pointer",
  },
  footer: { textAlign: "center", color: "#A8A294", fontSize: 12, padding: "24px 16px 0", lineHeight: 1.6 },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(30,28,24,.45)", zIndex: 20,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: 480, background: "#FBF9F4", borderRadius: "18px 18px 0 0",
    padding: "18px 16px 28px", boxShadow: "0 -8px 30px rgba(0,0,0,.15)",
  },
  sheetHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  closeBtn: { background: "none", border: "none", fontSize: 28, lineHeight: 1, cursor: "pointer", color: "#8A8579" },
  field: { display: "block", marginBottom: 12 },
  fieldLabel: { display: "block", fontSize: 13, fontWeight: 700, color: "#6B675D", marginBottom: 4 },
  input: {
    width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D9D4C9",
    fontSize: 16, background: "#fff", color: "#2B2A26",
  },
  primaryBtn: {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #3C6E47",
    background: "#3C6E47", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
  },
  linkBtn: {
    width: "100%", marginTop: 10, padding: 8, background: "none", border: "none",
    color: "#3C6E47", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  toast: {
    position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 30,
    background: "#2B2A26", color: "#fff", padding: "10px 16px", borderRadius: 10,
    fontSize: 14, maxWidth: "calc(100% - 32px)", boxShadow: "0 6px 20px rgba(0,0,0,.2)",
  },
};
