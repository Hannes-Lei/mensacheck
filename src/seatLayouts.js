// ============================================================================
// Grundrisse für die Sitzplatz-Funktion (Draufsicht, nicht maßstabsgetreu)
// ----------------------------------------------------------------------------
// Koordinaten in einem eigenen Raster (ca. 1100 × 1300). Jede Mensa bekommt
// einen Eintrag mit ihrer OpenMensa-Nummer. Die IDs der Tische ("A1", "T2" …)
// werden in der Datenbank gespeichert – bitte nicht mehr umbenennen, sonst
// passen laufende Check-ins nicht mehr.
//   A = Fensterreihe · B = Kinderecke · C = 6er an der Treppe · T = Tresen
//   E = Mitte (lange Tische) · F = bei der Rückgabe · P = Terrasse (draußen)
// ============================================================================

export const SEAT_LAYOUTS = {
  // Mensa am Elsterbecken (Skizze von Hannes, Oktober 2026)
  65: {
    viewBox: "-70 15 1180 1460",
    // Terrasse draußen: links nur ein Weg, unten 9 Tische mit Bänken
    terrace: { d: "M-60 25 H30 V1300 H1064 V1460 H-60 Z", label: "TERRASSE", lx: 420, ly: 1335 },
    room: "M30 30 H905 V668 H1045 V1300 H30 Z",
    walls: ["M432 30 V160 H705"],
    doors: [
      { x: 20, y: 319, w: 20, h: 72 }, { x: 20, y: 619, w: 20, h: 72 }, { x: 20, y: 919, w: 20, h: 72 },
      { x: 274, y: 1290, w: 72, h: 20 }, { x: 709, y: 1290, w: 72, h: 20 },
    ],
    areas: [
      { x: 905, y: 30, w: 580, h: 638, label: "ESSENSAUSGABE", lx: 1010, ly: 350, rotate: true },
      { x: 925, y: 672, w: 115, h: 240, label: "RÜCKGABE", lx: 992, ly: 792, rotate: true },
      { x: 862, y: 946, w: 178, h: 24 },
      { x: 58, y: 45, w: 188, h: 148, label: "KINDERECKE", lx: 152, ly: 128, round: true },
    ],
    stairs: [
      { x: 397, y: 330, w: 243, h: 380, steps: 11, label: "↕ EIN-/AUSGANG" },
      { x: 600, y: 872, w: 86, h: 172, steps: 5, arrow: { x: 643, y: 1078 } },
      { x: 860, y: 1384, w: 196, h: 70, steps: 7, vertical: true, label: "↓ STRASSE", outdoor: true },
    ],
    rails: [{ x: 572, y: 872, w: 14, h: 170 }],
    columns: [
      { x: 614, y: 285, s: 30 }, { x: 672, y: 805, s: 32 }, { x: 325, y: 992, s: 32 }, { x: 578, y: 1068, s: 32 },
    ],
    tables: [
      { id: "A1", x: 52, y: 224, w: 142, h: 52 },
      { id: "A2", x: 52, y: 304, w: 142, h: 52 },
      { id: "A3", x: 52, y: 374, w: 142, h: 52 },
      { id: "A4", x: 52, y: 444, w: 142, h: 52 },
      { id: "A5", x: 52, y: 519, w: 142, h: 52 },
      { id: "A6", x: 52, y: 589, w: 142, h: 52 },
      { id: "A7", x: 52, y: 659, w: 142, h: 52 },
      { id: "A8", x: 52, y: 724, w: 142, h: 52 },
      { id: "A9", x: 52, y: 794, w: 142, h: 52 },
      { id: "A10", x: 52, y: 879, w: 142, h: 52 },
      { id: "A11", x: 52, y: 964, w: 142, h: 52 },
      { id: "A12", x: 52, y: 1059, w: 142, h: 52 },
      { id: "A13", x: 52, y: 1144, w: 142, h: 52 },
      { id: "A14", x: 52, y: 1229, w: 142, h: 52 },
      { id: "B1", x: 325, y: 60, w: 47, h: 128 },
      { id: "C1", x: 287, y: 312, w: 88, h: 48 },
      { id: "C2", x: 287, y: 375, w: 88, h: 48 },
      { id: "C3", x: 287, y: 438, w: 88, h: 48 },
      { id: "C4", x: 287, y: 500, w: 88, h: 48 },
      { id: "C5", x: 287, y: 565, w: 88, h: 48 },
      { id: "C6", x: 287, y: 628, w: 88, h: 48 },
      { id: "C7", x: 287, y: 690, w: 88, h: 48 },
      { id: "T1", x: 650, y: 340, w: 18, h: 390, tresen: true },
      { id: "T2", x: 392, y: 715, w: 275, h: 18, tresen: true },
      { id: "E1", x: 322, y: 822, w: 222, h: 45 },
      { id: "E2", x: 323, y: 877, w: 223, h: 45 },
      { id: "E3", x: 328, y: 930, w: 220, h: 45 },
      { id: "E4", x: 368, y: 985, w: 182, h: 45 },
      { id: "E5", x: 333, y: 1042, w: 222, h: 45 },
      { id: "E6", x: 337, y: 1095, w: 222, h: 45 },
      { id: "E7", x: 390, y: 1182, w: 48, h: 100 },
      { id: "E8", x: 556, y: 1182, w: 48, h: 100 },
      { id: "F1", x: 806, y: 1005, w: 165, h: 55 },
      { id: "F2", x: 806, y: 1077, w: 165, h: 55 },
      { id: "F3", x: 806, y: 1142, w: 165, h: 55 },
      { id: "F4", x: 806, y: 1207, w: 165, h: 55 },
      { id: "P1", x: -14, y: 1362, w: 44, h: 80 },
      { id: "P2", x: 82, y: 1362, w: 44, h: 80 },
      { id: "P3", x: 177, y: 1362, w: 44, h: 80 },
      { id: "P4", x: 273, y: 1362, w: 44, h: 80 },
      { id: "P5", x: 363, y: 1362, w: 44, h: 80 },
      { id: "P6", x: 456, y: 1362, w: 44, h: 80 },
      { id: "P7", x: 551, y: 1362, w: 44, h: 80 },
      { id: "P8", x: 641, y: 1362, w: 44, h: 80 },
      { id: "P9", x: 731, y: 1362, w: 44, h: 80 },
    ],
  },
};

export function seatLayout(canteenId) {
  return SEAT_LAYOUTS[canteenId] || null;
}

// Mensen, für die es schon einen Plan gibt
export const SEAT_CANTEENS = Object.keys(SEAT_LAYOUTS).map(Number);
