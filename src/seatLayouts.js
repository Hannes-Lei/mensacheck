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
    viewBox: "-8 -8 1008 1660",
    terrace: { d: "M0 0 H30 V1424 H870 V1644 H0 Z", label: "BALKON", lx: 450, ly: 1458 },
    room: "M36 20 H980 V1418 H36 Z",
    walls: ["M345 20 V93 H723"],
    doors: [
      { x: 26, y: 260, w: 20, h: 53 },
      { x: 26, y: 606, w: 20, h: 53 },
      { x: 26, y: 951, w: 20, h: 53 },
      { x: 225, y: 1408, w: 46, h: 20 },
      { x: 548, y: 1408, w: 55, h: 20 },
      { x: 583, y: 10, w: 47, h: 20 },
    ],
    areas: [
      { x: 790, y: 20, w: 190, h: 756, label: "ESSENSAUSGABE", lx: 885, ly: 398, rotate: true },
      { x: 788, y: 792, w: 31, h: 196, label: "RÜCKGABE", lx: 813, ly: 890, rotate: true },
      { x: 819, y: 783, w: 161, h: 204 },
      { x: 759, y: 987, w: 221, h: 134 },
      { x: 862, y: 1122, w: 118, h: 296 },
      { x: 54, y: 32, w: 176, h: 88, label: "KINDER", lx: 142, ly: 84, round: true },
      { x: 346, y: 20, w: 248, h: 72 },
      { x: 372, y: 206, w: 258, h: 451 },
    ],
    stairs: [
      { x: 456, y: 236, w: 90, h: 415, steps: 12, label: "↕ EIN-/AUSGANG" },
      { x: 560, y: 810, w: 60, h: 178, steps: 6, arrow: { x: 590, y: 1023 } },
      { x: 878, y: 1478, w: 100, h: 140, steps: 6, vertical: true, label: "↓ STRASSE", outdoor: true },
    ],
    rails: [
      { x: 545, y: 812, w: 10, h: 175 },
    ],
    columns: [
      { x: 90, y: 192, s: 16 },
      { x: 90, y: 365, s: 16 },
      { x: 90, y: 538, s: 16 },
      { x: 90, y: 710, s: 16 },
      { x: 90, y: 883, s: 16 },
      { x: 90, y: 1056, s: 16 },
      { x: 90, y: 1229, s: 16 },
      { x: 90, y: 1399, s: 16 },
      { x: 274, y: 1062, s: 16 },
      { x: 270, y: 1230, s: 16 },
      { x: 542, y: 1058, s: 16 },
      { x: 554, y: 186, s: 16 },
      { x: 554, y: 720, s: 16 },
      { x: 772, y: 192, s: 16 },
      { x: 772, y: 372, s: 16 },
      { x: 772, y: 546, s: 16 },
      { x: 772, y: 720, s: 16 },
    ],
    tables: [
      { id: "A1", x: 46, y: 132, w: 150, h: 48 },
      { id: "A2", x: 46, y: 219, w: 150, h: 48 },
      { id: "A3", x: 46, y: 305, w: 150, h: 48 },
      { id: "A4", x: 46, y: 391, w: 150, h: 48 },
      { id: "A5", x: 46, y: 478, w: 150, h: 48 },
      { id: "A6", x: 46, y: 564, w: 150, h: 48 },
      { id: "A7", x: 46, y: 651, w: 150, h: 48 },
      { id: "A8", x: 46, y: 737, w: 150, h: 48 },
      { id: "A9", x: 46, y: 823, w: 150, h: 48 },
      { id: "A10", x: 46, y: 910, w: 150, h: 48 },
      { id: "A11", x: 46, y: 996, w: 150, h: 48 },
      { id: "A12", x: 46, y: 1083, w: 150, h: 48 },
      { id: "A13", x: 46, y: 1169, w: 150, h: 48 },
      { id: "A14", x: 46, y: 1255, w: 150, h: 48 },
      { id: "A15", x: 46, y: 1342, w: 150, h: 48 },
      { id: "B1", x: 252, y: 28, w: 48, h: 140 },
      { id: "C1", x: 250, y: 218, w: 106, h: 44 },
      { id: "C2", x: 250, y: 282, w: 106, h: 44 },
      { id: "C3", x: 250, y: 347, w: 106, h: 44 },
      { id: "C4", x: 250, y: 412, w: 106, h: 44 },
      { id: "C5", x: 250, y: 477, w: 106, h: 44 },
      { id: "C6", x: 250, y: 542, w: 106, h: 44 },
      { id: "C7", x: 250, y: 606, w: 106, h: 44 },
      { id: "T1", x: 372, y: 661, w: 258, h: 18, tresen: true },
      { id: "T2", x: 638, y: 222, w: 18, h: 434.4, tresen: true },
      { id: "E1", x: 250, y: 826, w: 280, h: 42 },
      { id: "E2", x: 250, y: 886, w: 280, h: 42 },
      { id: "E3", x: 250, y: 946, w: 280, h: 42 },
      { id: "E4", x: 320, y: 1062, w: 210, h: 42 },
      { id: "E5", x: 250, y: 1122, w: 280, h: 42 },
      { id: "E6", x: 250, y: 1182, w: 280, h: 42 },
      { id: "E7", x: 333, y: 1258, w: 48, h: 150 },
      { id: "E8", x: 464, y: 1258, w: 48, h: 150 },
      { id: "F1", x: 700, y: 1142, w: 150, h: 48 },
      { id: "F2", x: 700, y: 1211, w: 150, h: 48 },
      { id: "F3", x: 700, y: 1280, w: 150, h: 48 },
      { id: "F4", x: 700, y: 1349, w: 150, h: 48 },
      { id: "P1", x: 56, y: 1473, w: 48, h: 150 },
      { id: "P2", x: 152, y: 1473, w: 48, h: 150 },
      { id: "P3", x: 248, y: 1473, w: 48, h: 150 },
      { id: "P4", x: 344, y: 1473, w: 48, h: 150 },
      { id: "P5", x: 440, y: 1473, w: 48, h: 150 },
      { id: "P6", x: 536, y: 1473, w: 48, h: 150 },
      { id: "P7", x: 632, y: 1473, w: 48, h: 150 },
      { id: "P8", x: 728, y: 1473, w: 48, h: 150 },
      { id: "P9", x: 824, y: 1473, w: 48, h: 150 },
    ],
  },
};

export function seatLayout(canteenId) {
  return SEAT_LAYOUTS[canteenId] || null;
}

// Mensen, für die es schon einen Plan gibt
export const SEAT_CANTEENS = Object.keys(SEAT_LAYOUTS).map(Number);
