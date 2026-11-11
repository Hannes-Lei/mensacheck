import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { formatAvg, formatDate, todayBerlin, isMeatless } from "./helpers.js";
import { FONT_HEAD, C } from "./ui.jsx";
import { runConfetti } from "./Celebration.jsx";

// ============================================================================
// Schmausi Wrapped – dein Rückblick wie bei Spotify
// ----------------------------------------------------------------------------
// Jeden Monat einen Rückblick. Dazu am Semesterende eine Sonder-Ausgabe für das
// ganze Semester (siehe semesterSpecial).
// ============================================================================
export const WRAPPED_MODE = "month"; // "month" | "semester"

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Zeiträume: der letzte abgeschlossene und der laufende
export function wrappedPeriods(today = todayBerlin()) {
  const [y, mo] = today.split("-").map(Number); const m = mo - 1;
  if (WRAPPED_MODE === "semester") {
    // Wintersemester 1.10.–31.3., Sommersemester 1.4.–30.9.
    const sem = (yy, winter) => winter
      ? { key: `ws${yy}`, label: `Wintersemester ${String(yy).slice(2)}/${String(yy + 1).slice(2)}`, short: "Semester", start: iso(yy, 9, 1), end: iso(yy + 1, 2, 31) }
      : { key: `ss${yy}`, label: `Sommersemester ${yy}`, short: "Semester", start: iso(yy, 3, 1), end: iso(yy, 8, 30) };
    const cur = m >= 9 ? sem(y, true) : m <= 2 ? sem(y - 1, true) : sem(y, false);
    const prev = m >= 9 ? sem(y, false) : m <= 2 ? sem(y - 1, false) : sem(y - 1, true);
    return { done: prev, current: cur };
  }
  const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
  return {
    done: { key: `${py}-${pm}`, label: MONTHS[pm], short: "Monat", start: iso(py, pm, 1), end: iso(py, pm, lastDay(py, pm)) },
    current: { key: `${y}-${m}`, label: MONTHS[m], short: "Monat", start: iso(y, m, 1), end: today, running: true },
  };
}

const inPeriod = (p) => (r) => r.meal_date >= p.start && r.meal_date <= p.end;

// Sonder-Wrapped zum Semesterende – NUR in der vorlesungsfreien Zeit sichtbar.
// Tag und Monat (MMTT) von–bis; bei Bedarf hier an die echten Termine anpassen:
const LECTURE_FREE = {
  winter: { from: 207, to: 331 },   // 7. Februar – 31. März
  summer: { from: 715, to: 930 },   // 15. Juli – 30. September
};
export function semesterSpecial(today = todayBerlin()) {
  const [y, mo, d] = today.split("-").map(Number);
  const md = mo * 100 + d;
  const make = (key, label, start) => ({ key, label, short: "Semester", start, end: today, special: true });
  if (md >= LECTURE_FREE.winter.from && md <= LECTURE_FREE.winter.to)
    return make(`ws${y - 1}`, `Wintersemester ${String(y - 1).slice(2)}/${String(y).slice(2)}`, iso(y - 1, 9, 1));
  if (md >= LECTURE_FREE.summer.from && md <= LECTURE_FREE.summer.to)
    return make(`ss${y}`, `Sommersemester ${y}`, iso(y, 3, 1));
  return null;
}

// Hat man einen Rückblick schon bis zum Ende angeschaut? (je Gerät)
const seenKey = (key) => `mensacheck-wrapped-seen-${key}`;
function isSeen(key) { try { return localStorage.getItem(seenKey(key)) === "1"; } catch { return false; } }
function markSeen(key) {
  try { localStorage.setItem(seenKey(key), "1"); } catch { /* egal */ }
  window.dispatchEvent(new Event("schmausi-wrapped-seen"));
}

const countMine = (userId, p) => supabase.from("ratings").select("id", { count: "exact", head: true })
  .eq("user_id", userId).gte("meal_date", p.start).lte("meal_date", p.end).then(({ count }) => count || 0);

// Hinweis oben auf „Heute“, sobald ein neuer Rückblick da ist:
//   🎓 Semester-Sonderausgabe (in der vorlesungsfreien Zeit) – hat Vorrang
//   🎁 Monats-Wrapped vom letzten Monat
// Verschwindet, sobald man den Rückblick einmal bis zum Ende durchgetippt hat.
export function WrappedBanner({ userId, onOpen, active = true }) {
  const special = useMemo(() => semesterSpecial(), []);
  const month = useMemo(() => wrappedPeriods().done, []);
  const [has, setHas] = useState({ special: false, month: false });
  const [, rerender] = useState(0);
  const [party, setParty] = useState(false);
  useEffect(() => {
    if (!userId) { setHas({ special: false, month: false }); return undefined; }
    let alive = true;
    // Semester-Rückblick zählt auch, wenn er schon angesehen ist: solange er da ist,
    // gibt es keinen Monats-Hinweis (der Monat steht dann unter „Ich“ darunter)
    Promise.all([
      special ? countMine(userId, special) : 0,
      !isSeen(month.key) ? countMine(userId, month) : 0,
    ]).then(([s, m]) => { if (alive) setHas({ special: s > 0, month: m > 0 }); });
    const onSeen = () => rerender((n) => n + 1);
    window.addEventListener("schmausi-wrapped-seen", onSeen);
    return () => { alive = false; window.removeEventListener("schmausi-wrapped-seen", onSeen); };
  }, [userId, special, month]);

  const kind = has.special ? (isSeen(special.key) ? null : "special") : has.month && !isSeen(month.key) ? "month" : null;
  const sp = kind === "special";

  // Semester-Hinweis: einmal pro App-Start Konfetti
  useEffect(() => {
    if (!sp || !active) return;
    try { if (sessionStorage.getItem("schmausi-party") === special.key) return; sessionStorage.setItem("schmausi-party", special.key); } catch { /* egal */ }
    setParty(true);
  }, [sp, special, active]);

  if (!kind) return null;
  return (
    <>
      {party && <ConfettiLayer onDone={() => setParty(false)} />}
      <button
        type="button" onClick={() => onOpen(kind)} className={sp ? "wrap-banner wrap-banner-special" : "wrap-banner"}
        style={{
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", gap: 12, width: "calc(100% - 32px)", margin: "4px 16px 0", padding: sp ? "14px 14px" : "12px 14px",
          borderRadius: 16, border: `2.5px solid ${C.ink}`, boxShadow: `3px 3px 0 ${C.ink}`, cursor: "pointer", textAlign: "left",
          background: sp ? `linear-gradient(135deg, ${C.yellow} 0%, ${C.mint} 100%)` : `linear-gradient(135deg, ${C.tomato} 0%, ${C.pink} 55%, ${C.cobalt} 100%)`,
          color: sp ? "#1A1A1A" : "#fff",
        }}
      >
        {sp && <span className="wrap-shimmer" aria-hidden="true" />}
        <span style={{ fontSize: sp ? 34 : 30, lineHeight: 1, position: "relative" }}>{sp ? "🎓" : "🎁"}</span>
        <span style={{ flex: 1, minWidth: 0, position: "relative" }}>
          <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: sp ? 18 : 17, fontWeight: 800 }}>
            {sp ? "Dein Semester-Wrapped ist da!" : `Dein ${month.label}-Wrapped ist da!`}
          </span>
          <span style={{ display: "block", fontSize: 13 }}>
            {sp ? `${special.label} – tippe für deinen großen Rückblick →` : "Tippe für deinen Monatsrückblick →"}
          </span>
        </span>
      </button>
    </>
  );
}

// Konfetti über den ganzen Bildschirm (ca. 3 Sekunden, klickt nicht im Weg)
function ConfettiLayer({ onDone }) {
  const ref = React.useRef(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onDone(); return undefined; }
    const stop = runConfetti(ref.current, ["#FFC93C", "#26C281", "#FF5A36", "#2D4BFF", "#FF8FB8"]);
    const t = setTimeout(onDone, 3400);
    return () => { stop(); clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 60 }} />;
}

// Alles ausrechnen, was in den Rückblick kommt
function computeWrapped(mine, all, userId, friends, canteenName) {
  const n = mine.length;
  const days = new Set(mine.map((r) => r.meal_date));
  const byCanteen = {};
  for (const r of mine) byCanteen[r.canteen_id] = (byCanteen[r.canteen_id] || 0) + 1;
  const [topCanteen, topCount] = Object.entries(byCanteen).sort((a, b) => b[1] - a[1])[0] || [];
  const sorted = [...mine].sort((a, b) => b.stars - a.stars || (a.meal_date < b.meal_date ? 1 : -1));
  const best = sorted[0];
  const worst = [...mine].sort((a, b) => a.stars - b.stars || (a.meal_date < b.meal_date ? 1 : -1))[0];
  const avg = n ? mine.reduce((s, r) => s + Number(r.stars), 0) / n : 0;
  const comments = mine.filter((r) => r.comment).length;
  const meatless = n ? Math.round((mine.filter(isMeatless).length / n) * 100) : 0;
  const wd = {};
  for (const d of days) { const k = new Date(d + "T12:00:00Z").getUTCDay(); wd[k] = (wd[k] || 0) + 1; }
  const favDay = Object.entries(wd).sort((a, b) => b[1] - a[1])[0];

  // Wie streng im Vergleich? (alle mit mind. 3 Bewertungen im Zeitraum)
  let stricter = null;
  if (all) {
    const per = {};
    for (const r of all) { (per[r.user_id] ||= []).push(Number(r.stars)); }
    const avgs = Object.entries(per).filter(([u, s]) => u !== userId && s.length >= 3).map(([, s]) => s.reduce((a, b) => a + b, 0) / s.length);
    if (avgs.length >= 3 && n >= 3) stricter = Math.round((avgs.filter((a) => a > avg).length / avgs.length) * 100);
  }

  // Mensa-Buddy: wer aus deinen Gruppen war am häufigsten am selben Tag in derselben Mensa?
  let buddy = null;
  if (all && friends?.size) {
    const mineKeys = new Set(mine.map((r) => `${r.canteen_id}|${r.meal_date}`));
    const cnt = {};
    for (const r of all) {
      if (!friends.has(r.user_id) || !mineKeys.has(`${r.canteen_id}|${r.meal_date}`)) continue;
      (cnt[r.user_id] ||= new Set()).add(`${r.canteen_id}|${r.meal_date}`);
    }
    const top = Object.entries(cnt).map(([u, s]) => [u, s.size]).sort((a, b) => b[1] - a[1])[0];
    if (top) buddy = { name: friends.get(top[0]), times: top[1] };
  }

  // Dein Mensa-Typ
  const canteens = Object.keys(byCanteen).length;
  let type;
  if (buddy && buddy.times >= Math.max(3, n * 0.5)) type = { emoji: "🫶", name: "Mensa-Rudel", text: "Allein essen? Nicht mit dir. Du bist fast immer mit deinen Leuten unterwegs." };
  else if (canteens >= 3) type = { emoji: "🧭", name: "Mensa-Weltreisender", text: `${canteens} verschiedene Mensen – du kennst Leipzig besser als der Speiseplan.` };
  else if (n >= 4 && topCount / n >= 0.8) type = { emoji: "🏠", name: "Stammgast", text: `Die ${canteenName(Number(topCanteen))} ist dein zweites Zuhause.` };
  else if (n >= 3 && avg <= 2.75) type = { emoji: "🧐", name: "Strenge Kritikerin / Strenger Kritiker", text: "Dich beeindruckt so schnell nichts. Gut, dass jemand ehrlich ist." };
  else if (n >= 3 && avg >= 4.25) type = { emoji: "😋", name: "Genießer:in", text: "Für dich ist fast jedes Mittagessen ein Fest." };
  else if (n >= 3 && comments / n >= 0.5) type = { emoji: "✍️", name: "Wortkünstler:in", text: "Bei dir gibt's zu jedem Teller eine Meinung – und alle lesen mit." };
  else if (meatless >= 70 && n >= 3) type = { emoji: "🥦", name: "Grünzeug-Fan", text: `${meatless} % deiner Gerichte waren ohne Fleisch.` };
  else type = { emoji: "🍽️", name: "Allrounder:in", text: "Mal Pasta, mal Schnitzel, mal Experiment – du probierst dich durch." };

  // Nur fürs Semester: deine Top 3 (verschiedene Gerichte) und dein stärkster Monat
  const top5 = [];
  for (const r of sorted) { if (!top5.some((t) => t.meal_name === r.meal_name)) top5.push(r); if (top5.length === 5) break; }
  // Dauerbrenner: das Gericht, das du am öftesten bewertet hast (mind. 2×)
  const dishCnt = {};
  for (const r of mine) { const k = r.meal_name.trim().toLowerCase(); (dishCnt[k] ||= { name: r.meal_name, count: 0, sum: 0 }); dishCnt[k].count++; dishCnt[k].sum += Number(r.stars); }
  const regular = Object.values(dishCnt).sort((a, b) => b.count - a.count)[0];
  // Längste Serie: Mensatage am Stück (Freitag → Montag zählt als durchgehend)
  const nextWorkday = (d) => { const t = new Date(d + "T12:00:00Z"); do { t.setUTCDate(t.getUTCDate() + 1); } while ([0, 6].includes(t.getUTCDay())); return t.toISOString().slice(0, 10); };
  let streak = 0, run = 0, prev = null;
  for (const d of [...days].sort()) { run = prev && nextWorkday(prev) === d ? run + 1 : 1; streak = Math.max(streak, run); prev = d; }
  const canteenRank = Object.entries(byCanteen).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, c]) => ({ id: Number(id), count: c }));
  const byMonth = {};
  for (const r of mine) { const k = Number(r.meal_date.slice(5, 7)) - 1; byMonth[k] = (byMonth[k] || 0) + 1; }
  const topMonth = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];

  return { n, days: days.size, canteens, topCanteen: topCanteen && Number(topCanteen), topCount, best, worst, avg, comments, meatless, favDay: favDay && DAYS[favDay[0]], stricter, buddy, type, top5, regular: regular && regular.count >= 2 ? { ...regular, avg: regular.sum / regular.count } : null, streak, canteenRank, topMonth: topMonth && { name: MONTHS[topMonth[0]], count: topMonth[1] } };
}

// ---- Karte im Tab "Ich" ------------------------------------------------------
export function WrappedCard({ ratings, userId, friends, canteenName, openRequest = null }) {
  const periods = useMemo(() => wrappedPeriods(), []);
  const special = useMemo(() => semesterSpecial(), []);
  const [open, setOpen] = useState(null);
  // Vom Hinweis auf „Heute“ aus geöffnet → passenden Rückblick direkt starten
  const handled = React.useRef(0);
  useEffect(() => {
    if (!openRequest || openRequest.n === handled.current || !ratings) return;
    handled.current = openRequest.n;
    if (openRequest.kind === "special" && special) setOpen(special);
    else if (openRequest.kind === "month") setOpen(periods.done);
  }, [openRequest, ratings, special, periods]);
  if (!ratings) return null;
  const specialN = special ? ratings.filter(inPeriod(special)).length : 0;
  const doneN = ratings.filter(inPeriod(periods.done)).length;
  // Nur abgeschlossene Monate – der laufende bleibt eine Überraschung (Hannes, 11.11.)
  if (!doneN && !specialN) return null;
  const main = periods.done;
  const mainN = doneN;

  return (
    <>
      {specialN > 0 && (
        <button
          type="button" onClick={() => setOpen(special)}
          style={{
            width: "100%", textAlign: "left", marginTop: 16, padding: "16px 16px 14px", borderRadius: 18, cursor: "pointer",
            border: `2.5px solid ${C.ink}`, boxShadow: `4px 4px 0 ${C.ink}`, color: "#1A1A1A",
            background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.mint} 100%)`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>🎓 Sonder-Ausgabe · Schmausi Wrapped</div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 800, margin: "2px 0 4px" }}>
            Dein {special.label}
          </div>
          <div style={{ fontSize: 14 }}>{specialN} {specialN === 1 ? "Gericht" : "Gerichte"} im ganzen Semester · Tippe für den großen Rückblick →</div>
        </button>
      )}
      {doneN > 0 && <button
        type="button" onClick={() => setOpen(main)}
        style={{
          width: "100%", textAlign: "left", marginTop: 16, padding: "16px 16px 14px", borderRadius: 18, cursor: "pointer",
          border: `2.5px solid ${C.ink}`, boxShadow: `4px 4px 0 ${C.ink}`, color: "#fff",
          background: `linear-gradient(135deg, ${C.tomato} 0%, ${C.pink} 55%, ${C.cobalt} 100%)`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.9 }}>🎁 Schmausi Wrapped</div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 800, margin: "2px 0 4px" }}>
          Dein {main.label}
        </div>
        <div style={{ fontSize: 14, opacity: 0.95 }}>{mainN} {mainN === 1 ? "Gericht" : "Gerichte"} · Tippe für deinen Rückblick →</div>
      </button>}
      {open && <WrappedStory period={open} ratings={ratings} userId={userId} friends={friends} canteenName={canteenName} onClose={() => setOpen(null)} />}
    </>
  );
}

// ---- Die Story (Vollbild, Tippen = weiter) ----------------------------------
function WrappedStory({ period, ratings, userId, friends, canteenName, onClose }) {
  const mine = useMemo(() => ratings.filter(inPeriod(period)), [ratings, period]);
  const [all, setAll] = useState(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    supabase.from("ratings").select("user_id, canteen_id, meal_date, stars")
      .gte("meal_date", period.start).lte("meal_date", period.end).limit(20000)
      .then(({ data }) => setAll(data || []));
  }, [period]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") setI((x) => x + 1); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const w = useMemo(() => computeWrapped(mine, all, userId, friends, canteenName), [mine, all, userId, friends, canteenName]);
  const when = `${period.label}${period.running ? " (bis jetzt)" : ""}`;
  const big = { fontFamily: FONT_HEAD, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.02em" };

  const slides = [
    period.special ? { bg: C.yellow, fg: "#1A1A1A", body: <>
      <div style={{ fontSize: 64 }}>🎓</div>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Sonder-Ausgabe</div>
      <div style={{ ...big, fontSize: 40 }}>Dein {when}<br />bei Schmausi</div>
      <div style={{ fontSize: 17 }}>Ein ganzes Semester Mensa – Zeit für den großen Rückblick …</div>
    </> } : { bg: C.tomato, fg: "#fff", body: <>
      <div style={{ fontSize: 64 }}>🍽️</div>
      <div style={{ ...big, fontSize: 40 }}>Dein {when}<br />bei Schmausi</div>
      <div style={{ fontSize: 17, opacity: 0.9 }}>Schauen wir mal, was du so gegessen hast …</div>
    </> },
    { bg: C.cobalt, fg: "#fff", body: <>
      <div style={{ fontSize: 17, opacity: 0.9 }}>Du hast</div>
      <div style={{ ...big, fontSize: 96 }}>{w.n}</div>
      <div style={{ ...big, fontSize: 30 }}>{w.n === 1 ? "Gericht" : "Gerichte"} bewertet</div>
      <div style={{ fontSize: 17, opacity: 0.9 }}>an {w.days} {w.days === 1 ? "Tag" : "Tagen"} · in {w.canteens} {w.canteens === 1 ? "Mensa" : "Mensen"} · {w.comments} {w.comments === 1 ? "Kommentar" : "Kommentare"}</div>
    </> },
    period.special && w.canteenRank.length >= 2 && { bg: C.mint, fg: "#1A1A1A", body: <>
      <div style={{ fontSize: 17 }}>Deine Mensen</div>
      <div style={{ fontSize: 56 }}>🏫</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6, width: "100%", maxWidth: 330 }}>
        {w.canteenRank.map((c, k) => (
          <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left" }}>
            <div style={{ ...big, fontSize: 34, width: 40 }}>{["🥇", "🥈", "🥉"][k]}</div>
            <div style={{ flex: 1, ...big, fontSize: 20 }}>{canteenName(c.id)}</div>
            <div style={{ ...big, fontSize: 22 }}>{c.count}×</div>
          </div>
        ))}
      </div>
    </> },
    w.topCanteen && !(period.special && w.canteenRank.length >= 2) && { bg: C.mint, fg: "#1A1A1A", body: <>
      <div style={{ fontSize: 17 }}>Dein zweites Zuhause</div>
      <div style={{ fontSize: 64 }}>🏫</div>
      <div style={{ ...big, fontSize: 36 }}>{canteenName(w.topCanteen)}</div>
      <div style={{ fontSize: 17 }}>{w.topCount} von {w.n} Bewertungen</div>
    </> },
    period.special && w.topMonth && { bg: C.pink, fg: "#1A1A1A", body: <>
      <div style={{ fontSize: 17 }}>Dein Mensa-Monat</div>
      <div style={{ fontSize: 64 }}>📅</div>
      <div style={{ ...big, fontSize: 48 }}>{w.topMonth.name}</div>
      <div style={{ fontSize: 17 }}>{w.topMonth.count} Bewertungen – da warst du richtig im Flow</div>
    </> },
    period.special && w.top5.length >= 3 && { bg: C.yellow, fg: "#1A1A1A", body: <>
      <div style={{ fontSize: 17 }}>Deine Top {w.top5.length} des Semesters</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10, width: "100%", maxWidth: 340 }}>
        {w.top5.map((r, k) => (
          <div key={k} style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left" }}>
            <div style={{ ...big, fontSize: k < 3 ? 36 : 26, width: 42, textAlign: "center" }}>{["🥇", "🥈", "🥉", "4", "5"][k]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...big, fontSize: k < 3 ? 19 : 17 }}>{r.meal_name}</div>
              <div style={{ fontSize: 13 }}>★ {formatAvg(r.stars)} · {canteenName(r.canteen_id)}</div>
            </div>
          </div>
        ))}
      </div>
    </> },
    period.special && w.regular && { bg: C.tomato, fg: "#fff", body: <>
      <div style={{ fontSize: 17, opacity: 0.9 }}>Dein Dauerbrenner</div>
      <div style={{ fontSize: 64 }}>🔁</div>
      <div style={{ ...big, fontSize: 32 }}>„{w.regular.name}“</div>
      <div style={{ fontSize: 17, opacity: 0.95 }}>{w.regular.count}× bewertet · im Schnitt ★ {formatAvg(Math.round(w.regular.avg * 4) / 4)}</div>
    </> },
    period.special && w.streak >= 2 && { bg: "#1A1A1A", fg: "#fff", body: <>
      <div style={{ fontSize: 17, opacity: 0.9 }}>Deine längste Serie</div>
      <div style={{ fontSize: 64 }}>🔥</div>
      <div style={{ ...big, fontSize: 88 }}>{w.streak}</div>
      <div style={{ ...big, fontSize: 26 }}>Mensatage am Stück</div>
    </> },
    period.special && w.worst && w.best && w.worst.stars < w.best.stars && { bg: C.cobalt, fg: "#fff", body: <>
      <div style={{ fontSize: 17, opacity: 0.9 }}>Und das hier …</div>
      <div style={{ fontSize: 64 }}>🙈</div>
      <div style={{ ...big, fontSize: 30 }}>„{w.worst.meal_name}“</div>
      <div style={{ fontSize: 17, opacity: 0.95 }}>★ {formatAvg(w.worst.stars)} · lieber nicht nochmal</div>
    </> },
    w.best && !(period.special && w.top5.length >= 3) && { bg: C.yellow, fg: "#1A1A1A", body: <>
      <div style={{ fontSize: 17 }}>Dein Highlight</div>
      <div style={{ ...big, fontSize: 30 }}>„{w.best.meal_name}“</div>
      <div style={{ ...big, fontSize: 44 }}>★ {formatAvg(w.best.stars)}</div>
      <div style={{ fontSize: 15 }}>{canteenName(w.best.canteen_id)} · {formatDate(w.best.meal_date)}</div>
      {w.worst && w.worst.stars < w.best.stars && (
        <div style={{ marginTop: 18, padding: "10px 14px", borderRadius: 14, background: "rgba(0,0,0,.08)", fontSize: 15 }}>
          Lieber nicht nochmal: „{w.worst.meal_name}“ · ★ {formatAvg(w.worst.stars)}
        </div>
      )}
    </> },
    { bg: C.pink, fg: "#1A1A1A", body: <>
      <div style={{ fontSize: 17 }}>Im Schnitt gibst du</div>
      <div style={{ ...big, fontSize: 88 }}>{formatAvg(Math.round(w.avg * 4) / 4)}</div>
      <div style={{ ...big, fontSize: 30 }}>Sterne</div>
      {w.stricter !== null && (
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {w.stricter >= 50 ? `Strenger als ${w.stricter} % aller Schmausis 🧐` : `Großzügiger als ${100 - w.stricter} % aller Schmausis 💛`}
        </div>
      )}
    </> },
    { bg: "#1A1A1A", fg: "#fff", body: <>
      <div style={{ fontSize: 64 }}>🥦</div>
      <div style={{ ...big, fontSize: 64 }}>{w.meatless} %</div>
      <div style={{ ...big, fontSize: 26 }}>deiner Gerichte waren ohne Fleisch</div>
      {w.favDay && <div style={{ fontSize: 17, opacity: 0.85, marginTop: 10 }}>Dein Mensa-Tag: <strong>{w.favDay}</strong></div>}
    </> },
    w.buddy && { bg: C.cobalt, fg: "#fff", body: <>
      <div style={{ fontSize: 17, opacity: 0.9 }}>Dein Mensa-Buddy</div>
      <div style={{ fontSize: 64 }}>🫶</div>
      <div style={{ ...big, fontSize: 48 }}>{w.buddy.name}</div>
      <div style={{ fontSize: 17, opacity: 0.9 }}>{w.buddy.times}× am selben Tag in derselben Mensa</div>
    </> },
    { bg: C.tomato, fg: "#fff", body: <>
      <div style={{ fontSize: 17, opacity: 0.9 }}>Dein Mensa-Typ</div>
      <div style={{ fontSize: 80 }}>{w.type.emoji}</div>
      <div style={{ ...big, fontSize: 38 }}>{w.type.name}</div>
      <div style={{ fontSize: 17, opacity: 0.95, maxWidth: 320 }}>{w.type.text}</div>
    </> },
    { bg: C.bg, fg: C.text, summary: true, body: <SummaryCard w={w} when={when} canteenName={canteenName} /> },
  ].filter(Boolean);

  const idx = Math.min(i, slides.length - 1);
  const s = slides[idx];
  const lastShown = all !== null && idx === slides.length - 1;
  useEffect(() => { if (lastShown) markSeen(period.key); }, [period, lastShown]);
  const tap = (e) => {
    if (e.target.closest("button")) return;
    const x = e.clientX / window.innerWidth;
    if (x < 0.3) setI(Math.max(0, idx - 1)); else if (idx < slides.length - 1) setI(idx + 1);
  };

  return (
    <div role="dialog" aria-label="Schmausi Wrapped" onClick={tap}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: s.bg, color: s.fg, display: "flex", flexDirection: "column", transition: "background .35s", userSelect: "none", touchAction: "manipulation" }}>
      {/* Fortschritt oben wie bei Stories */}
      <div style={{ display: "flex", gap: 4, padding: "max(12px, env(safe-area-inset-top)) 12px 0" }}>
        {slides.map((_, k) => (
          <div key={k} style={{ flex: 1, height: 4, borderRadius: 2, background: k <= idx ? s.fg : "currentColor", opacity: k <= idx ? 0.95 : 0.25 }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px 0" }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", opacity: 0.8 }}>SCHMAUSI WRAPPED</span>
        <button type="button" onClick={onClose} aria-label="Schließen" style={{ background: "none", border: "none", color: "inherit", fontSize: 30, lineHeight: 1, cursor: "pointer" }}>×</button>
      </div>
      <div key={idx} className="wrap-in" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 12, padding: "0 28px 40px" }}>
        {s.body}
      </div>
      {!s.summary && <div style={{ textAlign: "center", fontSize: 12, opacity: 0.6, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>Tippen für weiter</div>}
    </div>
  );
}

// ---- Letzte Seite: Zusammenfassung + Teilen ---------------------------------
function SummaryCard({ w, when, canteenName }) {
  const [busy, setBusy] = useState(false);
  const facts = [
    ["Gerichte", w.n], ["Mensen", w.canteens], ["Ø Sterne", formatAvg(Math.round(w.avg * 4) / 4)], ["ohne Fleisch", `${w.meatless} %`],
  ];
  async function share() {
    setBusy(true);
    try {
      const blob = await drawShareImage(w, when, canteenName);
      const file = new File([blob], "schmausi-wrapped.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Mein Schmausi Wrapped" });
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); }
    } catch { /* abgebrochen */ }
    setBusy(false);
  }
  return (
    <>
      <div style={{ width: "100%", maxWidth: 340, borderRadius: 22, padding: 20, border: `2.5px solid ${C.ink}`, boxShadow: `5px 5px 0 ${C.ink}`, background: `linear-gradient(160deg, ${C.tomato}, ${C.pink} 60%, ${C.yellow})`, color: "#1A1A1A", textAlign: "left" }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>SCHMAUSI WRAPPED · {when.toUpperCase()}</div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 800, margin: "6px 0 10px" }}>{w.type.emoji} {w.type.name}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {facts.map(([k, v]) => (
            <div key={k} style={{ background: "rgba(255,255,255,.55)", borderRadius: 12, padding: "8px 10px" }}>
              <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 800 }}>{v}</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{k}</div>
            </div>
          ))}
        </div>
        {w.best && <div style={{ marginTop: 10, fontSize: 14 }}>⭐ <strong>{w.best.meal_name}</strong></div>}
        {w.topCanteen && <div style={{ fontSize: 14 }}>🏫 {canteenName(w.topCanteen)}</div>}
        {w.buddy && <div style={{ fontSize: 14 }}>🫶 mit {w.buddy.name}</div>}
      </div>
      <button type="button" onClick={share} disabled={busy}
        style={{ marginTop: 16, padding: "13px 22px", borderRadius: 14, border: `2.5px solid ${C.ink}`, background: C.ink, color: C.bg, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
        {busy ? "Einen Moment…" : "📤 Als Bild teilen"}
      </button>
    </>
  );
}

// Teilbild 1080 × 1920 (Story-Format) auf einem Canvas zeichnen
async function drawShareImage(w, when, canteenName) {
  const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
  const g = cv.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const col = (n, f) => css.getPropertyValue(`--${n}`).trim() || f;
  const grad = g.createLinearGradient(0, 0, 1080, 1920);
  grad.addColorStop(0, col("tomato", "#FF5A36")); grad.addColorStop(0.6, col("pink", "#FF8FB8")); grad.addColorStop(1, col("yellow", "#FFC93C"));
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1920);
  const font = (size, weight = 800) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const fit = (text, size, maxW, weight) => { let s = size; do { g.font = font(s, weight); s -= 4; } while (g.measureText(text).width > maxW && s > 20); };
  g.fillStyle = "#1A1A1A"; g.textAlign = "left";
  g.font = font(44); g.fillText(`SCHMAUSI WRAPPED · ${when.toUpperCase()}`, 90, 200);
  g.font = font(170, 400); g.fillText(w.type.emoji, 90, 440);
  fit(w.type.name, 96, 900); g.fillText(w.type.name, 90, 580);
  const facts = [["Gerichte", w.n], ["Mensen", w.canteens], ["Ø Sterne", formatAvg(Math.round(w.avg * 4) / 4)], ["ohne Fleisch", `${w.meatless} %`]];
  facts.forEach(([k, v], idx) => {
    const x = 90 + (idx % 2) * 460, y = 680 + Math.floor(idx / 2) * 300;
    g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.roundRect(x, y, 440, 260, 36); g.fill();
    g.fillStyle = "#1A1A1A"; g.font = font(120); g.fillText(String(v), x + 40, y + 150); g.font = font(44, 700); g.fillText(k, x + 40, y + 220);
  });
  let y = 1380;
  const line = (t) => { fit(t, 52, 900, 700); g.fillText(t, 90, y); y += 90; };
  if (w.best) line(`⭐ ${w.best.meal_name}`);
  if (w.topCanteen) line(`🏫 ${canteenName(w.topCanteen)}`);
  if (w.buddy) line(`🫶 mit ${w.buddy.name}`);
  g.font = font(48); g.fillText("schmausi 🍽️", 90, 1820);
  return await new Promise((res) => cv.toBlob(res, "image/png"));
}
