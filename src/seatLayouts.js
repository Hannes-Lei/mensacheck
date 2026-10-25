// ============================================================================
// Grundrisse für die Sitzplatz-Funktion (Draufsicht, fürs Handy gezeichnet)
// ----------------------------------------------------------------------------
// Nicht maßstabsgetreu: leere Flächen sind schmaler, Tische größer, damit der
// Plan den Handy-Bildschirm füllt und man Tische gut antippen kann.
// Jede Mensa bekommt einen Eintrag mit ihrer OpenMensa-Nummer. Die IDs der
// Tische ("A1", "T2" …) werden in der Datenbank gespeichert – bitte nicht
// mehr umbenennen, sonst passen laufende Check-ins nicht mehr.
//   A = Fensterreihe · B = an der Kinderecke · C = 6er am Luftraum · T = Tresen
//   E = lange Tische Mitte + 2 unten · F = rechts unten · P = Balkon (draußen)
// ============================================================================

export const SEAT_LAYOUTS = {
  // Mensa am Elsterbecken – nach dem Flucht- und Rettungsplan, Tische von Hannes (Oktober 2026)
  65: {
    viewBox: "-8 -8 1046 1503.5",
    terrace: { d: "M0 0 H64 V1307.5 H892 V1487.5 H0 Z", label: "BALKON", lx: 440, ly: 1341.5 },
    room: "M70 20 H1010 V1301.5 H70 Z",
    walls: ["M428 20 V87.1 H770"],
    doors: [
      { x: 60, y: 240, w: 20, h: 48.4 },
      { x: 60, y: 556.8, w: 20, h: 48.4 },
      { x: 60, y: 873.6, w: 20, h: 48.4 },
      { x: 283.8, y: 1291.5, w: 67.4, h: 20 },
      { x: 627.5, y: 1291.5, w: 55, h: 20 },
      { x: 662.6, y: 10, w: 47.4, h: 20 },
    ],
    areas: [
      { x: 820, y: 20, w: 190, h: 693, label: "ESSENSAUSGABE", lx: 915, ly: 366.5, rotate: true },
      { x: 818, y: 726.2, w: 31, h: 180.4, label: "RÜCKGABE", lx: 843, ly: 816.4, rotate: true },
      { x: 849, y: 719.6, w: 161, h: 187 },
      { x: 829, y: 906.6, w: 181, h: 68.2 },
      { x: 932, y: 974.8, w: 78, h: 326.7 },
      { x: 96, y: 24, w: 110, h: 70, label: "KINDER", lx: 151, ly: 67, round: true },
      { x: 430, y: 20, w: 212, h: 66 },
      { x: 452, y: 190.5, w: 258, h: 413.6 },
    ],
    stairs: [
      { x: 536, y: 218, w: 90, h: 380.6, steps: 12, label: "↕ EIN-/AUSGANG" },
      { x: 640, y: 688.8, w: 60, h: 162.8, steps: 6, arrow: { x: 670, y: 884.6 } },
      { x: 910, y: 1351.5, w: 100, h: 124, steps: 6, vertical: true, label: "↓ STRASSE", outdoor: true },
    ],
    rails: [
      { x: 625, y: 691, w: 10, h: 160.6 },
    ],
    columns: [
      { x: 124, y: 177, s: 16 },
      { x: 124, y: 335.4, s: 16 },
      { x: 124, y: 493.8, s: 16 },
      { x: 124, y: 652.2, s: 16 },
      { x: 124, y: 810.6, s: 16 },
      { x: 124, y: 969, s: 16 },
      { x: 124, y: 1127.4, s: 16 },
      { x: 124, y: 1285.8, s: 16 },
      { x: 353.8, y: 919.5, s: 16 },
      { x: 349.6, y: 1073.5, s: 16 },
      { x: 622, y: 916.2, s: 16 },
      { x: 633.8, y: 171.5, s: 16 },
      { x: 633.8, y: 661, s: 16 },
      { x: 806, y: 177, s: 16 },
      { x: 806, y: 342, s: 16 },
      { x: 806, y: 501.5, s: 16 },
      { x: 806, y: 661, s: 16 },
    ],
    tables: [
      { id: "A1", x: 80, y: 115.8, w: 150, h: 48 },
      { id: "A2", x: 80, y: 206.2, w: 150, h: 48 },
      { id: "A3", x: 80, y: 274.2, w: 150, h: 48 },
      { id: "A4", x: 80, y: 364.6, w: 150, h: 48 },
      { id: "A5", x: 80, y: 432.6, w: 150, h: 48 },
      { id: "A6", x: 80, y: 523, w: 150, h: 48 },
      { id: "A7", x: 80, y: 591, w: 150, h: 48 },
      { id: "A8", x: 80, y: 681.4, w: 150, h: 48 },
      { id: "A9", x: 80, y: 749.4, w: 150, h: 48 },
      { id: "A10", x: 80, y: 839.8, w: 150, h: 48 },
      { id: "A11", x: 80, y: 907.8, w: 150, h: 48 },
      { id: "A12", x: 80, y: 998.2, w: 150, h: 48 },
      { id: "A13", x: 80, y: 1066.2, w: 150, h: 48 },
      { id: "A14", x: 80, y: 1156.6, w: 150, h: 48 },
      { id: "A15", x: 80, y: 1224.6, w: 150, h: 48 },
      { id: "B1", x: 330, y: 24, w: 48, h: 150 },
      { id: "C1", x: 330, y: 201.3, w: 106, h: 40 },
      { id: "C2", x: 330, y: 260.7, w: 106, h: 40 },
      { id: "C3", x: 330, y: 320.1, w: 106, h: 40 },
      { id: "C4", x: 330, y: 379.5, w: 106, h: 40 },
      { id: "C5", x: 330, y: 438.9, w: 106, h: 40 },
      { id: "C6", x: 330, y: 498.3, w: 106, h: 40 },
      { id: "C7", x: 330, y: 557.7, w: 106, h: 40 },
      { id: "T1", x: 452, y: 607.2, w: 258, h: 18, tresen: true },
      { id: "T2", x: 718, y: 204.8, w: 18, h: 398.2, tresen: true },
      { id: "E1", x: 330, y: 703.9, w: 280, h: 38 },
      { id: "E2", x: 330, y: 758.9, w: 280, h: 38 },
      { id: "E3", x: 330, y: 813.9, w: 280, h: 38 },
      { id: "E4", x: 400, y: 920.6, w: 210, h: 38 },
      { id: "E5", x: 330, y: 975.6, w: 280, h: 38 },
      { id: "E6", x: 330, y: 1030.6, w: 280, h: 38 },
      { id: "E7", x: 413, y: 1165.5, w: 48, h: 120 },
      { id: "E8", x: 547, y: 1165.5, w: 48, h: 120 },
      { id: "F1", x: 770, y: 1004.9, w: 150, h: 44 },
      { id: "F2", x: 770, y: 1079.1, w: 150, h: 44 },
      { id: "F3", x: 770, y: 1153.2, w: 150, h: 44 },
      { id: "F4", x: 770, y: 1227.4, w: 150, h: 44 },
      { id: "P1", x: 23, y: 1357.5, w: 42, h: 120 },
      { id: "P2", x: 117, y: 1357.5, w: 42, h: 120 },
      { id: "P3", x: 211, y: 1357.5, w: 42, h: 120 },
      { id: "P4", x: 305, y: 1357.5, w: 42, h: 120 },
      { id: "P5", x: 399, y: 1357.5, w: 42, h: 120 },
      { id: "P6", x: 493, y: 1357.5, w: 42, h: 120 },
      { id: "P7", x: 587, y: 1357.5, w: 42, h: 120 },
      { id: "P8", x: 681, y: 1357.5, w: 42, h: 120 },
      { id: "P9", x: 775, y: 1357.5, w: 42, h: 120 },
    ],
  },
};

export function seatLayout(canteenId) {
  return SEAT_LAYOUTS[canteenId] || null;
}

// Mensen, für die es schon einen Plan gibt
export const SEAT_CANTEENS = Object.keys(SEAT_LAYOUTS).map(Number);
