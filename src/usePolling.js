import { useEffect, useRef } from "react";

// ============================================================================
// Regelmäßig nachladen – aber sparsam (weniger Anfragen an Supabase):
// • nur solange `enabled` (z.B. nur im sichtbaren Tab)
// • nur solange die App im Vordergrund ist (Handy gesperrt / anderer Browser-
//   Tab = Pause)
// • kommt die App zurück in den Vordergrund und ist das letzte Laden länger
//   als `minGap` her, wird sofort einmal frisch geladen
// • refreshOnEnable: auch beim Aktivwerden (z.B. Tab-Wechsel) sofort laden –
//   nur dort nutzen, wo nicht schon ein eigener Lade-Effekt das erledigt
// ============================================================================
export function usePolling(fn, ms, enabled = true, { minGap = 30000, refreshOnEnable = false } = {}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const last = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    const visible = () => document.visibilityState === "visible";
    const run = () => { last.current = Date.now(); fnRef.current(); };
    const refreshIfOld = () => { if (visible() && Date.now() - last.current >= minGap) run(); };
    if (refreshOnEnable) refreshIfOld();                  // Tab gerade aktiv geworden
    const t = setInterval(() => { if (visible()) run(); }, ms);
    document.addEventListener("visibilitychange", refreshIfOld);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refreshIfOld); };
  }, [ms, enabled, minGap, refreshOnEnable]);
}
