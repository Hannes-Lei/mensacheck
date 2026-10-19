import React, { useState } from "react";

// ============================================================================
// Gemeinsame Bausteine und das Aussehen (Farben, Abstände) der ganzen App
// ============================================================================

export const C = {
  bg: "#FBF9F4",
  card: "#fff",
  text: "#2B2A26",
  soft: "#6B675D",
  muted: "#8A8579",
  faint: "#A8A294",
  line: "#ECE7DC",
  border: "#D9D4C9",
  green: "#3C6E47",
  gold: "#E8A317",
  starOff: "#D9D4C9",
};

export function Stars({ value, onRate, size = 26, disabled = false }) {
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
              color: active ? C.gold : C.starOff,
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

// Nur-Anzeige von Sternen, z.B. "★★★★☆"
export function StarLine({ value, size = 14 }) {
  const full = Math.round(Number(value));
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }} aria-label={`${value} von 5 Sternen`}>
      <span style={{ color: C.gold }}>{"★".repeat(full)}</span>
      <span style={{ color: C.starOff }}>{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{ ...styles.chip, ...(active ? styles.chipOn : {}) }}>
      {children}
    </button>
  );
}

export function DietBadge({ diet }) {
  if (!diet) return null;
  const vegan = diet === "vegan";
  return (
    <span style={{ ...styles.badge, ...(vegan ? styles.badgeVegan : styles.badgeVeggie) }}>
      {vegan ? "vegan" : "vegetarisch"}
    </span>
  );
}

export const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.bg}; }
  input, textarea, select, button { font-family: inherit; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export const styles = {
  page: {
    minHeight: "100vh", background: C.bg, color: C.text,
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    maxWidth: 640, margin: "0 auto", padding: "0 0 96px",
  },
  header: { padding: "20px 16px 14px" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "baseline", gap: 10 },
  logo: { color: C.gold, fontSize: 22 },
  title: { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" },
  city: { fontSize: 13, fontWeight: 700, color: "#fff", background: C.green, padding: "3px 9px", borderRadius: 20 },
  subtitle: { margin: "8px 0 0", color: C.muted, fontSize: 15 },
  h2: { fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" },
  h3: { fontSize: 13, fontWeight: 800, margin: "22px 0 10px", textTransform: "uppercase", letterSpacing: ".06em", color: C.soft },
  loginBtn: {
    padding: "8px 14px", borderRadius: 20, border: `1px solid ${C.green}`, background: C.green,
    color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  userBtn: {
    padding: "7px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: "#fff",
    color: "#4A473F", fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  controls: {
    position: "sticky", top: 0, zIndex: 5, background: C.bg, display: "flex",
    flexDirection: "column", gap: 10, padding: "10px 16px 12px", borderBottom: `1px solid ${C.line}`,
  },
  select: {
    width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
    background: "#fff", fontSize: 16, color: C.text, cursor: "pointer",
  },
  chipRow: { display: "flex", gap: 6, overflowX: "auto", alignItems: "center", scrollbarWidth: "none" },
  chip: {
    flexShrink: 0, padding: "7px 12px", borderRadius: 20, border: `1px solid ${C.border}`,
    background: "#fff", fontSize: 13, fontWeight: 600, color: "#4A473F", cursor: "pointer", whiteSpace: "nowrap",
  },
  chipOn: { background: C.green, color: "#fff", border: `1px solid ${C.green}` },
  main: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
  hint: {
    textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1px dashed ${C.green}`,
    background: "#F1F7EF", color: "#2F5B37", fontSize: 14, lineHeight: 1.4, cursor: "pointer",
  },
  favBanner: {
    padding: "12px 14px", borderRadius: 12, background: "#FFF0F0", border: "1px solid #F5C9C9",
    color: "#8A2E3A", fontSize: 14, lineHeight: 1.4,
  },
  notice: {
    padding: "12px 14px", background: "#FFF6E2", border: "1px solid #F0DFB0",
    borderRadius: 10, color: "#7A5B16", fontSize: 14,
  },
  noticeError: { background: "#FDECEA", border: "1px solid #F3C4BE", color: "#8A2E22" },
  empty: { textAlign: "center", padding: "36px 16px", color: C.soft, fontSize: 14, lineHeight: 1.5 },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" },
  cardCompact: { padding: 12, background: "#FDFCF9" },
  cardTop: { display: "flex", gap: 12, alignItems: "flex-start" },
  metaRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  category: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.green },
  badge: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, textTransform: "uppercase", letterSpacing: ".04em" },
  badgeVegan: { background: "#E3F1E1", color: "#2F6B2A" },
  badgeVeggie: { background: "#FFF1D6", color: "#8A5A00" },
  mealName: { margin: "4px 0 0", fontSize: 17, fontWeight: 700, lineHeight: 1.3 },
  sides: { margin: "4px 0 0", fontSize: 13, color: C.soft, lineHeight: 1.4 },
  price: { textAlign: "right", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap" },
  priceLabel: { display: "block", fontSize: 10, fontWeight: 600, color: C.faint, textTransform: "uppercase", letterSpacing: ".04em" },
  heartBtn: { background: "none", border: "none", fontSize: 22, lineHeight: 1, padding: "2px 0 0", cursor: "pointer" },
  smallToggle: {
    marginTop: 10, padding: 0, background: "none", border: "none", fontSize: 12,
    color: C.muted, textAlign: "left", cursor: "pointer", lineHeight: 1.5,
  },
  rateRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1EDE3", flexWrap: "wrap",
  },
  commentBar: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 },
  smallAction: { padding: "4px 0", background: "none", border: "none", fontSize: 13, fontWeight: 600, color: C.green, cursor: "pointer" },
  textarea: { width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 15, resize: "vertical", color: C.text },
  ghostBtn: { padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", fontSize: 14, cursor: "pointer", color: "#4A473F" },
  smallPrimary: { padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.green}`, background: C.green, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  commentList: { listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  comment: { background: "#F7F4EC", borderRadius: 10, padding: "8px 10px", fontSize: 14 },
  commentHead: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 13 },
  mutedText: { color: C.faint, fontSize: 12, margin: "8px 0 0" },
  extrasToggle: { marginTop: 8, padding: "10px 0", background: "none", border: "none", fontSize: 14, fontWeight: 700, color: C.green, textAlign: "left", cursor: "pointer" },
  footer: { textAlign: "center", color: C.faint, fontSize: 12, padding: "24px 16px 0", lineHeight: 1.6 },

  // Ranglisten & Profil
  rankRow: {
    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
    background: C.card, border: `1px solid ${C.line}`, borderRadius: 12,
  },
  rankNo: { width: 30, textAlign: "center", fontSize: 18, fontWeight: 800, color: C.faint, flexShrink: 0 },
  rankName: { fontSize: 15, fontWeight: 700, lineHeight: 1.3 },
  rankMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  rankScore: { textAlign: "right", flexShrink: 0 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  statBox: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" },
  statNum: { fontSize: 22, fontWeight: 800 },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2 },
  badgeGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 },
  badgeCard: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 },
  badgeLocked: { opacity: 0.55, filter: "grayscale(1)" },
  progressTrack: { height: 5, background: "#EEE9DD", borderRadius: 4, marginTop: 8, overflow: "hidden" },
  progressFill: { height: "100%", background: C.green, borderRadius: 4 },

  // Navigation unten
  nav: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 15, background: "rgba(251,249,244,.96)",
    borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "center",
    paddingBottom: "env(safe-area-inset-bottom)", backdropFilter: "blur(8px)",
  },
  navInner: { display: "flex", width: "100%", maxWidth: 640 },
  navBtn: {
    flex: 1, padding: "10px 4px 12px", background: "none", border: "none", cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    fontSize: 12, fontWeight: 700, color: C.faint,
  },
  navBtnOn: { color: C.green },
  navIcon: { fontSize: 20, lineHeight: 1 },

  // Anmeldefenster & Hinweise
  overlay: { position: "fixed", inset: 0, background: "rgba(30,28,24,.45)", zIndex: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  sheet: { width: "100%", maxWidth: 480, background: C.bg, borderRadius: "18px 18px 0 0", padding: "18px 16px 28px", boxShadow: "0 -8px 30px rgba(0,0,0,.15)" },
  sheetHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  closeBtn: { background: "none", border: "none", fontSize: 28, lineHeight: 1, cursor: "pointer", color: C.muted },
  field: { display: "block", marginBottom: 12 },
  fieldLabel: { display: "block", fontSize: 13, fontWeight: 700, color: C.soft, marginBottom: 4 },
  input: { width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 16, background: "#fff", color: C.text },
  primaryBtn: { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.green}`, background: C.green, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" },
  linkBtn: { width: "100%", marginTop: 10, padding: 8, background: "none", border: "none", color: C.green, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  toast: {
    position: "fixed", left: "50%", bottom: 84, transform: "translateX(-50%)", zIndex: 30,
    background: C.text, color: "#fff", padding: "10px 16px", borderRadius: 10,
    fontSize: 14, maxWidth: "calc(100% - 32px)", boxShadow: "0 6px 20px rgba(0,0,0,.2)",
  },
};
