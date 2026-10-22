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

// ---- Der Grundriss ----------------------------------------------------------
function SeatMap({ layout, labels, mineAt, selected, onPick }) {
  const ref = useRef(null);
  const [vx, vy, vw, vh] = layout.viewBox.split(" ").map(Number);

  // Tippen: der nächstgelegene Tisch zählt (auch knapp daneben)
  function handleClick(e) {
    const svg = ref.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    let best = null, bestD = 80;
    for (const t of layout.tables) {
      const dx = Math.max(t.x - p.x, 0, p.x - (t.x + t.w));
      const dy = Math.max(t.y - p.y, 0, p.y - (t.y + t.h));
      const d = Math.hypot(dx, dy);
      if (d < bestD) { best = t; bestD = d; }
    }
    if (best) onPick(best.id);
  }

  const text = (x, y, t, size, rotate) => (
    <text
      x={x} y={y} fontSize={size} fontWeight="600" textAnchor="middle" letterSpacing="1"
      style={{ fill: C.faint }} transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}
    >{t}</text>
  );

  return (
    <svg
      ref={ref} viewBox={layout.viewBox} width="100%" role="img" aria-label="Grundriss der Mensa"
      onClick={handleClick} style={{ display: "block", cursor: "pointer", touchAction: "manipulation" }}
    >
      {layout.terrace && (
        <g>
          <path d={layout.terrace.d} style={{ fill: C.hintBg, stroke: C.border }} strokeWidth="3" strokeDasharray="14 10" />
          {text(layout.terrace.lx, layout.terrace.ly, layout.terrace.label, 24)}
        </g>
      )}
      <path d={layout.room} style={{ fill: C.cardAlt, stroke: C.soft }} strokeWidth="7" strokeLinejoin="round" />
      {layout.walls.map((d, i) => <path key={i} d={d} fill="none" style={{ stroke: C.soft }} strokeWidth="5" />)}
      {layout.doors.map((d, i) => <rect key={i} x={d.x} y={d.y} width={d.w} height={d.h} style={{ fill: C.cardAlt }} />)}
      {layout.areas.map((a, i) => (
        <g key={i}>
          <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={a.round ? 18 : 4} style={{ fill: C.track, stroke: C.border }} strokeWidth="3" />
          {a.label && text(a.lx, a.ly, a.label, a.rotate ? 30 : 24, a.rotate)}
        </g>
      ))}
      {layout.stairs.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="4" style={{ fill: C.track, stroke: C.border }} strokeWidth="3" />
          {Array.from({ length: s.steps }, (_, k) => {
            if (s.vertical) {
              const x = s.x + ((k + 1) * s.w) / (s.steps + 1);
              return <line key={k} x1={x} x2={x} y1={s.y + 8} y2={s.y + s.h - 8} style={{ stroke: C.border }} strokeWidth="3" />;
            }
            const y = s.y + ((k + 1) * s.h) / (s.steps + 1);
            return <line key={k} x1={s.x + 14} x2={s.x + s.w - 14} y1={y} y2={y} style={{ stroke: C.border }} strokeWidth="3" />;
          })}
          {s.label && s.outdoor && text(s.x + s.w / 2, s.y - 14, s.label, 24)}
          {s.label && !s.outdoor && (
            <>
              <rect x={s.x + s.w / 2 - 125} y={s.y + s.h / 2 - 30} width="250" height="52" rx="8" style={{ fill: C.track }} />
              {text(s.x + s.w / 2, s.y + s.h / 2 + 7, s.label, 26)}
            </>
          )}
          {s.arrow && text(s.arrow.x, s.arrow.y, "↕", 34)}
        </g>
      ))}
      {layout.rails.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="4" style={{ fill: C.track, stroke: C.border }} strokeWidth="2" />)}
      {layout.columns.map((c, i) => <rect key={i} x={c.x} y={c.y} width={c.s} height={c.s} rx="3" style={{ fill: C.muted }} />)}

      {layout.tables.map((t) => {
        const isMine = mineAt === t.id;
        const hasFriends = !!labels[t.id];
        const fill = isMine ? MINE : hasFriends ? GOLD : t.tresen ? C.track : C.card;
        return (
          <rect
            key={t.id} x={t.x} y={t.y} width={t.w} height={t.h} rx="10"
            style={{ fill, stroke: isMine ? C.green : hasFriends ? "#B8860B" : C.border }}
            strokeWidth={isMine || hasFriends ? 5 : 3}
          />
        );
      })}
      {selected && (() => {
        const t = layout.tables.find((x) => x.id === selected);
        return t && <rect x={t.x - 9} y={t.y - 9} width={t.w + 18} height={t.h + 18} rx="14" fill="none" style={{ stroke: C.green }} strokeWidth="8" />;
      })()}

      {/* Namensschilder */}
      {layout.tables.map((t) => {
        const label = [mineAt === t.id ? "Du" : null, labels[t.id]].filter(Boolean).join(", ");
        if (!label) return null;
        const w = 44 + label.length * 19;
        const right = t.x + t.w + 14;
        const x = right + w > vx + vw ? t.x - 14 - w : right;
        const y = Math.min(Math.max(t.y + t.h / 2 - 34, vy + 4), vy + vh - 72);
        return (
          <g key={"l" + t.id} pointerEvents="none">
            <rect x={x} y={y} width={w} height="68" rx="34" fill="#2B2A26" stroke="#fff" strokeOpacity=".6" strokeWidth="3" />
            <text x={x + w / 2} y={y + 45} fontSize="32" fontWeight="700" textAnchor="middle" fill="#fff">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- Das Fenster mit der Karte ---------------------------------------------
export function SeatSheet({ onClose, userId, checkins, names, canteens, reload, showToast }) {
  const canteenId = SEAT_CANTEENS[0]; // vorerst nur Mensa am Elsterbecken
  const layout = seatLayout(canteenId);
  const canteenName = canteens.find((c) => c.id === canteenId)?.name || "Mensa am Elsterbecken";
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const here = checkins.filter((c) => active(c) && c.canteen_id === canteenId);
  const mine = here.find((c) => c.user_id === userId);
  const friends = here.filter((c) => c.user_id !== userId).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const labels = useMemo(() => {
    const out = {};
    for (const c of friends) (out[c.table_id] ||= []).push(names.get(c.user_id) || "Jemand");
    for (const k in out) out[k] = joinNames(out[k]);
    return out;
  }, [friends, names]);

  async function checkIn() {
    setBusy(true);
    const { error } = await supabase.rpc("check_in", { p_canteen: canteenId, p_table: selected });
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
            <div style={{ fontSize: 13, color: C.muted }}>{canteenName} · sehen nur deine Gruppen</div>
          </div>
        </div>

        <SeatMap layout={layout} labels={labels} mineAt={mine?.table_id} selected={selected} onPick={pick} />

        {friends.length > 0 ? (
          <div style={{ fontSize: 13, color: C.soft, textAlign: "center" }}>
            👥 {friends.map((c, i) => (
              <span key={c.user_id} style={{ whiteSpace: "nowrap" }}>
                {i > 0 && " · "}<strong>{names.get(c.user_id) || "Jemand"}</strong> seit {clock(c.created_at)}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.faint, textAlign: "center" }}>Gerade sitzt niemand aus deinen Gruppen hier.</div>
        )}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, paddingTop: 6 }}>
          {selected ? (
            <>
              <button type="button" style={styles.primaryBtn} onClick={checkIn} disabled={busy}>
                {busy ? "Einen Moment…" : mine ? "Hierhin wechseln" : "Ich sitze hier"}
              </button>
              <div style={{ fontSize: 12, color: C.faint, textAlign: "center" }}>Sehen nur deine Gruppen · verschwindet nach 60 Min.</div>
            </>
          ) : mine ? (
            <>
              <div style={{ ...styles.hint, cursor: "default", textAlign: "center" }}>
                ✓ Deine Gruppen sehen, wo du sitzt · noch {minutesLeft(mine.expires_at)} Min.
              </div>
              <button type="button" style={styles.ghostBtn} onClick={checkOut} disabled={busy}>Bin weg</button>
            </>
          ) : (
            <div style={{ fontSize: 14, color: C.muted, textAlign: "center", padding: 8 }}>Tippe auf deinen Tisch</div>
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
  if (others.length) { title = "Wo sitzt ihr?"; sub = `${joinNames(others)} ${others.length === 1 ? "ist" : "sind"} da${me ? " · du auch" : ""}`; }
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
  const mensa = canteens.find((c) => c.id === friends[0].canteen_id)?.name || "der Mensa";
  return (
    <button
      type="button" onClick={onOpen}
      style={{ ...styles.notice, background: C.noteBg, border: `1px solid ${C.noteBorder}`, color: C.noteText,
        display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer", fontSize: 14, width: "100%" }}
    >
      <span>🪑</span>
      <span style={{ flex: 1 }}>
        <strong>{who}</strong> {friends.length === 1 ? `sitzt seit ${clock(friends[0].created_at)}` : "sitzen gerade"} in der {mensa}
      </span>
      <strong style={{ color: C.green, whiteSpace: "nowrap" }}>ansehen ›</strong>
    </button>
  );
}
