import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase.js";
import { daysAgo, todayBerlin, formatDate, timeAgo, friendlyError } from "./helpers.js";
import { Chip, StarLine, Avatar, formatStars, styles, C } from "./ui.jsx";
import { Interactions, THREAD_SELECT } from "./Interactions.jsx";

// ============================================================================
// Ansicht "Freunde": Gruppen und was eure Leute gegessen haben
// ============================================================================

const FEED_DAYS = 14;

// Gruppe erstellen oder per Code beitreten
function GroupForms({ onCreated, onJoined, showToast }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group", { p_name: name.trim() });
    setBusy(false);
    if (error) return showToast(friendlyError(error));
    setName("");
    onCreated(data);
  }

  async function join(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("join_group", { p_code: code.trim() });
    setBusy(false);
    if (error) return showToast(friendlyError(error));
    setCode("");
    onJoined(data);
  }

  return (
    <div style={{ ...styles.card, display: "flex", flexDirection: "column", gap: 14 }}>
      <form onSubmit={create}>
        <span style={styles.fieldLabel}>Neue Gruppe</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={styles.input} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Mensa-Crew" maxLength={40} aria-label="Name der Gruppe"
          />
          <button type="submit" disabled={busy || !name.trim()} style={{ ...styles.smallPrimary, whiteSpace: "nowrap" }}>
            Erstellen
          </button>
        </div>
      </form>
      <div style={{ textAlign: "center", color: C.faint, fontSize: 13 }}>oder</div>
      <form onSubmit={join}>
        <span style={styles.fieldLabel}>Mit Code beitreten</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...styles.input, textTransform: "uppercase", letterSpacing: ".1em" }}
            value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123" maxLength={6} aria-label="Gruppencode" autoCapitalize="characters"
          />
          <button type="submit" disabled={busy || !code.trim()} style={{ ...styles.smallPrimary, whiteSpace: "nowrap" }}>
            Beitreten
          </button>
        </div>
      </form>
    </div>
  );
}

// Infos zu einer Gruppe: Mitglieder, Code, Einladen, Verlassen
function GroupInfo({ group, members, userId, onLeft, showToast }) {
  async function invite() {
    const url = `${window.location.origin}/?gruppe=${group.code}`;
    const text = `Komm in meine MensaCheck-Gruppe „${group.name}" 🍽️ Dann sehen wir, was wir in der Mensa gegessen haben.`;
    if (navigator.share) {
      try { await navigator.share({ title: "MensaCheck", text, url }); } catch { /* abgebrochen */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast("Einladung kopiert – jetzt z.B. in WhatsApp einfügen.");
    } catch {
      showToast(`Euer Gruppencode: ${group.code}`);
    }
  }

  async function leave() {
    if (!window.confirm(`Gruppe „${group.name}" wirklich verlassen?`)) return;
    const { error } = await supabase.from("group_members").delete()
      .eq("group_id", group.id).eq("user_id", userId);
    if (error) return showToast(friendlyError(error));
    showToast(`Du hast „${group.name}" verlassen.`);
    onLeft();
  }

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 16 }}>{group.name}</strong>
        <span style={{ fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>
          {members.length} {members.length === 1 ? "Mitglied" : "Mitglieder"}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {members.map((m) => (
          <span key={m.user_id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13 }}>
            <Avatar name={m.username} size={22} /> {m.user_id === userId ? "Du" : m.username}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" style={styles.smallPrimary} onClick={invite}>📨 Freunde einladen</button>
        <span style={{ fontSize: 13, color: C.muted }}>
          Code: <strong style={{ letterSpacing: ".1em", color: C.text }}>{group.code}</strong>
        </span>
        <button type="button" style={{ ...styles.smallAction, color: C.muted, marginLeft: "auto" }} onClick={leave}>
          Verlassen
        </button>
      </div>
    </div>
  );
}

// Ein Eintrag im Feed: wer hat was gegessen und wie war's
function FeedItem({ item, canteenName, ...thread }) {
  const isMe = item.user_id === thread.userId;
  const name = item.profiles?.username || "Jemand";
  return (
    <article style={styles.card}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Avatar name={name} size={34} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.35 }}>
          <strong>{isMe ? "Du" : name}</strong>
          <div style={{ color: C.muted, fontSize: 12 }}>{canteenName} · {timeAgo(item.created_at)}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{item.meal_name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <StarLine value={item.stars} size={17} />
        <strong style={{ fontSize: 14 }}>{formatStars(item.stars)}</strong>
      </div>
      {item.comment && (
        <p style={{ ...styles.comment, margin: "10px 0 0", lineHeight: 1.45 }}>„{item.comment}"</p>
      )}
      <Interactions rating={item} {...thread} />
    </article>
  );
}

export default function FriendsTab({
  userId, username, groups, members, reloadGroups, canteens, needLogin, showToast, active,
}) {
  const [selected, setSelected] = useState("all"); // "all" oder Gruppen-ID
  const [showForms, setShowForms] = useState(false);
  const [feed, setFeed] = useState(null);

  // Gibt es die gewählte Gruppe noch? (z.B. nach dem Verlassen)
  useEffect(() => {
    if (selected !== "all" && !groups.some((g) => g.id === selected)) setSelected("all");
  }, [groups, selected]);

  const membersOf = useCallback(
    (groupId) => members.filter((m) => m.group_id === groupId),
    [members]
  );

  // Wessen Bewertungen zeigen wir?
  const feedUserIds = useMemo(() => {
    const list = selected === "all" ? members : membersOf(selected);
    return [...new Set(list.map((m) => m.user_id))];
  }, [selected, members, membersOf]);

  const loadFeed = useCallback(async () => {
    if (!userId || feedUserIds.length === 0) { setFeed([]); return; }
    const { data } = await supabase
      .from("ratings")
      .select(THREAD_SELECT)
      .in("user_id", feedUserIds)
      .gte("meal_date", daysAgo(FEED_DAYS - 1))
      .order("created_at", { ascending: false })
      .limit(80);
    setFeed(data || []);
  }, [userId, feedUserIds]);

  useEffect(() => { if (active) loadFeed(); }, [active, loadFeed]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(loadFeed, 60000);
    return () => clearInterval(t);
  }, [active, loadFeed]);

  // Nach Tagen gruppieren: Heute, Gestern, Mo., 19.10. …
  const days = useMemo(() => {
    const out = [];
    for (const item of feed || []) {
      let day = out.find((d) => d.date === item.meal_date);
      if (!day) out.push((day = { date: item.meal_date, items: [] }));
      day.items.push(item);
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [feed]);

  const today = todayBerlin();
  const dayTitle = (d) => (d === today ? "Heute" : d === daysAgo(1) ? "Gestern" : formatDate(d));
  const canteenName = (id) => canteens.find((c) => c.id === id)?.name || "Mensa";

  async function afterJoinOrCreate(group, created) {
    await reloadGroups();
    setShowForms(false);
    if (group?.id) setSelected(group.id);
    showToast(created ? `Gruppe „${group.name}" erstellt – jetzt Freunde einladen!` : `🎉 Willkommen in „${group.name}"!`);
  }

  // ---- Nicht angemeldet --------------------------------------------------
  if (!userId) {
    return (
      <main style={styles.main}>
        <div style={styles.empty}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
          <p style={{ fontSize: 18, margin: "0 0 6px", color: C.text, fontWeight: 700 }}>Mit Freunden essen</p>
          <p style={{ margin: "0 0 16px" }}>
            Melde dich an, gründe eine Gruppe und seht, was ihr in der Mensa gegessen habt.
          </p>
          <button type="button" style={{ ...styles.primaryBtn, maxWidth: 260 }} onClick={needLogin}>
            Anmelden oder registrieren
          </button>
        </div>
      </main>
    );
  }

  // ---- Noch keine Gruppe ---------------------------------------------------
  if (groups.length === 0) {
    return (
      <main style={styles.main}>
        <div style={{ ...styles.empty, padding: "20px 8px 4px" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
          <p style={{ fontSize: 18, margin: "0 0 6px", color: C.text, fontWeight: 700 }}>Deine erste Gruppe</p>
          <p style={{ margin: 0 }}>
            Erstelle eine Gruppe und schick den Einladungslink in euren Chat. Dann seht ihr, was die anderen
            gegessen haben, wie es war, und könnt darauf reagieren.
          </p>
        </div>
        <GroupForms
          showToast={showToast}
          onCreated={(g) => afterJoinOrCreate(g, true)}
          onJoined={(g) => afterJoinOrCreate(g, false)}
        />
      </main>
    );
  }

  // ---- Mit Gruppe(n) ---------------------------------------------------------
  const group = groups.find((g) => g.id === selected);
  const thread = { userId, username, needLogin, showToast };

  return (
    <>
      <div style={styles.controls}>
        <div style={styles.chipRow}>
          {groups.length > 1 && <Chip active={selected === "all"} onClick={() => setSelected("all")}>Alle</Chip>}
          {groups.map((g) => (
            <Chip
              key={g.id}
              active={selected === g.id || (groups.length === 1 && selected === "all")}
              onClick={() => setSelected(g.id)}
            >
              {g.name}
            </Chip>
          ))}
          <Chip active={showForms} onClick={() => setShowForms((s) => !s)}>＋ Gruppe</Chip>
        </div>
      </div>

      <main style={styles.main}>
        {showForms && (
          <GroupForms
            showToast={showToast}
            onCreated={(g) => afterJoinOrCreate(g, true)}
            onJoined={(g) => afterJoinOrCreate(g, false)}
          />
        )}

        {(group || groups.length === 1) && (
          <GroupInfo
            group={group || groups[0]}
            members={membersOf((group || groups[0]).id)}
            userId={userId}
            showToast={showToast}
            onLeft={reloadGroups}
          />
        )}

        {feed === null && <div style={styles.notice}>Wird geladen…</div>}

        {feed?.length === 0 && (
          <div style={styles.empty}>
            Hier erscheint, was ihr gegessen habt.<br />
            Bewerte dein nächstes Mensa-Essen bei „Heute" – deine Gruppe sieht es dann sofort. 🍽️
          </div>
        )}

        {days.map((d) => (
          <section key={d.date} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ ...styles.h3, margin: "10px 0 0" }}>{dayTitle(d.date)}</h3>
            {d.items.map((item) => (
              <FeedItem key={item.id} item={item} canteenName={canteenName(item.canteen_id)} {...thread} />
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
