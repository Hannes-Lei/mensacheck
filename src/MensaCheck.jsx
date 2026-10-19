import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { dishKey, friendlyError } from "./helpers.js";
import { styles, globalCss } from "./ui.jsx";
import AuthSheet from "./AuthSheet.jsx";
import TodayTab from "./TodayTab.jsx";
import RankingTab from "./RankingTab.jsx";
import ProfileTab from "./ProfileTab.jsx";

// ============================================================================
// MensaCheck Leipzig – Version 5: Ranglisten, Favoriten, Abzeichen, Dunkelmodus
// ----------------------------------------------------------------------------
// Diese Datei ist der "Rahmen" der App: Kopfzeile, Navigation unten,
// Anmeldung und alles, was mehrere Ansichten gemeinsam brauchen.
// Die eigentlichen Ansichten stehen in TodayTab, RankingTab und ProfileTab.
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

  const userId = session?.user?.id || null;

  // Design anwenden und merken
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* egal */ }
  }, [theme]);

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
      setFavoritesList((l) => l.filter((f) => dishKey(f.canteen_id, f.meal_name) !== key));
      const { error } = await supabase.from("favorites").delete()
        .eq("user_id", userId).eq("canteen_id", cId).eq("meal_name", mealName);
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
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          needLogin={() => setShowAuth(true)}
          showToast={showToast}
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
      {showAuth && <AuthSheet onClose={() => setShowAuth(false)} />}
    </div>
  );
}
