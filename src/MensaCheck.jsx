import React, { useState, useEffect, useMemo } from "react";

// ============================================================================
// MensaCheck Leipzig – Version 2: echte Speisepläne
// ----------------------------------------------------------------------------
// Die Gerichte kommen jetzt live von unserer Server-Funktion /api/mensa
// (Datei api/mensa.js), die sie bei OpenMensa abholt.
//
// Bewertungen werden in dieser Version noch NUR im Browser gehalten.
// Das gemeinsame Speichern für alle kommt im nächsten Schritt (Supabase).
// ============================================================================

const STORAGE_KEY = "mensacheck-mensa";

// Heutiges Datum in deutscher Zeit als "2026-10-19"
function todayBerlin() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

function formatPrice(p) {
  if (p == null) return null;
  return p.toFixed(2).replace(".", ",") + " €";
}

function dayLabel(iso, today) {
  const d = new Date(iso + "T12:00:00");
  const weekday = d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
  const date = d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
  if (iso === today) return `Heute · ${date}`;
  return `${weekday} · ${date}`;
}

function loadSavedCanteen() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function saveCanteen(id) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* privater Modus o.ä. – nicht schlimm */
  }
}

// ---- Sterne ----------------------------------------------------------------
function Stars({ value, onRate, size = 26 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onRate(n)}
            aria-label={`${n} von 5 Sternen`}
            style={{
              background: "none", border: "none", padding: "2px",
              cursor: "pointer", fontSize: size, lineHeight: 1,
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

// ---- Kleine Bausteine ------------------------------------------------------
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styles.chip, ...(active ? styles.chipOn : {}) }}
    >
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

// ---- Haupt-App -------------------------------------------------------------
export default function MensaCheck() {
  const today = todayBerlin();

  const [canteens, setCanteens] = useState([]);
  const [canteenId, setCanteenId] = useState(loadSavedCanteen() || 63);
  const [days, setDays] = useState([]);
  const [date, setDate] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dietFilter, setDietFilter] = useState("alle"); // alle | vegetarisch | vegan
  const [showExtras, setShowExtras] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  // Bewertungen (vorerst nur lokal):  { [mealId]: { sum, count, mine } }
  const [ratings, setRatings] = useState({});

  // 1) Liste der Mensen laden
  useEffect(() => {
    fetch("/api/mensa")
      .then((r) => r.json())
      .then((data) => setCanteens(data.canteens || []))
      .catch(() => setError("Die Mensa-Liste konnte nicht geladen werden."));
  }, []);

  // 2) Speiseplan der gewählten Mensa laden
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
        // Nur heute und die kommenden Tage, geschlossene Tage weglassen
        const upcoming = (data.days || []).filter(
          (d) => d.date >= today && !d.closed && d.meals.length > 0
        );
        setDays(upcoming);
        setDate(upcoming.some((d) => d.date === today) ? today : upcoming[0]?.date || null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [canteenId, today]);

  function chooseCanteen(id) {
    setCanteenId(id);
    saveCanteen(id);
  }

  function rate(mealId, stars) {
    setRatings((prev) => {
      const cur = prev[mealId] || { sum: 0, count: 0, mine: 0 };
      const sum = cur.sum - cur.mine + stars;
      const count = cur.mine ? cur.count : cur.count + 1;
      return { ...prev, [mealId]: { sum, count, mine: stars } };
    });
  }

  const currentDay = days.find((d) => d.date === date);

  const { mains, extras } = useMemo(() => {
    const meals = (currentDay?.meals || [])
      .filter((m) => {
        if (dietFilter === "vegan") return m.diet === "vegan";
        if (dietFilter === "vegetarisch") return m.diet === "vegan" || m.diet === "vegetarisch";
        return true;
      })
      .map((m) => {
        const r = ratings[m.id];
        return {
          ...m,
          _avg: r && r.count ? r.sum / r.count : 0,
          _count: r?.count || 0,
          _mine: r?.mine || 0,
        };
      });

    const sorted = sortByRating
      ? [...meals].sort((a, b) => b._avg - a._avg || b._count - a._count)
      : meals;

    return {
      mains: sorted.filter((m) => m.isMain),
      extras: sorted.filter((m) => !m.isMain),
    };
  }, [currentDay, dietFilter, ratings, sortByRating]);

  const canteenName = canteens.find((c) => c.id === canteenId)?.name || "Mensa";

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      <header style={styles.header}>
        <div style={styles.brandRow}>
          <span style={styles.logo}>◆</span>
          <h1 style={styles.title}>MensaCheck</h1>
          <span style={styles.city}>Leipzig</span>
        </div>
        <p style={styles.subtitle}>Was schmeckt heute in der {canteenName}?</p>
      </header>

      {/* Steuerleiste */}
      <div style={styles.controls}>
        <select
          aria-label="Mensa auswählen"
          value={canteenId}
          onChange={(e) => chooseCanteen(Number(e.target.value))}
          style={styles.select}
        >
          {canteens.length === 0 && <option value={canteenId}>Mensen werden geladen…</option>}
          {canteens.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
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
        {loading && <div style={styles.notice}>Speiseplan wird geladen…</div>}

        {!loading && error && (
          <div style={{ ...styles.notice, ...styles.noticeError }}>
            {error} Versuch es gleich noch einmal.
          </div>
        )}

        {!loading && !error && days.length === 0 && (
          <div style={styles.empty}>
            <p style={{ fontSize: 18, margin: "0 0 4px", color: "#2B2A26" }}>Kein Speiseplan verfügbar</p>
            <p style={{ margin: 0 }}>
              Diese Mensa hat in den nächsten Tagen nichts eingetragen.
              Probier eine andere Mensa.
            </p>
          </div>
        )}

        {!loading && !error && currentDay && mains.length === 0 && extras.length === 0 && (
          <div style={styles.empty}>Für diesen Filter gibt es heute nichts.</div>
        )}

        {!loading && !error && mains.map((m) => (
          <MealCard key={m.id} meal={m} onRate={(s) => rate(m.id, s)} />
        ))}

        {!loading && !error && extras.length > 0 && (
          <>
            <button type="button" onClick={() => setShowExtras((s) => !s)} style={styles.extrasToggle}>
              {showExtras ? "▾" : "▸"} Beilagen, Desserts & Smoothies ({extras.length})
            </button>
            {showExtras && extras.map((m) => (
              <MealCard key={m.id} meal={m} onRate={(s) => rate(m.id, s)} compact />
            ))}
          </>
        )}
      </main>

      <footer style={styles.footer}>
        Speiseplan: OpenMensa / Studentenwerk Leipzig · Preise für Studierende, ohne Gewähr.<br />
        Testversion – Bewertungen werden noch nicht für alle gespeichert.
      </footer>
    </div>
  );
}

// ---- Karte für ein Gericht -------------------------------------------------
function MealCard({ meal: m, onRate, compact = false }) {
  const [showAllergens, setShowAllergens] = useState(false);

  return (
    <article style={{ ...styles.card, ...(compact ? styles.cardCompact : {}) }}>
      <div style={styles.cardTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.metaRow}>
            <span style={styles.category}>{m.category}</span>
            <DietBadge diet={m.diet} />
          </div>
          <h3 style={{ ...styles.mealName, ...(compact ? { fontSize: 15 } : {}) }}>{m.name}</h3>
          {m.sides.length > 0 && (
            <p style={styles.sides}>mit {m.sides.join(", ")}</p>
          )}
        </div>
        {formatPrice(m.price) && (
          <div style={styles.price}>
            {formatPrice(m.price)}
            <span style={styles.priceLabel}>Studierende</span>
          </div>
        )}
      </div>

      {m.allergens.length > 0 && (
        <button type="button" onClick={() => setShowAllergens((s) => !s)} style={styles.allergenToggle}>
          {showAllergens ? `Allergene: ${m.allergens.join(", ")}` : "Allergene anzeigen"}
        </button>
      )}

      <div style={styles.rateRow}>
        <Stars value={m._mine} onRate={onRate} size={compact ? 22 : 26} />
        <div style={styles.avgBox}>
          {m._count > 0 ? (
            <>
              <strong style={{ color: "#2B2A26" }}>{m._avg.toFixed(1).replace(".", ",")}</strong>
              <span style={{ color: "#8A8579" }}>
                {" "}· {m._count} {m._count === 1 ? "Stimme" : "Stimmen"}
              </span>
            </>
          ) : (
            <span style={{ color: "#A8A294" }}>Noch keine Bewertung</span>
          )}
        </div>
      </div>
    </article>
  );
}

// ---- Styles ----------------------------------------------------------------
const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #FBF9F4; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const styles = {
  page: {
    minHeight: "100vh", background: "#FBF9F4", color: "#2B2A26",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    maxWidth: 640, margin: "0 auto", padding: "0 0 40px",
  },
  header: { padding: "24px 16px 14px" },
  brandRow: { display: "flex", alignItems: "baseline", gap: 10 },
  logo: { color: "#E8A317", fontSize: 22 },
  title: { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" },
  city: {
    fontSize: 13, fontWeight: 700, color: "#fff", background: "#3C6E47",
    padding: "3px 9px", borderRadius: 20,
  },
  subtitle: { margin: "8px 0 0", color: "#8A8579", fontSize: 15 },
  controls: {
    position: "sticky", top: 0, zIndex: 5, background: "#FBF9F4",
    display: "flex", flexDirection: "column", gap: 10,
    padding: "10px 16px 12px", borderBottom: "1px solid #ECE7DC",
  },
  select: {
    width: "100%", padding: "11px 12px", borderRadius: 10,
    border: "1px solid #D9D4C9", background: "#fff", fontSize: 16,
    color: "#2B2A26", cursor: "pointer",
  },
  chipRow: {
    display: "flex", gap: 6, overflowX: "auto", alignItems: "center",
    scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
  },
  chip: {
    flexShrink: 0, padding: "7px 12px", borderRadius: 20,
    border: "1px solid #D9D4C9", background: "#fff", fontSize: 13,
    fontWeight: 600, color: "#4A473F", cursor: "pointer", whiteSpace: "nowrap",
  },
  chipOn: { background: "#3C6E47", color: "#fff", border: "1px solid #3C6E47" },
  main: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
  notice: {
    padding: "14px 16px", background: "#FFF6E2", border: "1px solid #F0DFB0",
    borderRadius: 10, color: "#7A5B16", fontSize: 14,
  },
  noticeError: { background: "#FDECEA", border: "1px solid #F3C4BE", color: "#8A2E22" },
  empty: { textAlign: "center", padding: "40px 16px", color: "#6B675D", fontSize: 14 },
  card: {
    background: "#fff", border: "1px solid #ECE7DC", borderRadius: 14,
    padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  cardCompact: { padding: 12, background: "#FDFCF9" },
  cardTop: { display: "flex", gap: 12, alignItems: "flex-start" },
  metaRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  category: {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: ".06em", color: "#3C6E47",
  },
  badge: {
    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
    textTransform: "uppercase", letterSpacing: ".04em",
  },
  badgeVegan: { background: "#E3F1E1", color: "#2F6B2A" },
  badgeVeggie: { background: "#FFF1D6", color: "#8A5A00" },
  mealName: { margin: "4px 0 0", fontSize: 17, fontWeight: 700, lineHeight: 1.3 },
  sides: { margin: "4px 0 0", fontSize: 13, color: "#6B675D", lineHeight: 1.4 },
  price: { textAlign: "right", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap" },
  priceLabel: {
    display: "block", fontSize: 10, fontWeight: 600, color: "#A8A294",
    textTransform: "uppercase", letterSpacing: ".04em",
  },
  allergenToggle: {
    marginTop: 10, padding: 0, background: "none", border: "none",
    fontSize: 12, color: "#8A8579", textAlign: "left", cursor: "pointer",
    lineHeight: 1.5,
  },
  rateRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 12, marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1EDE3",
    flexWrap: "wrap",
  },
  avgBox: { fontSize: 14 },
  extrasToggle: {
    marginTop: 8, padding: "10px 0", background: "none", border: "none",
    fontSize: 14, fontWeight: 700, color: "#3C6E47", textAlign: "left", cursor: "pointer",
  },
  footer: {
    textAlign: "center", color: "#A8A294", fontSize: 12,
    padding: "24px 16px 0", lineHeight: 1.6,
  },
};
