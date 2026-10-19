import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { timeAgo, friendlyError } from "./helpers.js";
import { StarLine, formatStars, Avatar, styles, C } from "./ui.jsx";

// ============================================================================
// Reaktionen (Emojis) und Antworten unter einer Bewertung/einem Kommentar
// ----------------------------------------------------------------------------
// Wird bei "Heute" unter den Kommentaren und im Freunde-Feed benutzt.
// Pro Person gibt es ein Emoji pro Bewertung – wie bei WhatsApp.
// ============================================================================

export const EMOJIS = ["👍", "❤️", "😂", "😋", "🤢", "😮"];

// Diese Felder holen wir mit jeder Bewertung zusammen aus der Datenbank
export const THREAD_SELECT =
  "id, user_id, canteen_id, meal_date, meal_name, stars, comment, created_at, " +
  "profiles(username), " +
  "reactions(emoji, user_id, profiles(username)), " +
  "replies(id, body, created_at, user_id, profiles(username))";

const REPLIES_SHOWN = 3;

export function Interactions({ rating, userId, username, needLogin, showToast }) {
  const [reactions, setReactions] = useState(rating.reactions || []);
  const [replies, setReplies] = useState(rating.replies || []);
  const [picker, setPicker] = useState(false);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Neue Daten von außen übernehmen (z.B. nach dem Neuladen)
  useEffect(() => { setReactions(rating.reactions || []); }, [rating.reactions]);
  useEffect(() => { setReplies(rating.replies || []); }, [rating.replies]);

  const sortedReplies = useMemo(
    () => [...replies].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [replies]
  );

  // Gleiche Emojis zusammenfassen: "😂 2", "❤️ 1"
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of reactions) {
      const g = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false, names: [] };
      g.count++;
      if (r.user_id === userId) g.mine = true;
      g.names.push(r.user_id === userId ? "Du" : r.profiles?.username || "Jemand");
      map.set(r.emoji, g);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [reactions, userId]);

  async function react(emoji) {
    if (!userId) return needLogin();
    setPicker(false);
    const before = reactions;
    const mine = reactions.find((r) => r.user_id === userId);

    if (mine?.emoji === emoji) {
      // gleiches Emoji nochmal = Reaktion zurücknehmen
      setReactions((rs) => rs.filter((r) => r.user_id !== userId));
      const { error } = await supabase.from("reactions").delete()
        .eq("rating_id", rating.id).eq("user_id", userId);
      if (error) { setReactions(before); showToast(friendlyError(error)); }
      return;
    }

    setReactions((rs) => [
      ...rs.filter((r) => r.user_id !== userId),
      { emoji, user_id: userId, profiles: { username } },
    ]);
    const { error } = await supabase.from("reactions")
      .upsert({ rating_id: rating.id, user_id: userId, emoji }, { onConflict: "rating_id,user_id" });
    if (error) { setReactions(before); showToast(friendlyError(error)); }
  }

  async function sendReply() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.from("replies")
      .insert({ rating_id: rating.id, user_id: userId, body })
      .select("id, body, created_at, user_id, profiles(username)")
      .single();
    setSending(false);
    if (error) return showToast(friendlyError(error));
    setReplies((rs) => [...rs, data]);
    setDraft("");
    setReplying(false);
    setShowAll(true);
  }

  async function removeReply(reply) {
    if (!window.confirm("Deine Antwort löschen?")) return;
    const before = replies;
    setReplies((rs) => rs.filter((r) => r.id !== reply.id));
    const { error } = await supabase.from("replies").delete().eq("id", reply.id).eq("user_id", userId);
    if (error) { setReplies(before); showToast(friendlyError(error)); }
  }

  const hidden = showAll ? 0 : Math.max(0, sortedReplies.length - REPLIES_SHOWN);
  const visibleReplies = sortedReplies.slice(hidden);

  return (
    <div>
      {/* Emojis + Knöpfe */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
        {groups.map((g) => (
          <button
            key={g.emoji} type="button" onClick={() => react(g.emoji)}
            title={g.names.join(", ")}
            aria-label={`${g.emoji} ${g.count}: ${g.names.join(", ")}`}
            style={{ ...ist.reactionChip, ...(g.mine ? ist.reactionChipMine : {}) }}
          >
            <span style={{ fontSize: 15 }}>{g.emoji}</span>
            {g.count > 1 && <span style={{ fontSize: 12, fontWeight: 700 }}>{g.count}</span>}
          </button>
        ))}
        <button
          type="button" aria-label="Mit Emoji reagieren" aria-expanded={picker}
          onClick={() => (userId ? setPicker((p) => !p) : needLogin())}
          style={ist.addReaction}
        >
          ☺︎<span style={{ fontSize: 11, marginLeft: 1 }}>+</span>
        </button>
        <button
          type="button" style={{ ...styles.smallAction, fontSize: 13 }}
          onClick={() => (userId ? setReplying((r) => !r) : needLogin())}
        >
          ↩ Antworten
        </button>
      </div>

      {picker && (
        <div style={ist.picker} role="group" aria-label="Emoji auswählen">
          {EMOJIS.map((e) => {
            const isMine = reactions.some((r) => r.user_id === userId && r.emoji === e);
            return (
              <button
                key={e} type="button" onClick={() => react(e)} aria-label={`Mit ${e} reagieren`}
                style={{ ...ist.pickerBtn, ...(isMine ? { background: C.hintBg } : {}) }}
              >
                {e}
              </button>
            );
          })}
        </div>
      )}

      {/* Antworten */}
      {sortedReplies.length > 0 && (
        <div style={ist.replies}>
          {hidden > 0 && (
            <button type="button" style={{ ...styles.smallAction, fontSize: 12 }} onClick={() => setShowAll(true)}>
              Alle {sortedReplies.length} Antworten anzeigen
            </button>
          )}
          {visibleReplies.map((r) => (
            <div key={r.id} style={{ fontSize: 14, lineHeight: 1.4 }}>
              <strong>{r.user_id === userId ? "Du" : r.profiles?.username || "Jemand"}</strong>{" "}
              <span>{r.body}</span>{" "}
              <span style={{ color: C.faint, fontSize: 12, whiteSpace: "nowrap" }}>· {timeAgo(r.created_at)}</span>
              {r.user_id === userId && (
                <button type="button" onClick={() => removeReply(r)} style={ist.tinyLink} aria-label="Antwort löschen">
                  Löschen
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {replying && (
        <form
          onSubmit={(e) => { e.preventDefault(); sendReply(); }}
          style={{ display: "flex", gap: 6, marginTop: 8 }}
        >
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} autoFocus
            placeholder="Antwort schreiben …" aria-label="Antwort"
            style={{ ...styles.input, padding: "8px 10px", fontSize: 15 }}
          />
          <button type="submit" disabled={sending || !draft.trim()} style={{ ...styles.smallPrimary, opacity: draft.trim() ? 1 : 0.5 }}>
            {sending ? "…" : "Senden"}
          </button>
        </form>
      )}
    </div>
  );
}

// Ein Kommentar als Sprechblase mit Reaktionen und Antworten (Ansicht "Heute")
export function CommentItem({ item, userId, username, friends, needLogin, showToast }) {
  const isMe = item.user_id === userId;
  const isFriend = !isMe && friends?.has(item.user_id);
  const name = isMe ? "Du" : item.profiles?.username || "Jemand";
  return (
    <li style={{ listStyle: "none" }}>
      <div style={styles.comment}>
        <div style={{ ...styles.commentHead, alignItems: "center" }}>
          <Avatar name={item.profiles?.username || "?"} size={22} />
          <strong>{isFriend ? `👥 ${name}` : name}</strong>
          <StarLine value={item.stars} size={13} />
          <span style={{ color: C.faint, fontSize: 12 }}>{formatStars(item.stars)} · {timeAgo(item.created_at)}</span>
        </div>
        <p style={{ margin: "4px 0 0", lineHeight: 1.4 }}>{item.comment}</p>
      </div>
      <Interactions rating={item} userId={userId} username={username} needLogin={needLogin} showToast={showToast} />
    </li>
  );
}

const ist = {
  reactionChip: {
    display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", minHeight: 28,
    borderRadius: 14, border: `1px solid ${C.line}`, background: C.card, color: C.text, cursor: "pointer",
  },
  reactionChipMine: { border: `1px solid ${C.green}`, background: C.hintBg },
  addReaction: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 34, height: 28,
    borderRadius: 14, border: `1px dashed ${C.border}`, background: "none", color: C.muted,
    fontSize: 16, cursor: "pointer", padding: "0 6px",
  },
  picker: {
    display: "inline-flex", gap: 2, marginTop: 6, padding: 4, borderRadius: 22,
    background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 4px 16px rgba(0,0,0,.12)",
  },
  pickerBtn: {
    fontSize: 24, lineHeight: 1, padding: 6, borderRadius: 18, border: "none",
    background: "none", cursor: "pointer",
  },
  replies: {
    marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${C.line}`,
    display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start",
  },
  tinyLink: {
    marginLeft: 6, padding: 0, background: "none", border: "none", color: C.faint,
    fontSize: 12, cursor: "pointer", textDecoration: "underline",
  },
};
