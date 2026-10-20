import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { daysAgo, formatAvg, formatDate } from "./helpers.js";
import { Chip, StarLine, styles, C } from "./ui.jsx";

// ============================================================================
// Ansicht "Rangliste": beste und schlechteste Gerichte
// ============================================================================

// So viele Stimmen braucht ein Gericht, um in der Liste aufzutauchen.
// Für den kleinen Freundestest reicht 2, später eher 3 bis 5.
const MIN_VOTES = 2;
const SHOW = 20;

const PERIODS = [
  { id: "week", label: "Diese Woche", since: () => daysAgo(6) },
  { id: "month", label: "30 Tage", since: () => daysAgo(29) },
  { id: "all", label: "Aller Zeiten", since: () => null },
];

const MEDALS = ["🥇", "🥈", "🥉"];

// kleines Schild mit der Mensa, in der das Gericht bewertet wurde
const mensaTag = {
  display: "inline-block", padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
  background: C.hintBg, color: C.hintText, whiteSpace: "nowrap",
};

export default function RankingTab({ canteens, canteenId, active }) {
  const [period, setPeriod] = useState("week");
  const [scope, setScope] = useState("all"); // "all" oder Mensa-Nummer
  const [mode, setMode] = useState("top"); // top | flop
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    const p = PERIODS.find((x) => x.id === period);
    supabase
      .rpc("get_ranking", {
        p_since: p.since(),
        p_canteen: scope === "all" ? null : scope,
        p_min_votes: MIN_VOTES,
      })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError("Die Rangliste konnte nicht geladen werden.");
        setRows(data || []);
      });
    return () => { cancelled = true; };
  }, [active, period, scope]);

  const list = useMemo(() => {
    if (!rows) return [];
    const sorted = [...rows].sort((a, b) =>
      mode === "top"
        ? b.avg_stars - a.avg_stars || b.votes - a.votes
        : a.avg_stars - b.avg_stars || b.votes - a.votes
    );
    return sorted.slice(0, SHOW);
  }, [rows, mode]);

  const canteenName = (id) => canteens.find((c) => c.id === id)?.name || `Mensa ${id}`;

  return (
    <>
      <div style={styles.controls}>
        <div style={styles.chipRow}>
          <Chip active={mode === "top"} onClick={() => setMode("top")}>🏆 Top</Chip>
          <Chip active={mode === "flop"} onClick={() => setMode("flop")}>🙈 Flop</Chip>
        </div>
        <div style={styles.chipRow}>
          {PERIODS.map((p) => (
            <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</Chip>
          ))}
        </div>
        <select
          aria-label="Mensa für die Rangliste" style={styles.select}
          value={scope} onChange={(e) => setScope(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">Ganz Leipzig</option>
          {canteens.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <main style={styles.main}>
        <h2 style={styles.h2}>
          {mode === "top" ? "Die besten Gerichte" : "Die Flops"}
          <span style={{ color: C.faint, fontWeight: 600, fontSize: 15 }}>
            {" "}· {PERIODS.find((p) => p.id === period).label}
          </span>
        </h2>

        {rows === null && <div style={styles.notice}>Rangliste wird geladen…</div>}
        {error && <div style={{ ...styles.notice, ...styles.noticeError }}>{error}</div>}

        {rows !== null && !error && list.length === 0 && (
          <div style={styles.empty}>
            Noch zu wenige Bewertungen für eine Rangliste.<br />
            Ein Gericht braucht mindestens {MIN_VOTES} Stimmen. Holt eure Freunde dazu! 🍝
          </div>
        )}

        {list.map((r, i) => (
          <div key={`${r.canteen_id}|${r.meal_name}`} style={styles.rankRow}>
            <div style={styles.rankNo}>{mode === "top" && i < 3 ? MEDALS[i] : i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.rankName}>{r.meal_name}</div>
              <div style={{ ...styles.rankMeta, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={mensaTag}>📍 {canteenName(r.canteen_id)}</span>
                <span>zuletzt {formatDate(r.last_served)}</span>
              </div>
            </div>
            <div style={styles.rankScore}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{formatAvg(r.avg_stars)}</div>
              <StarLine value={r.avg_stars} size={11} />
              <div style={{ fontSize: 11, color: C.muted }}>{r.votes} Stimmen</div>
            </div>
          </div>
        ))}

        {list.length > 0 && (
          <p style={{ ...styles.mutedText, textAlign: "center" }}>
            Nur Gerichte mit mindestens {MIN_VOTES} Stimmen.
          </p>
        )}
      </main>
    </>
  );
}
