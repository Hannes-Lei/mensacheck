import React, { useState, useRef, useEffect } from "react";
import { avatarUrl } from "./supabase.js";

// ============================================================================
// Gemeinsame Bausteine und das Aussehen (Farben, Abstände) der ganzen App
// ============================================================================

// Farben für helles und dunkles Design. In der App nutzen wir nur die
// Namen (C.text, C.card …); welches Design gilt, entscheidet globalCss.
const LIGHT = {
  bg: "#FBF9F4", card: "#FFFFFF", cardAlt: "#FDFCF9", input: "#FFFFFF",
  text: "#2B2A26", soft: "#6B675D", muted: "#8A8579", faint: "#A8A294", chipText: "#4A473F",
  line: "#ECE7DC", lineSoft: "#F1EDE3", border: "#D9D4C9",
  green: "#3C6E47", greenBg: "#3C6E47", onGreen: "#FFFFFF",
  gold: "#E8A317", starOff: "#D9D4C9",
  hintBg: "#F1F7EF", hintText: "#2F5B37",
  favBg: "#FFF0F0", favBorder: "#F5C9C9", favText: "#8A2E3A",
  noteBg: "#FFF6E2", noteBorder: "#F0DFB0", noteText: "#7A5B16",
  errBg: "#FDECEA", errBorder: "#F3C4BE", errText: "#8A2E22",
  veganBg: "#E3F1E1", veganText: "#2F6B2A", veggieBg: "#FFF1D6", veggieText: "#8A5A00",
  commentBg: "#F7F4EC", track: "#EEE9DD", winnerBg: "#FFF8E6",
  overlay: "rgba(30,28,24,.45)", navBg: "rgba(251,249,244,.96)",
  toastBg: "#2B2A26", toastText: "#FFFFFF", shadow: "rgba(0,0,0,.04)",
};
const DARK = {
  bg: "#161513", card: "#211F1C", cardAlt: "#1C1A18", input: "#1C1A18",
  text: "#EDEAE3", soft: "#C2BDB2", muted: "#9C968A", faint: "#7D776B", chipText: "#D6D1C7",
  line: "#2E2B27", lineSoft: "#2A2723", border: "#3D3934",
  green: "#86C994", greenBg: "#3F7E4E", onGreen: "#FFFFFF",
  gold: "#F0B13A", starOff: "#45413B",
  hintBg: "#1B2A1F", hintText: "#A9D8B3",
  favBg: "#2C1B1E", favBorder: "#5A2F36", favText: "#F2B8C0",
  noteBg: "#2A2416", noteBorder: "#4F4325", noteText: "#E9CD8A",
  errBg: "#2E1A17", errBorder: "#5C302A", errText: "#F2B3A8",
  veganBg: "#1F3321", veganText: "#9AD69F", veggieBg: "#33280F", veggieText: "#E8C373",
  commentBg: "#2A2723", track: "#2E2B27", winnerBg: "#2B2414",
  overlay: "rgba(0,0,0,.6)", navBg: "rgba(22,21,19,.94)",
  toastBg: "#EDEAE3", toastText: "#161513", shadow: "rgba(0,0,0,0)",
};

const cssVars = (t) => Object.entries(t).map(([k, v]) => `--${k}: ${v};`).join(" ");

// C.text wird zu "var(--text)" usw.
export const C = Object.fromEntries(Object.keys(LIGHT).map((k) => [k, `var(--${k})`]));

// Ein Stern, der ganz, halb oder gar nicht gefüllt sein kann
const STAR_PATH = "M12 2l2.95 6.62 7.05.68-5.33 4.73 1.56 7.04L12 17.4l-6.23 3.67 1.56-7.04L2 9.3l7.05-.68z";

function StarIcon({ fill, size }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block" }} aria-hidden="true">
        <path d={STAR_PATH} fill={C.starOff} />
      </svg>
      {fill > 0 && (
        <span style={{ position: "absolute", top: 0, left: 0, height: size, width: `${fill * 100}%`, overflow: "hidden" }}>
          <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block" }} aria-hidden="true">
            <path d={STAR_PATH} fill={C.gold} />
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
const AVATAR_COLORS = ["#EE6A24", "#22408F", "#3C6E47", "#B5651D", "#7B4FA0", "#C0392B", "#16808A"];
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
        style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover", background: C.track }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: AVATAR_COLORS[h % AVATAR_COLORS.length], color: "#fff",
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
  :root { ${cssVars(LIGHT)} color-scheme: light; }
  :root[data-theme="dark"] { ${cssVars(DARK)} color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); transition: background .2s; }
  input, textarea, select, button { font-family: inherit; }
  .hscroll::-webkit-scrollbar { display: none; }
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
  city: { fontSize: 13, fontWeight: 700, color: C.onGreen, background: C.greenBg, padding: "3px 9px", borderRadius: 20 },
  subtitle: { margin: "8px 0 0", color: C.muted, fontSize: 15 },
  h2: { fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" },
  h3: { fontSize: 13, fontWeight: 800, margin: "22px 0 10px", textTransform: "uppercase", letterSpacing: ".06em", color: C.soft },
  loginBtn: {
    padding: "8px 14px", borderRadius: 20, border: `1px solid ${C.greenBg}`, background: C.greenBg,
    color: C.onGreen, fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  userBtn: {
    padding: "7px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.card,
    color: C.chipText, fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  controls: {
    position: "sticky", top: 0, zIndex: 5, background: C.bg, display: "flex",
    flexDirection: "column", gap: 10, padding: "10px 16px 12px", borderBottom: `1px solid ${C.line}`,
  },
  select: {
    width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
    background: C.input, fontSize: 16, color: C.text, cursor: "pointer",
  },
  chipRow: { display: "flex", gap: 6, overflowX: "auto", alignItems: "center", scrollbarWidth: "none" },
  chip: {
    flexShrink: 0, padding: "7px 12px", borderRadius: 20, border: `1px solid ${C.border}`,
    background: C.card, fontSize: 13, fontWeight: 600, color: C.chipText, cursor: "pointer", whiteSpace: "nowrap",
  },
  chipOn: { background: C.greenBg, color: C.onGreen, border: `1px solid ${C.greenBg}` },
  main: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
  hint: {
    textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1px dashed ${C.green}`,
    background: C.hintBg, color: C.hintText, fontSize: 14, lineHeight: 1.4, cursor: "pointer",
  },
  favBanner: {
    padding: "12px 14px", borderRadius: 12, background: C.favBg, border: `1px solid ${C.favBorder}`,
    color: C.favText, fontSize: 14, lineHeight: 1.4,
  },
  notice: {
    padding: "12px 14px", background: C.noteBg, border: `1px solid ${C.noteBorder}`,
    borderRadius: 10, color: C.noteText, fontSize: 14,
  },
  winner: {
    display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
    padding: "12px 14px", borderRadius: 14, border: `2px solid ${C.gold}`,
    background: C.winnerBg, color: C.text, cursor: "pointer",
  },
  winnerLabel: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: C.gold },
  noticeError: { background: C.errBg, border: `1px solid ${C.errBorder}`, color: C.errText },
  empty: { textAlign: "center", padding: "36px 16px", color: C.soft, fontSize: 14, lineHeight: 1.5 },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, boxShadow: `0 1px 2px ${C.shadow}` },
  cardCompact: { padding: 12, background: C.cardAlt },
  cardTop: { display: "flex", gap: 12, alignItems: "flex-start" },
  metaRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  category: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.green },
  badge: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, textTransform: "uppercase", letterSpacing: ".04em" },
  badgeVegan: { background: C.veganBg, color: C.veganText },
  badgeVeggie: { background: C.veggieBg, color: C.veggieText },
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
    marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.lineSoft}`, flexWrap: "wrap",
  },
  commentBar: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 },
  smallAction: { padding: "4px 0", background: "none", border: "none", fontSize: 13, fontWeight: 600, color: C.green, cursor: "pointer" },
  textarea: { width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 15, resize: "vertical", color: C.text, background: C.input },
  ghostBtn: { padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 14, cursor: "pointer", color: C.chipText },
  smallPrimary: { padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.greenBg}`, background: C.greenBg, color: C.onGreen, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  commentList: { listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  comment: { background: C.commentBg, borderRadius: 10, padding: "8px 10px", fontSize: 14 },
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
  progressTrack: { height: 5, background: C.track, borderRadius: 4, marginTop: 8, overflow: "hidden" },
  progressFill: { height: "100%", background: C.green, borderRadius: 4 },

  // Navigation unten
  nav: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 15, background: C.navBg,
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
  overlay: { position: "fixed", inset: 0, background: C.overlay, zIndex: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  sheet: { width: "100%", maxWidth: 480, background: C.bg, borderRadius: "18px 18px 0 0", padding: "18px 16px 28px", boxShadow: "0 -8px 30px rgba(0,0,0,.25)" },
  sheetHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  closeBtn: { background: "none", border: "none", fontSize: 28, lineHeight: 1, cursor: "pointer", color: C.muted },
  field: { display: "block", marginBottom: 12 },
  fieldLabel: { display: "block", fontSize: 13, fontWeight: 700, color: C.soft, marginBottom: 4 },
  input: { width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 16, background: C.input, color: C.text },
  primaryBtn: { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.greenBg}`, background: C.greenBg, color: C.onGreen, fontSize: 16, fontWeight: 700, cursor: "pointer" },
  linkBtn: { width: "100%", marginTop: 10, padding: 8, background: "none", border: "none", color: C.green, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  toast: {
    position: "fixed", left: "50%", bottom: 84, transform: "translateX(-50%)", zIndex: 30,
    background: C.toastBg, color: C.toastText, padding: "10px 16px", borderRadius: 10,
    fontSize: 14, maxWidth: "calc(100% - 32px)", boxShadow: "0 6px 20px rgba(0,0,0,.2)",
  },
};
