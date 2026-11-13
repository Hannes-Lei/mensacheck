import React from "react";
import { C } from "./ui.jsx";

// ============================================================================
// Auffangnetz: Stürzt ein Teil der App ab, bleibt nicht die ganze Seite weiß.
// Stattdessen erscheint ein Hinweis mit „Neu laden“. Die anderen Bereiche
// (z.B. Freunde, Rangliste) funktionieren weiter.
// ============================================================================
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, info) {
    console.error("Schmausi-Fehler:", error, info?.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const box = {
      margin: this.props.full ? "20vh auto 0" : "16px", maxWidth: 420, padding: 20, textAlign: "center",
      background: C.card || "#fff", color: C.text || "#1A1A1A", border: `2.5px solid ${C.ink || "#1A1A1A"}`, borderRadius: 16,
      fontFamily: "system-ui, sans-serif",
    };
    const btn = {
      marginTop: 12, padding: "10px 18px", fontSize: 16, fontWeight: 700, cursor: "pointer",
      background: C.tomato || "#FF5A36", color: "#fff", border: `2.5px solid ${C.ink || "#1A1A1A"}`, borderRadius: 12,
    };
    return (
      <div style={box} role="alert">
        <div style={{ fontSize: 34 }}>🙈</div>
        <p style={{ fontSize: 17, fontWeight: 700, margin: "6px 0" }}>Hier ist etwas schiefgelaufen.</p>
        <p style={{ fontSize: 14, margin: 0, opacity: 0.8 }}>Deine Bewertungen sind sicher gespeichert.</p>
        <button type="button" style={btn} onClick={() => (this.props.full ? window.location.reload() : this.setState({ failed: false }))}>
          {this.props.full ? "Neu laden" : "Nochmal versuchen"}
        </button>
        {!this.props.full && (
          <div><button type="button" onClick={() => window.location.reload()} style={{ marginTop: 10, background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", fontSize: 14 }}>App neu laden</button></div>
        )}
      </div>
    );
  }
}
