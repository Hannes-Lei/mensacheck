import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase.js";
import { friendlyError } from "./helpers.js";
import { seatLayout, SEAT_CANTEENS } from "./seatLayouts.js";
import { styles, C } from "./ui.jsx";

// ============================================================================
// Sitzplätze: "Wo sitzt ihr?" – Grundriss, Einchecken, Bin weg
// Sehen können einen Sitzplatz nur Leute aus den eigenen Gruppen (regelt
// die Datenbank). Nach 60 Minuten verschwindet er von selbst.
// ============================================================================

const GOLD = "#F2C14E";
const MINE = "#9FD3A8";

const clock = (iso) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const minutesLeft = (iso) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));
const active = (c) => c && new Date(c.expires_at).getTime() > Date.now();

// "Lisa", "Lisa & Tom", "Lisa, Tom & Ben", "Lisa, Tom +3"
export function joinNames(names) {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

// Gedrehte Tische (rot in Grad um die Mitte): Punkt ins Tisch-System drehen
function toTable(t, p) {
  if (!t.rot) return p;
  const cx = t.x + t.w / 2, cy = t.y + t.h / 2, a = (-t.rot * Math.PI) / 180;
  const dx = p.x - cx, dy = p.y - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}
// Umriss eines (evtl. gedrehten) Tischs als achsparalleles Rechteck – für die Namensschilder
function outerBox(t) {
  if (!t.rot) return t;
  const a = (t.rot * Math.PI) / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const w = t.w * c + t.h * sn, h = t.w * sn + t.h * c;
  return { x: t.x + t.w / 2 - w / 2, y: t.y + t.h / 2 - h / 2, w, h };
}
// Flächen: normal = Theke/Einbau, "hint" = getönte Ebene, "walk" = Durchgang (kein Essbereich), "solid" = Pfeiler, "out" = kein Mensa-Bereich
const areaStyle = (a) =>
  a.tone === "hint" ? { fill: C.hintBg, stroke: "none" }
  : a.tone === "walk" ? { fill: C.track, opacity: 0.45, stroke: "none" }
  : a.tone === "solid" ? { fill: C.muted, stroke: "none" }
  : a.tone === "out" ? { fill: C.bg, stroke: C.border, strokeDasharray: "6 6" }
  : { fill: C.track, stroke: C.border };
const spin = (o) => (o.rot ? `rotate(${o.rot} ${o.x + (o.w ?? o.s) / 2} ${o.y + (o.h ?? o.s) / 2})` : undefined);

// ---- Der Grundriss ----------------------------------------------------------
// Füllt den freien Platz im Fenster. Mit zwei Fingern (oder Strg + Mausrad)
// wird nur der Plan vergrößert, mit einem Finger verschoben, Tippen wählt den
// nächstgelegenen Tisch.
const MAX_ZOOM = 3;

function SeatMap({ layout, labels, mineAt, selected, onPick }) {
  const ref = useRef(null);
  const [vx, vy, vw, vh] = layout.viewBox.split(" ").map(Number);
  const full = { x: vx, y: vy, w: vw, h: vh };
  const [view, setView] = useState(full);
  const viewRef = useRef(view);
  viewRef.current = view;
  const gesture = useRef({ pointers: new Map(), moved: false });
  const zoomed = view.w < vw - 0.5;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Bildschirm-Punkt -> Plan-Koordinaten (Plan waagerecht mittig, oben bündig eingepasst)
  function box() {
    const r = ref.current.getBoundingClientRect();
    const rw = Math.min(r.width, (r.height * vw) / vh);
    return { left: r.left + (r.width - rw) / 2, top: r.top, rw }; // waagerecht mittig, oben bündig
  }
  function toPlan(cx, cy, v = viewRef.current) {
    const b = box();
    return { x: v.x + ((cx - b.left) / b.rw) * v.w, y: v.y + ((cy - b.top) / b.rw) * v.w };
  }
  function clamp(v) {
    const w = Math.min(vw, Math.max(vw / MAX_ZOOM, v.w));
    const h = (w * vh) / vw;
    return {
      w, h,
      x: Math.min(vx + vw - w, Math.max(vx, v.x)),
      y: Math.min(vy + vh - h, Math.max(vy, v.y)),
    };
  }
  // Zoomen um einen festen Punkt (anchor bleibt unter dem Finger)
  function zoomAt(anchor, cx, cy, newW) {
    const b = box();
    const w = Math.min(vw, Math.max(vw / MAX_ZOOM, newW));
    setView(clamp({ w, x: anchor.x - ((cx - b.left) / b.rw) * w, y: anchor.y - ((cy - b.top) / b.rw) * w }));
  }

  function pickAt(cx, cy) {
    const p = toPlan(cx, cy);
    const reach = 80 * (viewRef.current.w / vw);
    let best = null, bestD = reach;
    for (const t of layout.tables) {
      const q = toTable(t, p);
      const dx = Math.max(t.x - q.x, 0, q.x - (t.x + t.w));
      const dy = Math.max(t.y - q.y, 0, q.y - (t.y + t.h));
      const d = Math.hypot(dx, dy);
      if (d < bestD) { best = t; bestD = d; }
    }
    if (best) onPickRef.current(best.id);
  }

  // Gesten: gemeinsame Logik für Finger (Touch-Events) und Maus (Pointer-Events)
  function down(id, x, y) {
    const g = gesture.current;
    g.pointers.set(id, { x, y });
    if (g.pointers.size === 1) {
      g.moved = false;
      g.start = { x, y, view: viewRef.current };
    } else if (g.pointers.size === 2) {
      g.moved = true;
      const [a, b] = [...g.pointers.values()];
      g.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, anchor: toPlan((a.x + b.x) / 2, (a.y + b.y) / 2), w: viewRef.current.w };
    }
  }
  function move(id, x, y) {
    const g = gesture.current;
    if (!g.pointers.has(id)) return;
    g.pointers.set(id, { x, y });
    if (g.pointers.size >= 2 && g.pinch) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      zoomAt(g.pinch.anchor, (a.x + b.x) / 2, (a.y + b.y) / 2, (g.pinch.w * g.pinch.dist) / dist);
    } else if (g.pointers.size === 1 && g.start) {
      const dx = x - g.start.x, dy = y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) > 8) g.moved = true;
      if (g.moved) {
        const k = g.start.view.w / box().rw;
        setView(clamp({ ...g.start.view, x: g.start.view.x - dx * k, y: g.start.view.y - dy * k }));
      }
    }
  }
  function up(id, x, y, cancelled) {
    const g = gesture.current;
    if (!g.pointers.has(id)) return;
    g.pointers.delete(id);
    if (g.pointers.size === 0) {
      if (!g.moved && !cancelled) pickAt(x, y);
      g.start = null; g.pinch = null;
    } else if (g.pointers.size === 1) {
      // ein Finger bleibt liegen: ab hier verschieben, ohne Sprung
      const [p] = [...g.pointers.values()];
      g.pinch = null;
      g.start = { x: p.x, y: p.y, view: viewRef.current };
    }
  }
  // Maus (Laptop). Finger laufen über die Touch-Events unten.
  const isMouse = (e) => e.pointerType === "mouse";
  function onPointerDown(e) {
    if (!isMouse(e)) return;
    try { ref.current.setPointerCapture(e.pointerId); } catch { /* egal */ }
    down("m", e.clientX, e.clientY);
  }
  function onPointerMove(e) { if (isMouse(e)) move("m", e.clientX, e.clientY); }
  function onPointerUp(e) { if (isMouse(e)) up("m", e.clientX, e.clientY, e.type === "pointercancel"); }

  const zoomedRef = useRef(zoomed);
  zoomedRef.current = zoomed;

  // Strg + Mausrad / Trackpad-Zoom am Laptop; Safari-Gesten nicht an die Seite weitergeben
  useEffect(() => {
    const el = ref.current;
    const onWheel = (e) => {
      if (!e.ctrlKey && !zoomedRef.current) return;
      e.preventDefault();
      if (e.ctrlKey) {
        const v = viewRef.current;
        zoomAt(toPlan(e.clientX, e.clientY), e.clientX, e.clientY, v.w * Math.exp(e.deltaY * 0.01));
      } else {
        const v = viewRef.current, k = v.w / box().rw;
        setView(clamp({ ...v, x: v.x + e.deltaX * k, y: v.y + e.deltaY * k }));
      }
    };
    const stop = (e) => e.preventDefault();
    const each = (e, fn) => { for (const t of e.changedTouches) fn(t); };
    const onTouchStart = (e) => { e.preventDefault(); each(e, (t) => down(t.identifier, t.clientX, t.clientY)); };
    const onTouchMove = (e) => { e.preventDefault(); each(e, (t) => move(t.identifier, t.clientX, t.clientY)); };
    const onTouchEnd = (e) => { e.preventDefault(); each(e, (t) => up(t.identifier, t.clientX, t.clientY, e.type === "touchcancel")); };
    const opts = { passive: false };
    el.addEventListener("wheel", onWheel, opts);
    el.addEventListener("touchstart", onTouchStart, opts);
    el.addEventListener("touchmove", onTouchMove, opts);
    el.addEventListener("touchend", onTouchEnd, opts);
    el.addEventListener("touchcancel", onTouchEnd, opts);
    el.addEventListener("gesturestart", stop, opts);
    el.addEventListener("gesturechange", stop, opts);
    return () => {
      el.removeEventListener("wheel", onWheel, opts);
      el.removeEventListener("touchstart", onTouchStart, opts);
      el.removeEventListener("touchmove", onTouchMove, opts);
      el.removeEventListener("touchend", onTouchEnd, opts);
      el.removeEventListener("touchcancel", onTouchEnd, opts);
      el.removeEventListener("gesturestart", stop, opts);
      el.removeEventListener("gesturechange", stop, opts);
    };
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = view.w / vw; // Namensschilder bleiben beim Zoomen gleich groß
  const text = (x, y, t, size, rotate) => (
    <text
      x={x} y={y} fontSize={size} fontWeight="600" textAnchor="middle" letterSpacing="1"
      style={{ fill: C.faint }} transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}
    >{t}</text>
  );

  return (
    <div style={{ position: "relative", flex: "1 1 auto", minHeight: 320, margin: "0 -8px" }}>
      <svg
        ref={ref} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label="Grundriss der Mensa" preserveAspectRatio="xMidYMin meet"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: zoomed ? "grab" : "pointer", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
      >
        {layout.terrace && (
          <g>
            <path d={layout.terrace.d} style={{ fill: C.hintBg, stroke: C.border }} strokeWidth="3" strokeDasharray="14 10" />
            {text(layout.terrace.lx, layout.terrace.ly, layout.terrace.label, 24)}
          </g>
        )}
        <path d={layout.room} style={{ fill: C.cardAlt, stroke: layout.roomStroke === false ? "none" : C.soft }} strokeWidth="7" strokeLinejoin="round" />
        {layout.areas.map((a, i) => (
          <g key={i}>
            {a.d
              ? <path d={a.d} style={areaStyle(a)} strokeWidth="3" strokeLinejoin="round" />
              : <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={a.round ? Math.min(18, a.w / 4) : 4} style={areaStyle(a)} strokeWidth="3" />}
            {a.label && (a.angle
              ? <text x={a.lx} y={a.ly} fontSize={a.size} fontWeight="600" textAnchor="middle" letterSpacing="1" style={{ fill: C.faint }} transform={`rotate(${a.angle} ${a.lx} ${a.ly})`}>{a.label}</text>
              : text(a.lx, a.ly, a.label, a.size ?? (a.rotate ? 30 : 24), a.rotate))}
          </g>
        ))}
        {layout.walls.map((w, i) => (
          <path key={i} d={typeof w === "string" ? w : w.d} fill="none" style={{ stroke: C.soft }} strokeWidth={typeof w === "string" ? 5 : w.w} strokeLinecap="round" strokeDasharray={w.dash} />
        ))}
        {(layout.windows || []).map((d, i) => <path key={i} d={d} fill="none" style={{ stroke: C.cardAlt }} strokeWidth="2.5" />)}
        {(layout.doors || []).map((d, i) => <rect key={i} x={d.x} y={d.y} width={d.w} height={d.h} style={{ fill: C.cardAlt }} />)}
        {layout.stairs.map((st, i) => (
          <g key={i}>
            <rect x={st.x} y={st.y} width={st.w} height={st.h} rx="4" style={{ fill: C.track, stroke: C.border }} strokeWidth="3" />
            {Array.from({ length: st.steps }, (_, k) => {
              if (st.vertical) {
                const x = st.x + ((k + 1) * st.w) / (st.steps + 1);
                return <line key={k} x1={x} x2={x} y1={st.y + (st.inset ?? 8)} y2={st.y + st.h - (st.inset ?? 8)} style={{ stroke: C.border }} strokeWidth="3" />;
              }
              const y = st.y + ((k + 1) * st.h) / (st.steps + 1);
              return <line key={k} x1={st.x + (st.inset ?? 14)} x2={st.x + st.w - (st.inset ?? 14)} y1={y} y2={y} style={{ stroke: C.border }} strokeWidth={st.inset ? 2 : 3} />;
            })}
            {st.label && st.outdoor && text(st.x + st.w / 2, st.y - 14, st.label, 24)}
            {st.label && !st.outdoor && (
              <>
                <rect x={st.x + st.w / 2 - 125} y={st.y + st.h / 2 - 30} width="250" height="52" rx="8" style={{ fill: C.track }} />
                {text(st.x + st.w / 2, st.y + st.h / 2 + 7, st.label, 26)}
              </>
            )}
            {st.arrow && text(st.arrow.x, st.arrow.y, "↕", 34)}
          </g>
        ))}
        {(layout.rails || []).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="4" style={{ fill: C.track, stroke: C.border }} strokeWidth="2" />)}
        {layout.columns.map((c, i) => <rect key={i} x={c.x} y={c.y} width={c.w ?? c.s} height={c.h ?? c.s} rx={c.rx ?? 2} ry={c.ry ?? c.rx ?? 2} style={{ fill: C.muted }} transform={spin(c)} />)}
        {(layout.labels || []).map((l, i) => (
          <text key={i} x={l.x} y={l.y} fontSize={l.size} fontWeight="700" textAnchor="middle" letterSpacing="1" style={{ fill: C.faint }}
            transform={l.rot ? `rotate(${l.rot} ${l.x} ${l.y})` : undefined}>{l.text}</text>
        ))}

        {layout.tables.map((t) => {
          const isMine = mineAt === t.id;
          const hasFriends = !!labels[t.id];
          const fill = isMine ? MINE : hasFriends ? GOLD : t.tresen ? C.track : C.card;
          return (
            <rect
              key={t.id} x={t.x} y={t.y} width={t.w} height={t.h} rx={t.round ? t.w / 2 : Math.min(10, t.h / 3)}
              style={{ fill, stroke: isMine ? C.green : hasFriends ? "#B8860B" : C.border }}
              strokeWidth={isMine || hasFriends ? 5 : 3} transform={spin(t)}
            />
          );
        })}
        {selected && (() => {
          const t = layout.tables.find((x) => x.id === selected);
          return t && <rect x={t.x - 9} y={t.y - 9} width={t.w + 18} height={t.h + 18} rx={t.round ? t.w / 2 + 9 : 14} fill="none" style={{ stroke: C.green }} strokeWidth="8" transform={spin(t)} />;
        })()}

        {/* Namensschilder */}
        {layout.tables.map((t) => {
          const label = [mineAt === t.id ? "Du" : null, labels[t.id]].filter(Boolean).join(", ");
          if (!label) return null;
          const b = outerBox(t);
          const w = (44 + label.length * 19) * s, h = 68 * s;
          const right = b.x + b.w + 14 * s;
          const x = right + w > view.x + view.w ? b.x - 14 * s - w : right;
          const y = Math.min(Math.max(b.y + b.h / 2 - h / 2, view.y + 4 * s), view.y + view.h - h - 4 * s);
          return (
            <g key={"l" + t.id} pointerEvents="none">
              <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="#2B2A26" stroke="#fff" strokeOpacity=".6" strokeWidth={3 * s} />
              <text x={x + w / 2} y={y + 45 * s} fontSize={32 * s} fontWeight="700" textAnchor="middle" fill="#fff">{label}</text>
            </g>
          );
        })}
      </svg>
      {zoomed && (
        <button
          type="button" onClick={() => setView(full)}
          style={{ position: "absolute", right: 8, top: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, borderRadius: 18, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}
        >⤢ Ganzer Plan</button>
      )}
    </div>
  );
}

// ---- Das Fenster: Mensa wählen, Karte oder "Ich bin hier" -------------------
// Welche Mensa zuerst? 1. wo ich selbst eingecheckt bin, 2. wo zuletzt jemand
// aus meinen Gruppen eingecheckt hat, 3. die Mensa, die bei "Heute" gewählt ist.
function startCanteen(checkins, userId, homeCanteen) {
  const live = checkins.filter(active);
  const mine = live.find((c) => c.user_id === userId);
  if (mine) return mine.canteen_id;
  const latest = live.filter((c) => c.user_id !== userId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return latest?.canteen_id ?? homeCanteen ?? SEAT_CANTEENS[0];
}

export function SeatSheet({ onClose, userId, checkins, names, canteens, homeCanteen, reload, showToast }) {
  const [canteenId, setCanteenId] = useState(() => startCanteen(checkins, userId, homeCanteen));
  const plan = seatLayout(canteenId);
  const levels = plan ? (plan.levels || [plan]) : [];          // Mensen mit mehreren Ebenen (z.B. Galerie)
  const [level, setLevel] = useState(0);
  const canteenName = canteens.find((c) => c.id === canteenId)?.name || "Mensa";
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // iPhone: Zwei-Finger-Zoom der ganzen Seite verhindern, solange der Sitzplan offen ist
    const stop = (e) => e.preventDefault();
    const multi = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    const opts = { passive: false };
    document.addEventListener("gesturestart", stop, opts);
    document.addEventListener("gesturechange", stop, opts);
    document.addEventListener("touchmove", multi, opts);
    const meta = document.querySelector('meta[name="viewport"]');
    const before = meta?.getAttribute("content");
    if (meta) meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("gesturestart", stop, opts);
      document.removeEventListener("gesturechange", stop, opts);
      document.removeEventListener("touchmove", multi, opts);
      if (meta && before) meta.setAttribute("content", before);
    };
  }, [onClose]);
  useEffect(() => setSelected(null), [canteenId]);

  const live = checkins.filter(active);
  const myAnywhere = live.find((c) => c.user_id === userId);
  const mine = myAnywhere?.canteen_id === canteenId ? myAnywhere : null;
  const friends = live.filter((c) => c.user_id !== userId && c.canteen_id === canteenId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const countIn = (id) => live.filter((c) => c.user_id !== userId && c.canteen_id === id).length;
  const levelOf = (tid) => Math.max(0, levels.findIndex((l) => l.tables.some((t) => t.id === tid)));
  useEffect(() => { setLevel(mine?.table_id ? levelOf(mine.table_id) : 0); }, [canteenId, mine?.table_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const layout = levels[level] || levels[0] || null;
  const labels = useMemo(() => {
    const out = {};
    for (const c of friends) if (c.table_id) (out[c.table_id] ||= []).push(names.get(c.user_id) || "Jemand");
    for (const k in out) out[k] = joinNames(out[k]);
    return out;
  }, [friends, names]);

  async function checkIn(tableId) {
    setBusy(true);
    const { error } = await supabase.rpc("check_in", { p_canteen: canteenId, p_table: tableId });
    setBusy(false);
    if (error) return showToast(friendlyError(error));
    setSelected(null);
    await reload(); // der Hinweis unten im Fenster bestätigt das Einchecken
  }

  async function checkOut() {
    setBusy(true);
    const { error } = await supabase.rpc("check_out");
    setBusy(false);
    if (error) return showToast(friendlyError(error));
    await reload();
    showToast("Ausgecheckt. Guten Appetit gehabt! 👋");
  }

  const pick = (id) => setSelected((s) => (s === id || mine?.table_id === id ? null : id));
  const elsewhere = myAnywhere && !mine
    ? canteens.find((c) => c.id === myAnywhere.canteen_id)?.name || "einer anderen Mensa"
    : null;

  return (
    <div style={{ ...styles.overlay, alignItems: "stretch" }} onClick={onClose}>
      <div
        role="dialog" aria-label="Wo sitzt ihr?" onClick={(e) => e.stopPropagation()}
        style={{ ...styles.sheet, borderRadius: 0, maxWidth: 520, height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "14px 12px 24px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={onClose} aria-label="Schließen" style={{ border: "none", background: "none", fontSize: 24, color: C.muted, cursor: "pointer", padding: "4px 8px" }}>✕</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>🪑 Wo sitzt ihr?</div>
            <div style={{ fontSize: 13, color: C.muted }}>sehen nur deine Gruppen · 60 Min.</div>
          </div>
        </div>

        <select
          aria-label="Mensa wählen" value={canteenId} onChange={(e) => setCanteenId(Number(e.target.value))}
          style={{ ...styles.select, fontWeight: 700 }}
        >
          {canteens.map((c) => {
            const n = countIn(c.id);
            return <option key={c.id} value={c.id}>{c.name}{n ? ` · 👥 ${n}` : ""}</option>;
          })}
        </select>

        {levels.length > 1 && (
          <div style={{ display: "flex", gap: 6 }}>
            {levels.map((l, i) => {
              const here = (c) => c.table_id && l.tables.some((t) => t.id === c.table_id);
              const n = friends.filter(here).length;
              const me = mine && here(mine);
              return (
                <button key={i} type="button" onClick={() => { setLevel(i); setSelected(null); }}
                  style={{ ...styles.chip, ...(i === level ? styles.chipOn : {}), flex: 1, justifyContent: "center", fontSize: 13 }}>
                  {l.label}{me ? " · Du" : ""}{n ? ` · 👥 ${n}` : ""}
                </button>
              );
            })}
          </div>
        )}

        {layout ? (
          <SeatMap key={canteenId + "-" + level} layout={layout} labels={labels} mineAt={mine?.table_id} selected={selected} onPick={pick} />
        ) : (
          <div style={{ ...styles.empty, padding: "18px 12px" }}>
            <div style={{ fontSize: 34, marginBottom: 6 }}>🍽️</div>
            Für diese Mensa gibt's noch keinen Grundriss.<br />
            Du kannst trotzdem zeigen, dass du hier bist.
          </div>
        )}

        {friends.length > 0 ? (
          <div style={{ fontSize: 13, color: C.soft, textAlign: "center" }}>
            👥 {friends.map((c, i) => (
              <span key={c.user_id} style={{ whiteSpace: "nowrap" }}>
                {i > 0 && " · "}<strong>{names.get(c.user_id) || "Jemand"}</strong> seit {clock(c.created_at)}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.faint, textAlign: "center" }}>Gerade ist niemand aus deinen Gruppen hier.</div>
        )}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, paddingTop: 6 }}>
          {elsewhere && !selected && (
            <div style={{ fontSize: 12, color: C.faint, textAlign: "center" }}>Du bist gerade in der {elsewhere} eingecheckt.</div>
          )}
          {layout && selected ? (
            <>
              <button type="button" style={styles.primaryBtn} onClick={() => checkIn(selected)} disabled={busy}>
                {busy ? "Einen Moment…" : myAnywhere ? "Hierhin wechseln" : "Ich sitze hier"}
              </button>
              <div style={{ fontSize: 12, color: C.faint, textAlign: "center" }}>Sehen nur deine Gruppen · verschwindet nach 60 Min.</div>
            </>
          ) : mine ? (
            <>
              <div style={{ ...styles.hint, cursor: "default", textAlign: "center" }}>
                ✓ Deine Gruppen sehen, {mine.table_id ? "wo du sitzt" : "dass du hier bist"} · noch {minutesLeft(mine.expires_at)} Min.
              </div>
              <button type="button" style={styles.ghostBtn} onClick={checkOut} disabled={busy}>Bin weg</button>
            </>
          ) : layout ? (
            <div style={{ fontSize: 14, color: C.muted, textAlign: "center", padding: 8 }}>Tippe auf deinen Tisch · mit zwei Fingern zoomen</div>
          ) : (
            <>
              <button type="button" style={styles.primaryBtn} onClick={() => checkIn(null)} disabled={busy}>
                {busy ? "Einen Moment…" : myAnywhere ? "Ich bin jetzt hier" : "Ich bin hier"}
              </button>
              <div style={{ fontSize: 12, color: C.faint, textAlign: "center" }}>Sehen nur deine Gruppen · verschwindet nach 60 Min.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Die schmale Zeile in der Gruppe ----------------------------------------
export function SeatRow({ members, userId, checkins, onOpen }) {
  const ids = new Set(members.map((m) => m.user_id));
  const here = checkins.filter((c) => active(c) && ids.has(c.user_id));
  const others = here.filter((c) => c.user_id !== userId)
    .map((c) => members.find((m) => m.user_id === c.user_id)?.username || "Jemand");
  const me = here.some((c) => c.user_id === userId);

  let title = "Sitzplatz teilen", sub = "gerade niemand da";
  if (others.length) { title = "Wo sitzt ihr?"; sub = `${joinNames(others)} ${others.length === 1 ? "ist" : "sind"} in der Mensa${me ? " · du auch" : ""}`; }
  else if (me) { title = "Wo sitzt ihr?"; sub = "du bist eingecheckt"; }

  return (
    <button
      type="button" onClick={onOpen}
      style={{
        marginTop: 12, width: "100%", padding: "10px 12px", borderRadius: 12, border: "none",
        background: C.commentBg, display: "flex", alignItems: "center", gap: 8, fontSize: 14,
        color: C.text, cursor: "pointer", textAlign: "left",
      }}
    >
      <span>🪑</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>{title}</strong> <span style={{ color: others.length ? C.soft : C.faint }}>· {sub}</span>
      </span>
      <span style={{ color: C.faint }}>›</span>
    </button>
  );
}

// ---- Hinweis oben im Freunde-Tab --------------------------------------------
export function SeatNotice({ checkins, userId, names, canteens, onOpen }) {
  const friends = checkins.filter((c) => active(c) && c.user_id !== userId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  if (friends.length === 0) return null;
  const who = joinNames(friends.map((c) => names.get(c.user_id) || "Jemand"));
  const same = friends.every((c) => c.canteen_id === friends[0].canteen_id);
  const mensa = same ? canteens.find((c) => c.id === friends[0].canteen_id)?.name || "Mensa" : null;
  return (
    <button
      type="button" onClick={onOpen}
      style={{ ...styles.notice, background: C.noteBg, border: `1px solid ${C.noteBorder}`, color: C.noteText,
        display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer", fontSize: 14, width: "100%" }}
    >
      <span>🪑</span>
      <span style={{ flex: 1 }}>
        <strong>{who}</strong> {friends.length === 1 ? `ist seit ${clock(friends[0].created_at)}` : "sind gerade"} {mensa ? `in der ${mensa}` : "in der Mensa"}
      </span>
      <strong style={{ color: C.green, whiteSpace: "nowrap" }}>ansehen ›</strong>
    </button>
  );
}
