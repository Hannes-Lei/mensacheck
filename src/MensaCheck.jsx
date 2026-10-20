import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase.js";
import { dishKey, friendlyError, BADGES, computeStats } from "./helpers.js";
import { styles, globalCss, C } from "./ui.jsx";
import AuthSheet from "./AuthSheet.jsx";
import TodayTab from "./TodayTab.jsx";
import RankingTab from "./RankingTab.jsx";
import ProfileTab from "./ProfileTab.jsx";
import FriendsTab from "./FriendsTab.jsx";
import Celebration from "./Celebration.jsx";

// ============================================================================
// MensaCheck Leipzig – Version 6: Freundesgruppen, Reaktionen, halbe Sterne
// ----------------------------------------------------------------------------
// Diese Datei ist der "Rahmen" der App: Kopfzeile, Navigation unten,
// Anmeldung und alles, was mehrere Ansichten gemeinsam brauchen.
// Die eigentlichen Ansichten stehen in TodayTab, FriendsTab, RankingTab
// und ProfileTab.
// ============================================================================

const STORAGE_KEY = "mensacheck-mensa";
const THEME_KEY = "mensacheck-design";

function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

function loadSavedCanteen() {
  try { return Number(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}
function saveCanteen(id) {
  try { localStorage.setItem(STORAGE_KEY, String(id)); } catch { /* egal */ }
}

const TABS = [
  { id: "today", label: "Heute", icon: "🍽️" },
  { id: "friends", label: "Freunde", icon: "👥" },
  { id: "ranking", label: "Rangliste", icon: "🏆" },
  { id: "me", label: "Ich", icon: "👤" },
];

export default function MensaCheck() {
  const [tab, setTab] = useState("today");
  const [canteens, setCanteens] = useState([]);
  const [canteenId, setCanteenId] = useState(loadSavedCanteen() || 63);

  const [session, setSession] = useState(null);
  const [username, setUsername] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [favoritesList, setFavoritesList] = useState([]);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(loadTheme); // light | dark
  const [celebrate, setCelebrate] = useState([]); // neu freigeschaltete Abzeichen

  // Freundesgruppen
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]); // { group_id, user_id, username }
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [invite, setInvite] = useState(null); // Einladung per Link: { code, name, members }
  const [pendingCode, setPendingCode] = useState(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("gruppe");
      return code ? code.trim().toUpperCase() : null;
    } catch { return null; }
  });

  const userId = session?.user?.id || null;

  // Design anwenden und merken
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* egal */ }
  }, [theme]);

  // Einladungslink (?gruppe=CODE): Adresse aufräumen und zu "Freunde" wechseln
  useEffect(() => {
    if (!pendingCode) return;
    setTab("friends");
    try { window.history.replaceState(null, "", window.location.pathname); } catch { /* egal */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Anmeldestatus beobachten
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Nutzername und Lieblingsgerichte laden
  useEffect(() => {
    if (!userId) {
      setUsername(null);
      setFavoritesList([]);
      return;
    }
    supabase.from("profiles").select("username").eq("id", userId).single()
      .then(({ data }) => setUsername(data?.username || null));
    supabase.from("favorites").select("canteen_id, meal_name, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false })
      .then(({ data }) => setFavoritesList(data || []));
  }, [userId]);

  // ---- Freundesgruppen laden ---------------------------------------------
  const reloadGroups = useCallback(async () => {
    if (!userId) { setGroups([]); setMembers([]); setGroupsLoaded(false); return; }
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from("groups").select("id, name, code, created_by, created_at").order("created_at"),
      supabase.from("group_members").select("group_id, user_id, joined_at, profiles(username)").order("joined_at"),
    ]);
    setGroups(g || []);
    setMembers((m || []).map((r) => ({ group_id: r.group_id, user_id: r.user_id, username: r.profiles?.username || "Jemand" })));
    setGroupsLoaded(true);
  }, [userId]);

  useEffect(() => { reloadGroups(); }, [reloadGroups]);
  useEffect(() => { if (tab === "friends") reloadGroups(); }, [tab, reloadGroups]);

  // Alle Leute aus meinen Gruppen (ohne mich): user_id -> Name
  const friends = useMemo(() => {
    const map = new Map();
    for (const m of members) if (m.user_id !== userId) map.set(m.user_id, m.username);
    return map;
  }, [members, userId]);

  // Einladung bearbeiten, sobald man angemeldet ist
  useEffect(() => {
    if (!pendingCode) return;
    if (!userId) { setShowAuth(true); return; }
    if (!groupsLoaded) return;
    let cancelled = false;
    (async () => {
      if (groups.some((g) => g.code === pendingCode)) {
        setPendingCode(null);
        showToast("Du bist schon in dieser Gruppe. 👍");
        return;
      }
      const { data } = await supabase.rpc("preview_group", { p_code: pendingCode });
      if (cancelled) return;
      const g = Array.isArray(data) ? data[0] : data;
      if (!g) {
        setPendingCode(null);
        showToast("Diesen Einladungslink gibt es nicht mehr.");
        return;
      }
      setInvite({ code: pendingCode, name: g.name, members: Number(g.members) });
    })();
    return () => { cancelled = true; };
  }, [pendingCode, userId, groups, groupsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  async function acceptInvite() {
    const code = invite.code;
    setInvite(null);
    setPendingCode(null);
    const { data, error } = await supabase.rpc("join_group", { p_code: code });
    if (error) return showToast(friendlyError(error));
    await reloadGroups();
    setTab("friends");
    showToast(`🎉 Willkommen in „${data?.name || "der Gruppe"}"!`);
  }

  // ---- Abzeichen: neue erkennen und feiern -------------------------------
  // Welche Abzeichen schon gefeiert wurden, merkt sich das Gerät.
  const checkBadges = useCallback(async (silent = false) => {
    if (!userId) return;
    const { data } = await supabase.from("ratings")
      .select("canteen_id, meal_date, comment").eq("user_id", userId).limit(5000);
    const stats = computeStats(data || []);
    const earned = BADGES.filter((b) => stats[b.metric] >= b.goal).map((b) => b.id);

    const key = `mensacheck-abzeichen-${userId}`;
    let known = null;
    try { known = JSON.parse(localStorage.getItem(key)); } catch { /* egal */ }
    try { localStorage.setItem(key, JSON.stringify(earned)); } catch { /* egal */ }

    if (silent || !Array.isArray(known)) return; // beim Start nur merken, nicht feiern
    const fresh = BADGES.filter((b) => earned.includes(b.id) && !known.includes(b.id));
    if (fresh.length) setCelebrate((q) => [...q, ...fresh]);
  }, [userId]);

  // Beim Anmelden den aktuellen Stand merken. Ganz neue Konten haben noch
  // keine Abzeichen – so wird schon das erste ("Erster Bissen") gefeiert.
  useEffect(() => {
    if (!userId) return;
    let stored = null;
    try { stored = localStorage.getItem(`mensacheck-abzeichen-${userId}`); } catch { /* egal */ }
    if (stored === null) checkBadges(true);
  }, [userId, checkBadges]);

  const finishCelebration = useCallback(() => setCelebrate((q) => q.slice(1)), []);

  // Liste der Mensen
  useEffect(() => {
    fetch("/api/mensa")
      .then((r) => r.json())
      .then((data) => setCanteens(data.canteens || []))
      .catch(() => {});
  }, []);

  const favorites = useMemo(
    () => new Set(favoritesList.map((f) => dishKey(f.canteen_id, f.meal_name))),
    [favoritesList]
  );

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  }

  function changeCanteen(id) {
    setCanteenId(id);
    saveCanteen(id);
  }

  async function toggleFavorite(cId, mealName) {
    if (!userId) return setShowAuth(true);
    const key = dishKey(cId, mealName);
    if (favorites.has(key)) {
      // gespeicherte Schreibweise(n) verwenden – kann sich leicht unterscheiden
      const names = favoritesList
        .filter((f) => dishKey(f.canteen_id, f.meal_name) === key)
        .map((f) => f.meal_name);
      setFavoritesList((l) => l.filter((f) => dishKey(f.canteen_id, f.meal_name) !== key));
      const { error } = await supabase.from("favorites").delete()
        .eq("user_id", userId).eq("canteen_id", cId).in("meal_name", names.length ? names : [mealName]);
      if (error) showToast(friendlyError(error));
    } else {
      setFavoritesList((l) => [{ canteen_id: cId, meal_name: mealName }, ...l]);
      const { error } = await supabase.from("favorites")
        .insert({ user_id: userId, canteen_id: cId, meal_name: mealName });
      if (error) showToast(friendlyError(error));
      else showToast("❤️ Gemerkt! Du siehst es, wenn es wieder auf dem Plan steht.");
    }
  }

  const canteenName = canteens.find((c) => c.id === canteenId)?.name || "Mensa";
  const subtitle = {
    today: `Was schmeckt heute in der ${canteenName}?`,
    ranking: "Was Leipzig am liebsten isst.",
    me: "Deine Bewertungen, Favoriten und Abzeichen.",
    friends: "Was deine Leute gegessen haben.",
  }[tab];

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      <header style={styles.header}>
        <div style={styles.topRow}>
          <div style={styles.brandRow}>
            <span style={styles.logo}>◆</span>
            <h1 style={styles.title}>MensaCheck</h1>
            <span style={styles.city}>Leipzig</span>
          </div>
          {userId ? (
            <button type="button" style={styles.userBtn} onClick={() => setTab("me")}>👤 {username || "…"}</button>
          ) : (
            <button type="button" style={styles.loginBtn} onClick={() => setShowAuth(true)}>Anmelden</button>
          )}
        </div>
        <p style={styles.subtitle}>{subtitle}</p>
      </header>

      {/* Alle Ansichten bleiben geladen, damit Auswahl und Filter erhalten bleiben */}
      <div style={{ display: tab === "today" ? "block" : "none" }}>
        <TodayTab
          canteens={canteens}
          canteenId={canteenId}
          onCanteenChange={changeCanteen}
          userId={userId}
          username={username}
          friends={friends}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          needLogin={() => setShowAuth(true)}
          showToast={showToast}
          onActivity={() => checkBadges(false)}
        />
      </div>
      <div style={{ display: tab === "friends" ? "block" : "none" }}>
        <FriendsTab
          userId={userId}
          username={username}
          groups={groups}
          members={members}
          reloadGroups={reloadGroups}
          canteens={canteens}
          needLogin={() => setShowAuth(true)}
          showToast={showToast}
          active={tab === "friends"}
        />
      </div>
      <div style={{ display: tab === "ranking" ? "block" : "none" }}>
        <RankingTab canteens={canteens} canteenId={canteenId} active={tab === "ranking"} />
      </div>
      <div style={{ display: tab === "me" ? "block" : "none" }}>
        <ProfileTab
          userId={userId}
          username={username}
          canteens={canteens}
          favoritesList={favoritesList}
          onToggleFavorite={toggleFavorite}
          needLogin={() => setShowAuth(true)}
          onSignOut={() => { supabase.auth.signOut(); setTab("today"); }}
          theme={theme}
          onThemeChange={setTheme}
          active={tab === "me"}
        />
      </div>

      <footer style={styles.footer}>
        Speiseplan: OpenMensa / Studentenwerk Leipzig · Preise für Studierende, ohne Gewähr.<br />
        Testversion von MensaCheck.
      </footer>

      <nav style={styles.nav} aria-label="Hauptnavigation">
        <div style={styles.navInner}>
          {TABS.map((t) => (
            <button
              key={t.id} type="button"
              style={{ ...styles.navBtn, ...(tab === t.id ? styles.navBtnOn : {}) }}
              onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <span style={{ ...styles.navIcon, filter: tab === t.id ? "none" : "grayscale(1)" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {toast && <div style={styles.toast} role="status">{toast}</div>}
      {showAuth && (
        <AuthSheet
          onClose={() => setShowAuth(false)}
          note={pendingCode && !userId ? "Du wurdest in eine Gruppe eingeladen. Melde dich an oder registriere dich, um beizutreten." : null}
        />
      )}
      {invite && (
        <div style={styles.overlay} onClick={() => { setInvite(null); setPendingCode(null); }}>
          <div style={{ ...styles.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Gruppeneinladung">
            <div style={{ fontSize: 40 }}>👥</div>
            <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 14 }}>Du wurdest eingeladen in</p>
            <h2 style={{ margin: "4px 0 2px", fontSize: 22 }}>{invite.name}</h2>
            <p style={{ margin: "0 0 18px", color: C.muted, fontSize: 14 }}>
              {invite.members} {invite.members === 1 ? "Mitglied" : "Mitglieder"}
            </p>
            <button type="button" style={styles.primaryBtn} onClick={acceptInvite}>Beitreten</button>
            <button type="button" style={styles.linkBtn} onClick={() => { setInvite(null); setPendingCode(null); }}>
              Nein, danke
            </button>
          </div>
        </div>
      )}
      {celebrate.length > 0 && <Celebration key={celebrate[0].id} badge={celebrate[0]} onDone={finishCelebration} />}
    </div>
  );
}
