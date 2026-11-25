import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { daysAgo, formatAvg, formatDate, shortDate, dishName, variantIsVeg, NO_TOPPING } from "./helpers.js";
import { Chip, StarLine, styles, C } from "./ui.jsx";
import { CommentItem, THREAD_SELECT } from "./Interactions.jsx";

// ============================================================================
// Ansicht "Rangliste": beste und schlechteste Gerichte
// ============================================================================

// So viele Stimmen braucht ein Gericht, um in der Liste aufzutauchen.
// Für den kleinen Freundestest reicht 2, später eher 3 bis 5.
const MIN_VOTES = 2;
const SHOW = 25;      // so viele Gerichte zuerst
const SHOW_MORE = 50; // nach „Weitere anzeigen"

const PERIODS = [
  { id: "week", label: "Diese Woche", since: () => daysAgo(6) },
  { id: "month", label: "30 Tage", since: () => daysAgo(29) },
  { id: "all", label: "Aller Zeiten", since: () => null },
];

const MEDALS = ["🥇", "🥈", "🥉"];

// Wok: „🍚 ohne 4,0 (2) · 🍗 3,5 (1) · 🥦 4,5 (3)"
const KINDS = [["ohne", "🍚 ohne"], ["meat", "🍗"], ["veg", "🥦"]];
function VariantLine({ v }) {
  if (!v || (!v.meat && !v.veg)) return null; // nur zeigen, wenn jemand ein Topping hatte
  const parts = KINDS.filter(([k]) => v[k]).map(([k, label]) => `${label} ${formatAvg(v[k].sum / v[k].n)} (${v[k].n})`);
  return (
    <div style={{ fontSize: 12, color: C.muted, marginTop: 4, display: "flex", flexWrap: "wrap", columnGap: 8, rowGap: 2 }}>
      {parts.map((t) => <span key={t} style={{ whiteSpace: "nowrap" }}>{t}</span>)}
    </div>
  );
}

// kleines Schild mit der Mensa, in der das Gericht bewertet wurde
const mensaTag = {
  display: "inline-block", padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
  background: C.hintBg, color: C.hintText, whiteSpace: "nowrap",
};

// Kommentare zu einem Gericht der Rangliste (aus dem gewählten Zeitraum)
function RankComments({ canteenId, mealName, since, ...thread }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let q = supabase
      .from("ratings")
      .select(THREAD_SELECT)
      .eq("canteen_id", canteenId)
      .eq("dish", dishName(mealName))
      .not("comment", "is", null)
      .neq("comment", "");
    if (since) q = q.gte("meal_date", since);
    q.order("created_at", { ascending: false }).limit(30).then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.warn("Kommentare:", error.message);
      setItems(error ? "fehler" : data || []);
    });
    return () => { cancelled = true; };
  }, [canteenId, mealName, since]);

  let content;
  if (items === null) content = <p style={styles.mutedText}>Kommentare werden geladen…</p>;
  else if (items === "fehler") content = <p style={styles.mutedText}>Kommentare konnten nicht geladen werden.</p>;
  else if (items.length === 0) content = <p style={styles.mutedText}>Noch keine Kommentare{since ? " in diesem Zeitraum" : ""}.</p>;
  else content = (
    <ul style={styles.commentList}>
      {items.map((c) => <CommentItem key={c.id} item={c} {...thread} dayNote={`am ${shortDate(c.meal_date)}`} />)}
    </ul>
  );
  return <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>{content}</div>;
}

export default function RankingTab({ canteens, canteenId, active, userId, username, friends, needLogin, showToast, noTextLimit = false }) {
  const [period, setPeriod] = useState("week");
  const [scope, setScope] = useState("all"); // "all" oder Mensa-Nummer
  const [mode, setMode] = useState("top"); // top | flop
  const [rows, setRows] = useState(null);
  const [byVariant, setByVariant] = useState({}); // Wok: Schnitt je Auswahl (ohne / Fleisch / veggie)
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(null); // Gericht, dessen Kommentare gerade offen sind

  // Bei anderer Auswahl wieder mit den ersten 25 anfangen und Kommentare zuklappen
  useEffect(() => { setShowAll(false); setOpen(null); }, [period, scope, mode]);

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

    // Wok: Bewertungen nach Topping getrennt zählen (kein Topping gewählt = ohne)
    // (die Datenbank zählt je Topping zusammen – Funktion wok_variant_stats)
    supabase.rpc("wok_variant_stats", { p_since: p.since(), p_canteen: scope === "all" ? null : scope }).then(({ data }) => {
      if (cancelled) return;
      const out = {};
      for (const r of data || []) {
        const kind = !r.variant || r.variant === NO_TOPPING ? "ohne" : variantIsVeg(r.variant) ? "veg" : "meat";
        const g = ((out[`${r.canteen_id}|${r.dish}`] ||= {})[kind] ||= { sum: 0, n: 0 });
        g.sum += Number(r.total); g.n += Number(r.votes);
      }
      setByVariant(out);
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
    return sorted.slice(0, SHOW_MORE);
  }, [rows, mode]);
  const visible = showAll ? list : list.slice(0, SHOW);

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

        {visible.map((r, i) => {
          const key = `${r.canteen_id}|${r.meal_name}`;
          const isOpen = open === key;
          const toggle = () => setOpen(isOpen ? null : key);
          return (
          <div key={key} style={{ ...styles.rankRow, display: "block" }}>
            {/* Antippen: Kommentare auf- bzw. zuklappen (ein anderes Gericht klappt das alte zu) */}
            <div
              role="button" tabIndex={0} aria-expanded={isOpen}
              onClick={toggle}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            >
            <div style={styles.rankNo}>{mode === "top" && i < 3 ? MEDALS[i] : i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.rankName}>{r.meal_name}</div>
              <div style={{ ...styles.rankMeta, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={mensaTag}>📍 {canteenName(r.canteen_id)}</span>
                {/* Am Pastateller steht im Namen nur die Soße – die Nudeln gibt es immer dazu */}
                {/pasta/i.test(r.category || "") && <span style={{ ...mensaTag, background: C.track, color: C.text }}>🍝 Nudelteller</span>}
                <span>zuletzt {formatDate(r.last_served)}</span>
              </div>
              <VariantLine v={byVariant[`${r.canteen_id}|${dishName(r.meal_name)}`]} />
            </div>
            <div style={styles.rankScore}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{formatAvg(r.avg_stars)}</div>
              <StarLine value={r.avg_stars} size={11} />
              <div style={{ fontSize: 11, color: C.muted }}>{r.votes} Stimmen</div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>💬 {isOpen ? "▴" : "▾"}</div>
            </div>
            </div>
            {isOpen && (
              <RankComments
                canteenId={r.canteen_id} mealName={r.meal_name} since={PERIODS.find((p) => p.id === period).since()}
                userId={userId} username={username} friends={friends} needLogin={needLogin} showToast={showToast} noTextLimit={noTextLimit}
              />
            )}
          </div>
          );
        })}

        {!showAll && list.length > SHOW && (
          <button type="button" style={styles.extrasToggle} onClick={() => setShowAll(true)}>
            ▾ Weitere anzeigen (bis Platz {Math.min(list.length, SHOW_MORE)})
          </button>
        )}

        {list.length > 0 && (
          <p style={{ ...styles.mutedText, textAlign: "center" }}>
            Nur Gerichte mit mindestens {MIN_VOTES} Stimmen.
          </p>
        )}
      </main>
    </>
  );
}
