import React, { useState, useRef, useEffect } from "react";
import { avatarUrl } from "./supabase.js";

// ============================================================================
// Gemeinsame Bausteine und das Aussehen (Farben, Abstände) der ganzen App
// ============================================================================

// Farben für helles und dunkles Design. In der App nutzen wir nur die
// Namen (C.text, C.card …); welches Design gilt, entscheidet globalCss.
const LIGHT = {
  bg: "#FFF4DF", card: "#FFFFFF", cardAlt: "#FFFBF2", input: "#FFFFFF",
  text: "#1A1A1A", soft: "#4A4A4A", muted: "#6B6560", faint: "#8F877C", chipText: "#1A1A1A",
  line: "#1A1A1A", lineSoft: "#EADFCB", border: "#1A1A1A",
  green: "#2D4BFF", greenBg: "#2D4BFF", onGreen: "#FFFFFF",
  gold: "#FFC93C", starOff: "#FFFFFF",
  hintBg: "#DDF5E8", hintText: "#1A1A1A",
  favBg: "#FFE1EC", favBorder: "#1A1A1A", favText: "#1A1A1A",
  noteBg: "#FFC93C", noteBorder: "#1A1A1A", noteText: "#1A1A1A",
  errBg: "#FFD9CF", errBorder: "#1A1A1A", errText: "#8A2410",
  veganBg: "#26C281", veganText: "#1A1A1A", veggieBg: "#FFC93C", veggieText: "#1A1A1A",
  commentBg: "#FFF4DF", track: "#F1E6CF", winnerBg: "#FF5A36",
  overlay: "rgba(26,26,26,.5)", navBg: "#FFFFFF",
  toastBg: "#1A1A1A", toastText: "#FFF4DF", shadow: "#1A1A1A",
  // Comic-Stil: Tinte (Ränder, Schatten) und Akzentfarben
  ink: "#1A1A1A", tomato: "#FF5A36", yellow: "#FFC93C", cobalt: "#2D4BFF", mint: "#26C281", pink: "#FF8FB8",
  onAccent: "#1A1A1A", starStroke: "#1A1A1A",
};
const DARK = {
  bg: "#1C1915", card: "#28241F", cardAlt: "#221F1A", input: "#221F1A",
  text: "#F6EEDF", soft: "#D6CCBA", muted: "#AFA594", faint: "#8C8373", chipText: "#F6EEDF",
  line: "#F6EEDF", lineSoft: "#3A352D", border: "#F6EEDF",
  green: "#8FA2FF", greenBg: "#3B57FF", onGreen: "#FFFFFF",
  gold: "#FFC93C", starOff: "#28241F",
  hintBg: "#173A2A", hintText: "#F6EEDF",
  favBg: "#4A2433", favBorder: "#F6EEDF", favText: "#F6EEDF",
  noteBg: "#5A4512", noteBorder: "#F6EEDF", noteText: "#F6EEDF",
  errBg: "#4A1F17", errBorder: "#F6EEDF", errText: "#FFC4B6",
  veganBg: "#26C281", veganText: "#1A1A1A", veggieBg: "#FFC93C", veggieText: "#1A1A1A",
  commentBg: "#221F1A", track: "#3A352D", winnerBg: "#FF5A36",
  overlay: "rgba(0,0,0,.65)", navBg: "#28241F",
  toastBg: "#F6EEDF", toastText: "#1C1915", shadow: "#000000",
  ink: "#F6EEDF", tomato: "#FF5A36", yellow: "#FFC93C", cobalt: "#3B57FF", mint: "#26C281", pink: "#FF8FB8",
  onAccent: "#1A1A1A", starStroke: "#F6EEDF",
};

// Comic-Stil: dicker Rand + harter Schatten
const INK = "2.5px solid var(--ink)";
const hard = (n = 4) => `${n}px ${n}px 0 var(--shadow)`;
export const FONT_HEAD = "'Bricolage Grotesque', 'DM Sans', system-ui, sans-serif";
export const FONT_BODY = "'DM Sans', system-ui, -apple-system, sans-serif";

const cssVars = (t) => Object.entries(t).map(([k, v]) => `--${k}: ${v};`).join(" ");

// C.text wird zu "var(--text)" usw.
export const C = Object.fromEntries(Object.keys(LIGHT).map((k) => [k, `var(--${k})`]));

// Ein Stern, der ganz, halb oder gar nicht gefüllt sein kann
const STAR_PATH = "M12 2l2.95 6.62 7.05.68-5.33 4.73 1.56 7.04L12 17.4l-6.23 3.67 1.56-7.04L2 9.3l7.05-.68z";

function StarIcon({ fill, size }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block" }} aria-hidden="true">
        <path d={STAR_PATH} fill={C.starOff} stroke={C.starStroke} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      {fill > 0 && (
        <span style={{ position: "absolute", top: 0, left: 0, height: size, width: `${fill * 100}%`, overflow: "hidden" }}>
          <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block" }} aria-hidden="true">
            <path d={STAR_PATH} fill={C.gold} stroke={C.starStroke} strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </span>
  );
}

const fillFor = (value, i) => Math.max(0, Math.min(1, value - i));

// Sterne zum Bewerten in Viertel-Schritten (0,25 bis 5).
// Wo man auf den Stern tippt, so viel wird er gefüllt (¼, ½, ¾, ganz).
// Am genauesten: mit dem Finger seitlich wischen, die Zahl daneben
// zeigt den Wert, losgelassen wird gespeichert.
export function Stars({ value, onRate, size = 28, disabled = false }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const [preview, setPreview] = useState(null);

  function valueAt(clientX) {
    const r = ref.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width - 0.01);
    return Math.max(0.25, Math.ceil((x / r.width) * 20) / 4);
  }

  const shown = preview ?? value ?? 0;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div
        ref={ref}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Deine Bewertung"
        aria-valuemin={0.25}
        aria-valuemax={5}
        aria-valuenow={value || 0}
        aria-valuetext={value ? `${formatStars(value)} von 5 Sternen` : "Noch nicht bewertet"}
        aria-disabled={disabled}
        onPointerDown={(e) => {
          if (disabled) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setPreview(valueAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (disabled) return;
          if (dragging.current || e.pointerType === "mouse") setPreview(valueAt(e.clientX));
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          const v = valueAt(e.clientX);
          setPreview(null);
          onRate(v);
        }}
        onPointerCancel={() => { dragging.current = false; setPreview(null); }}
        onPointerLeave={() => { if (!dragging.current) setPreview(null); }}
        onKeyDown={(e) => {
          if (disabled) return;
          const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.25 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.25 : 0;
          if (!step) return;
          e.preventDefault();
          onRate(Math.min(5, Math.max(0.25, (value || 0) + step)));
        }}
        style={{
          display: "inline-flex", gap: 3, padding: "4px 0",
          cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
          touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none",
          WebkitTapHighlightColor: "transparent", outlineOffset: 4,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} fill={fillFor(shown, i)} size={size} />)}
      </div>
      {preview != null && (
        <span style={{ fontSize: 15, fontWeight: 800, color: C.gold, minWidth: 34 }}>{formatStars(preview)}</span>
      )}
    </div>
  );
}

// Zahl mit Komma: 4.5 -> "4,5", 4.25 -> "4,25", 4 -> "4,0"
export function formatStars(v) {
  const n = Number(v);
  return n.toFixed(Number.isInteger(n * 2) ? 1 : 2).replace(".", ",");
}

// Nur-Anzeige, z.B. Durchschnitt 3,7 -> 3¾ Sterne (auf Viertel gerundet)
export function StarLine({ value, size = 14 }) {
  const v = Math.round(Number(value) * 4) / 4;
  return (
    <span
      style={{ display: "inline-flex", gap: 1, verticalAlign: "middle" }}
      role="img"
      aria-label={`${formatStars(value)} von 5 Sternen`}
    >
      {[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} fill={fillFor(v, i)} size={size} />)}
    </span>
  );
}

// Rundes Bild mit Anfangsbuchstaben, Farbe passend zum Namen
const AVATAR_COLORS = ["#FF5A36", "#2D4BFF", "#26C281", "#FFC93C", "#FF8FB8", "#9B6BFF", "#14B8C4"];
const AVATAR_DARK_TEXT = new Set(["#26C281", "#FFC93C", "#FF8FB8", "#14B8C4"]);
export function Avatar({ name = "?", size = 32, path = null }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [path]);
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const url = !broken && avatarUrl(path);
  if (url) {
    return (
      <img
        src={url} alt="" aria-hidden="true" loading="lazy" onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover", background: C.track, border: `${size >= 28 ? 2 : 1.5}px solid ${C.ink}` }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: AVATAR_COLORS[h % AVATAR_COLORS.length],
        color: AVATAR_DARK_TEXT.has(AVATAR_COLORS[h % AVATAR_COLORS.length]) ? "#1A1A1A" : "#fff",
        border: `${size >= 28 ? 2 : 1.5}px solid ${C.ink}`, fontFamily: FONT_HEAD,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: size * 0.45,
      }}
    >
      {[...name.trim()][0]?.toUpperCase() || "?"}
    </span>
  );
}

export function Chip({ active, onClick, children, ...rest }) {
  return (
    <button type="button" {...rest} onClick={onClick} style={{ ...styles.chip, ...(active ? styles.chipOn : {}) }}>
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

// Hell ist Standard. "Dunkel" setzt <html data-theme="dark">.
export const globalCss = `
  @import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;600;700;800&display=swap");
  :root { ${cssVars(LIGHT)} color-scheme: light; }
  :root[data-theme="dark"] { ${cssVars(DARK)} color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); transition: background .2s; }
  input, textarea, select, button { font-family: inherit; }
  h1, h2, h3 { font-family: ${FONT_HEAD}; }
  .hscroll::-webkit-scrollbar { display: none; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export const styles = {
  page: {
    minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT_BODY,
    maxWidth: 640, margin: "0 auto", padding: "0 0 100px",
  },
  header: { padding: "20px 16px 14px" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  logo: { color: C.tomato, fontSize: 22, WebkitTextStroke: `1.5px ${C.ink}` },
  title: { fontFamily: FONT_HEAD, fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: "-0.03em", lineHeight: 1 },
  city: {
    fontSize: 12, fontWeight: 800, color: C.onAccent, background: C.yellow, padding: "3px 9px", borderRadius: 7,
    border: `2px solid ${C.ink}`, textTransform: "uppercase", letterSpacing: ".08em", transform: "rotate(-6deg)", display: "inline-block",
  },
  subtitle: { margin: "8px 0 0", color: C.muted, fontSize: 15 },
  h2: { fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" },
  h3: { fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 800, margin: "22px 0 10px", color: C.text, letterSpacing: "-0.01em" },
  loginBtn: {
    padding: "8px 14px", borderRadius: 20, border: INK, background: C.cobalt, boxShadow: hard(3),
    color: "#FFFFFF", fontWeight: 800, fontSize: 14, cursor: "pointer",
  },
  userBtn: {
    padding: "7px 12px", borderRadius: 20, border: INK, background: C.card,
    color: C.chipText, fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  controls: {
    position: "sticky", top: 0, zIndex: 5, background: C.bg, display: "flex",
    flexDirection: "column", gap: 10, padding: "10px 16px 12px", borderBottom: INK,
  },
  select: {
    width: "100%", padding: "11px 12px", borderRadius: 14, border: INK, boxShadow: hard(3),
    background: C.input, fontSize: 16, fontWeight: 700, color: C.text, cursor: "pointer",
  },
  chipRow: { display: "flex", gap: 8, overflowX: "auto", alignItems: "center", scrollbarWidth: "none", padding: "2px 2px 4px" },
  chip: {
    flexShrink: 0, padding: "7px 13px", borderRadius: 20, border: INK,
    background: C.card, fontSize: 13, fontWeight: 700, color: C.chipText, cursor: "pointer", whiteSpace: "nowrap",
  },
  chipOn: { background: C.ink, color: C.bg, border: INK },
  main: { padding: "16px 16px", display: "flex", flexDirection: "column", gap: 16 },
  hint: {
    textAlign: "left", padding: "12px 14px", borderRadius: 14, border: `2.5px dashed ${C.ink}`,
    background: C.hintBg, color: C.hintText, fontSize: 14, lineHeight: 1.4, cursor: "pointer",
  },
  favBanner: {
    padding: "12px 14px", borderRadius: 14, background: C.favBg, border: INK, boxShadow: hard(3),
    color: C.favText, fontSize: 14, lineHeight: 1.4,
  },
  notice: {
    padding: "12px 14px", background: C.noteBg, border: INK, boxShadow: hard(3),
    borderRadius: 14, color: C.noteText, fontSize: 14,
  },
  winner: {
    display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
    padding: "14px 16px", borderRadius: 18, border: INK, boxShadow: hard(5),
    background: C.winnerBg, color: C.onAccent, cursor: "pointer", transform: "rotate(-1deg)",
  },
  winnerLabel: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: C.onAccent },
  noticeError: { background: C.errBg, border: INK, color: C.errText },
  empty: { textAlign: "center", padding: "36px 16px", color: C.soft, fontSize: 14, lineHeight: 1.5 },
  card: { background: C.card, border: INK, borderRadius: 18, padding: 16, boxShadow: hard(4) },
  cardCompact: { padding: 12, background: C.cardAlt },
  cardTop: { display: "flex", gap: 12, alignItems: "flex-start" },
  metaRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  category: {
    fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "#FFFFFF",
    background: C.cobalt, padding: "2px 8px", borderRadius: 6,
  },
  badge: { fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6, textTransform: "uppercase", letterSpacing: ".06em", border: `1.5px solid ${C.ink}` },
  badgeVegan: { background: C.veganBg, color: C.veganText },
  badgeVeggie: { background: C.veggieBg, color: C.veggieText },
  mealName: { margin: "6px 0 0", fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.01em" },
  sides: { margin: "4px 0 0", fontSize: 13, color: C.soft, lineHeight: 1.4 },
  price: { textAlign: "right", fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 19, whiteSpace: "nowrap" },
  priceLabel: { display: "block", fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: ".04em" },
  heartBtn: { background: "none", border: "none", fontSize: 22, lineHeight: 1, padding: "2px 0 0", cursor: "pointer" },
  smallToggle: {
    marginTop: 10, padding: 0, background: "none", border: "none", fontSize: 12,
    color: C.muted, textAlign: "left", cursor: "pointer", lineHeight: 1.5,
  },
  rateRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    marginTop: 12, paddingTop: 12, borderTop: `2px dashed ${C.ink}`, flexWrap: "wrap",
  },
  commentBar: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 },
  smallAction: { padding: "4px 0", background: "none", border: "none", fontSize: 13, fontWeight: 800, color: C.green, cursor: "pointer" },
  textarea: { width: "100%", padding: 10, borderRadius: 12, border: INK, fontSize: 15, resize: "vertical", color: C.text, background: C.input },
  ghostBtn: { padding: "8px 12px", borderRadius: 12, border: INK, background: C.card, fontSize: 14, fontWeight: 700, cursor: "pointer", color: C.chipText },
  smallPrimary: { padding: "8px 14px", borderRadius: 12, border: INK, background: C.greenBg, color: C.onGreen, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: hard(2) },
  commentList: { listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  comment: { background: C.commentBg, borderRadius: 12, padding: "8px 10px", fontSize: 14, border: `2px solid ${C.ink}` },
  commentHead: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 13 },
  mutedText: { color: C.faint, fontSize: 12, margin: "8px 0 0" },
  extrasToggle: { marginTop: 8, padding: "10px 0", background: "none", border: "none", fontSize: 14, fontWeight: 800, color: C.green, textAlign: "left", cursor: "pointer" },
  footer: { textAlign: "center", color: C.faint, fontSize: 12, padding: "24px 16px 0", lineHeight: 1.6 },

  // Ranglisten & Profil
  rankRow: {
    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
    background: C.card, border: INK, borderRadius: 16, boxShadow: hard(3),
  },
  rankNo: { width: 30, textAlign: "center", fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 800, color: C.text, flexShrink: 0 },
  rankName: { fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 800, lineHeight: 1.2 },
  rankMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  rankScore: { textAlign: "right", flexShrink: 0 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  statBox: { background: C.card, border: INK, borderRadius: 16, padding: "12px 8px", textAlign: "center", boxShadow: hard(3) },
  statNum: { fontFamily: FONT_HEAD, fontSize: 26, fontWeight: 800 },
  statLabel: { fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 2 },
  badgeGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 },
  badgeCard: { background: C.card, border: INK, borderRadius: 16, padding: 12, boxShadow: hard(3) },
  badgeLocked: { opacity: 0.55, filter: "grayscale(1)" },
  progressTrack: { height: 8, background: C.card, borderRadius: 6, marginTop: 8, overflow: "hidden", border: `2px solid ${C.ink}` },
  progressFill: { height: "100%", background: C.mint, borderRadius: 0 },

  // Navigation unten
  nav: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 15, background: C.navBg,
    borderTop: INK, display: "flex", justifyContent: "center",
    paddingBottom: "env(safe-area-inset-bottom)",
  },
  navInner: { display: "flex", width: "100%", maxWidth: 640, padding: "6px 6px 4px", gap: 4 },
  navBtn: {
    flex: 1, padding: "6px 4px 7px", background: "none", border: "2px solid transparent", borderRadius: 14, cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    fontSize: 12, fontWeight: 800, color: C.text, position: "relative",
  },
  navBtnOn: { background: C.tomato, border: `2px solid ${C.ink}`, color: C.onAccent },
  navIcon: { fontSize: 20, lineHeight: 1 },

  // Anmeldefenster & Hinweise
  overlay: { position: "fixed", inset: 0, background: C.overlay, zIndex: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  sheet: { width: "100%", maxWidth: 480, background: C.bg, borderRadius: "22px 22px 0 0", padding: "18px 16px 28px", borderTop: INK },
  sheetHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  closeBtn: { background: "none", border: "none", fontSize: 28, lineHeight: 1, cursor: "pointer", color: C.text },
  field: { display: "block", marginBottom: 12 },
  fieldLabel: { display: "block", fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 },
  input: { width: "100%", padding: "11px 12px", borderRadius: 12, border: INK, fontSize: 16, background: C.input, color: C.text },
  primaryBtn: { width: "100%", padding: "13px 14px", borderRadius: 14, border: INK, background: C.greenBg, color: C.onGreen, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: hard(3) },
  linkBtn: { width: "100%", marginTop: 10, padding: 8, background: "none", border: "none", color: C.green, fontSize: 14, fontWeight: 800, cursor: "pointer" },
  toast: {
    position: "fixed", left: "50%", bottom: 90, transform: "translateX(-50%)", zIndex: 30,
    background: C.toastBg, color: C.toastText, padding: "10px 16px", borderRadius: 12,
    fontSize: 14, fontWeight: 700, maxWidth: "calc(100% - 32px)", border: INK,
  },
};
