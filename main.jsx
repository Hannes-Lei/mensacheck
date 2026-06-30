import React, { useState, useMemo } from "react";

// ============================================================================
// MensaCheck Leipzig – Prototyp mit DEMO-DATEN
// ----------------------------------------------------------------------------
// Diese Version läuft ohne Internet-Zugriff, damit du Oberfläche, Sternesystem
// und Sortierung sofort testen kannst. Die Gerichte unten sind Beispieldaten.
//
// Später ersetzen wir DEMO_DATA durch echte Daten – die über ein Backend
// (z.B. Supabase) von der Mensa geladen werden. Die restliche App bleibt gleich.
// ============================================================================

const TODAY = new Date();

const DEMO_DATA = {
  "Mensa am Park": [
    { id: 1, category: "Tagesgericht", name: "Spaghetti Bolognese mit Hartkäse", prices: { students: 3.15 }, notes: ["Rind", "Schwein", "glutenhaltiges Getreide", "Milch/Lactose"] },
    { id: 2, category: "Vegan", name: "Gebackener Blumenkohl mit Erdnuss-Curry und Basmatireis", prices: { students: 2.95 }, notes: ["vegan", "Erdnüsse", "Soja"] },
    { id: 3, category: "Schneller Teller", name: "Currywurst mit Pommes frites", prices: { students: 3.45 }, notes: ["Schwein", "Senf"] },
    { id: 4, category: "Fischgericht", name: "Seelachsfilet mit Dillsoße und Salzkartoffeln", prices: { students: 3.55 }, notes: ["Fisch", "Milch/Lactose"] },
    { id: 5, category: "Vegetarisch", name: "Käsespätzle mit Röstzwiebeln und Beilagensalat", prices: { students: 3.25 }, notes: ["vegetarisch", "Eier", "Milch/Lactose", "glutenhaltiges Getreide"] },
  ],
  "Mensa Academica": [
    { id: 6, category: "Tagesgericht", name: "Hähnchenbrust in Sesampanade mit Kaisergemüse", prices: { students: 3.35 }, notes: ["Geflügel", "Sesam", "Eier"] },
    { id: 7, category: "Vegan", name: "Linsen-Dal mit Kokosmilch und Naan", prices: { students: 2.85 }, notes: ["vegan", "glutenhaltiges Getreide"] },
    { id: 8, category: "Vegetarisch", name: "Gemüsemaultaschen in Salbeibutter", prices: { students: 3.05 }, notes: ["vegetarisch", "Eier", "Milch/Lactose"] },
    { id: 9, category: "Schneller Teller", name: "Pizza Margherita", prices: { students: 2.75 }, notes: ["vegetarisch", "Milch/Lactose", "glutenhaltiges Getreide"] },
  ],
  "Mensa am Elsterbecken": [
    { id: 10, category: "Tagesgericht", name: "Rindergulasch mit Rotkohl und Klößen", prices: { students: 3.65 }, notes: ["Rind", "glutenhaltiges Getreide"] },
    { id: 11, category: "Vegan", name: "Gebratener Tofu mit Wokgemüse und Reis", prices: { students: 2.95 }, notes: ["vegan", "Soja"] },
    { id: 12, category: "Vegetarisch", name: "Kartoffel-Gemüse-Auflauf", prices: { students: 2.85 }, notes: ["vegetarisch", "Milch/Lactose"] },
  ],
  "Mensa Peterssteinweg": [
    { id: 13, category: "Vegan", name: "Falafel-Bowl mit Hummus und Couscous", prices: { students: 3.05 }, notes: ["vegan", "Sesam", "glutenhaltiges Getreide"] },
    { id: 14, category: "Tagesgericht", name: "Schweineschnitzel mit Bratkartoffeln", prices: { students: 3.75 }, notes: ["Schwein", "Eier", "glutenhaltiges Getreide"] },
    { id: 15, category: "Vegetarisch", name: "Tomaten-Mozzarella-Pasta", prices: { students: 3.15 }, notes: ["vegetarisch", "Milch/Lactose", "glutenhaltiges Getreide"] },
  ],
  "Mensa am Medizincampus": [
    { id: 16, category: "Tagesgericht", name: "Putengeschnetzeltes mit Reis", prices: { students: 3.45 }, notes: ["Geflügel", "Milch/Lactose"] },
    { id: 17, category: "Vegan", name: "Süßkartoffel-Kokos-Eintopf", prices: { students: 2.95 }, notes: ["vegan"] },
  ],
};

const MENSEN = Object.keys(DEMO_DATA);

function formatPrice(p) {
  if (p == null) return null;
  return p.toFixed(2).replace(".", ",") + " €";
}

function Stars({ value, onRate, size = 24, interactive = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onMouseEnter={() => interactive && setHover(n)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => interactive && onRate?.(n)}
            aria-label={`${n} von 5 Sternen`}
            style={{
              background: "none", border: "none", padding: 0,
              cursor: interactive ? "pointer" : "default",
              fontSize: size, lineHeight: 1,
              color: active ? "#E8A317" : "#D9D4C9",
              transition: "color .12s, transform .12s",
              transform: interactive && hover === n ? "scale(1.18)" : "scale(1)",
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export default function MensaCheck() {
  const [selected, setSelected] = useState(MENSEN[0]);
  const [sortByRating, setSortByRating] = useState(false);
  const [ratings, setRatings] = useState({});

  const meals = DEMO_DATA[selected] || [];

  function rate(mealId, stars) {
    setRatings((prev) => {
      const cur = prev[mealId] || { sum: 0, count: 0, mine: 0 };
      const sum = cur.sum - cur.mine + stars;
      const count = cur.mine ? cur.count : cur.count + 1;
      return { ...prev, [mealId]: { sum, count, mine: stars } };
    });
  }

  const displayedMeals = useMemo(() => {
    const withAvg = meals.map((m) => {
      const r = ratings[m.id];
      const avg = r && r.count ? r.sum / r.count : 0;
      return { ...m, _avg: avg, _count: r?.count || 0, _mine: r?.mine || 0 };
    });
    if (sortByRating) {
      return [...withAvg].sort((a, b) => b._avg - a._avg || b._count - a._count);
    }
    return withAvg;
  }, [meals, ratings, sortByRating]);

  const prettyDate = TODAY.toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      <header style={styles.header}>
        <div style={styles.brandRow}>
          <span style={styles.logo}>◆</span>
          <h1 style={styles.title}>MensaCheck</h1>
          <span style={styles.city}>Leipzig</span>
        </div>
        <p style={styles.subtitle}>Was schmeckt heute? {prettyDate}</p>
      </header>

      <div style={styles.controls}>
        <label style={styles.label} htmlFor="mensa">Mensa</label>
        <select
          id="mensa"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={styles.select}
        >
          {MENSEN.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setSortByRating((s) => !s)}
          style={{ ...styles.toggle, ...(sortByRating ? styles.toggleOn : {}) }}
        >
          {sortByRating ? "★ Beste zuerst" : "Nach Bewertung sortieren"}
        </button>
      </div>

      <main style={styles.main}>
        {displayedMeals.map((m) => (
          <article key={m.id} style={styles.card}>
            <div style={styles.cardTop}>
              <div style={{ flex: 1 }}>
                <span style={styles.category}>{m.category}</span>
                <h3 style={styles.mealName}>{m.name}</h3>
              </div>
              {formatPrice(m.prices?.students) && (
                <div style={styles.price}>
                  {formatPrice(m.prices.students)}
                  <span style={styles.priceLabel}>Studierende</span>
                </div>
              )}
            </div>

            {m.notes?.length > 0 && (
              <div style={styles.tags}>
                {m.notes.slice(0, 6).map((n, i) => (
                  <span key={i} style={styles.tag}>{n}</span>
                ))}
              </div>
            )}

            <div style={styles.rateRow}>
              <Stars value={m._mine} onRate={(s) => rate(m.id, s)} interactive />
              <div style={styles.avgBox}>
                {m._count > 0 ? (
                  <>
                    <strong style={{ color: "#2B2A26" }}>
                      {m._avg.toFixed(1).replace(".", ",")}
                    </strong>
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
        ))}
      </main>

      <footer style={styles.footer}>
        Demo-Vorschau mit Beispieldaten · Preise für Studierende, ohne Gewähr.<br />
        Bewertungen werden noch nicht dauerhaft gespeichert.
      </footer>
    </div>
  );
}

const globalCss = `
  * { box-sizing: border-box; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const styles = {
  page: {
    minHeight: "100vh", background: "#FBF9F4", color: "#2B2A26",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    maxWidth: 640, margin: "0 auto", padding: "0 0 40px",
  },
  header: { padding: "28px 20px 18px" },
  brandRow: { display: "flex", alignItems: "baseline", gap: 10 },
  logo: { color: "#E8A317", fontSize: 22 },
  title: { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" },
  city: {
    fontSize: 13, fontWeight: 700, color: "#fff", background: "#3C6E47",
    padding: "3px 9px", borderRadius: 20, letterSpacing: ".02em",
  },
  subtitle: { margin: "8px 0 0", color: "#8A8579", fontSize: 15 },
  controls: {
    position: "sticky", top: 0, zIndex: 5, background: "#FBF9F4",
    display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
    padding: "12px 20px", borderBottom: "1px solid #ECE7DC",
  },
  label: { fontSize: 13, fontWeight: 700, color: "#6B675D" },
  select: {
    flex: 1, minWidth: 180, padding: "10px 12px", borderRadius: 10,
    border: "1px solid #D9D4C9", background: "#fff", fontSize: 15,
    color: "#2B2A26", cursor: "pointer",
  },
  toggle: {
    padding: "10px 14px", borderRadius: 10, border: "1px solid #D9D4C9",
    background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
    color: "#3C6E47",
  },
  toggleOn: { background: "#3C6E47", color: "#fff", borderColor: "#3C6E47" },
  main: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "#fff", border: "1px solid #ECE7DC", borderRadius: 14,
    padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  cardTop: { display: "flex", gap: 12, alignItems: "flex-start" },
  category: {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: ".06em", color: "#3C6E47",
  },
  mealName: { margin: "4px 0 0", fontSize: 17, fontWeight: 700, lineHeight: 1.3 },
  price: { textAlign: "right", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap" },
  priceLabel: {
    display: "block", fontSize: 10, fontWeight: 600, color: "#A8A294",
    textTransform: "uppercase", letterSpacing: ".04em",
  },
  tags: { display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 0" },
  tag: {
    fontSize: 11, color: "#6B675D", background: "#F4F1EA",
    padding: "3px 8px", borderRadius: 6,
  },
  rateRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid #F1EDE3",
  },
  avgBox: { fontSize: 14 },
  footer: {
    textAlign: "center", color: "#A8A294", fontSize: 12,
    padding: "24px 20px 0", lineHeight: 1.6,
  },
};
