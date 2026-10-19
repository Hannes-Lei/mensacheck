import React, { useEffect, useRef } from "react";
import { styles, C } from "./ui.jsx";

// ============================================================================
// Konfetti + Hinweis, wenn ein neues Abzeichen freigeschaltet wurde
// ----------------------------------------------------------------------------
// Ohne zusätzliche Bibliothek: ein paar bunte Rechtecke fallen über den
// Bildschirm – in den Farben des Leipziger Mensa-Tellers.
// ============================================================================

const COLORS = ["#EE6A24", "#22408F", "#E8A317", "#3C6E47", "#EE6A24"];

function runConfetti(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * w,
    y: -20 - Math.random() * h * 0.5,
    vx: (Math.random() - 0.5) * 2.5,
    vy: 2 + Math.random() * 3,
    size: 6 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.25,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  const start = performance.now();
  let frame;
  function tick(now) {
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = t > 2600 ? Math.max(0, 1 - (t - 2600) / 600) : 1;
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      ctx.restore();
    }
    if (t < 3200) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export default function Celebration({ badge, onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const stop = !calm && canvasRef.current ? runConfetti(canvasRef.current) : () => {};
    const timer = setTimeout(onDone, 3800);
    return () => { stop(); clearTimeout(timer); };
  }, [badge, onDone]);

  return (
    <div
      onClick={onDone}
      style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      <div
        role="status"
        style={{
          position: "relative", background: C.card, color: C.text, borderRadius: 18,
          padding: "20px 24px", textAlign: "center", maxWidth: 300,
          border: `2px solid ${C.gold}`, boxShadow: "0 12px 40px rgba(0,0,0,.25)",
          animation: "mc-pop .35s ease-out",
        }}
      >
        <style>{`@keyframes mc-pop { from { transform: scale(.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
        <div style={styles.winnerLabel}>Neues Abzeichen!</div>
        <div style={{ fontSize: 48, lineHeight: 1.2, margin: "6px 0 2px" }}>{badge.icon}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{badge.name}</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>{badge.text}</div>
      </div>
    </div>
  );
}
