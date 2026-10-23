// ============================================================================
// Grundrisse für die Sitzplatz-Funktion (Draufsicht, ungefähr maßstabsgetreu)
// ----------------------------------------------------------------------------
// Jede Mensa bekommt einen Eintrag mit ihrer OpenMensa-Nummer. Die IDs der
// Tische ("A1", "T2" …) werden in der Datenbank gespeichert – bitte nicht
// mehr umbenennen, sonst passen laufende Check-ins nicht mehr.
//   A = Fensterreihe · B = an der Kinderecke · C = 6er am Luftraum · T = Tresen
//   E = lange Tische Mitte + 2 unten · F = rechts unten · P = Balkon (draußen)
// ============================================================================

export const SEAT_LAYOUTS = {
  // Mensa am Elsterbecken – nach dem Flucht- und Rettungsplan, Tische von Hannes (Oktober 2026)
  65: {
    viewBox: "-122 -74 1200 2186",
    terrace: { d: "M-112 -64 H-10 V1874 H771 V2099 H-112 Z", label: "BALKON", lx: 320, ly: 1971 },
    room: "M0 0 H944 V1864 H0 Z",
    walls: ["M264 0 V98 H606"],
    doors: [
      { x: -10, y: 320, w: 19, h: 70 },
      { x: -10, y: 781, w: 19, h: 70 },
      { x: -10, y: 1242, w: 19, h: 70 },
      { x: 176, y: 1854, w: 64, h: 19 },
      { x: 474, y: 1854, w: 70, h: 19 },
      { x: 502, y: -10, w: 51, h: 19 },
    ],
    areas: [
      { x: 714, y: 0, w: 230, h: 1008, label: "ESSENSAUSGABE", lx: 829, ly: 504, rotate: true },
      { x: 710, y: 1027, w: 38, h: 202, label: "RÜCKGABE", lx: 739, ly: 1128, rotate: true },
      { x: 749, y: 1018, w: 195, h: 272 },
      { x: 675, y: 1290, w: 269, h: 179 },
      { x: 758, y: 1469, w: 186, h: 395 },
      { x: 16, y: 16, w: 157, h: 128, label: "KINDER", lx: 94, ly: 90, round: true },
      { x: 266, y: 0, w: 214, h: 96 },
      { x: 275, y: 248, w: 278, h: 602 },
    ],
    stairs: [
      { x: 355, y: 288, w: 96, h: 554, steps: 12, label: "↕ EIN-/AUSGANG" },
      { x: 490, y: 1053, w: 77, h: 237, steps: 6, arrow: { x: 528, y: 1338 } },
      { x: 771, y: 2010, w: 294, h: 74, steps: 8, vertical: true, label: "↓ STRASSE", outdoor: true },
    ],
    rails: [
      { x: 470, y: 1056, w: 13, h: 234 },
    ],
    columns: [
      { x: 40, y: 232, s: 16 },
      { x: 40, y: 462, s: 16 },
      { x: 40, y: 693, s: 16 },
      { x: 40, y: 923, s: 16 },
      { x: 40, y: 1154, s: 16 },
      { x: 40, y: 1384, s: 16 },
      { x: 40, y: 1614, s: 16 },
      { x: 40, y: 1842, s: 16 },
      { x: 240, y: 1392, s: 16 },
      { x: 237, y: 1616, s: 16 },
      { x: 469, y: 1387, s: 16 },
      { x: 472, y: 224, s: 16 },
      { x: 472, y: 936, s: 16 },
      { x: 696, y: 232, s: 16 },
      { x: 696, y: 472, s: 16 },
      { x: 696, y: 704, s: 16 },
      { x: 696, y: 936, s: 16 },
    ],
    tables: [
      { id: "A1", x: 10, y: 160, w: 110, h: 43 },
      { id: "A2", x: 10, y: 275, w: 110, h: 43 },
      { id: "A3", x: 10, y: 390, w: 110, h: 43 },
      { id: "A4", x: 10, y: 506, w: 110, h: 43 },
      { id: "A5", x: 10, y: 621, w: 110, h: 43 },
      { id: "A6", x: 10, y: 736, w: 110, h: 43 },
      { id: "A7", x: 10, y: 851, w: 110, h: 43 },
      { id: "A8", x: 10, y: 966, w: 110, h: 43 },
      { id: "A9", x: 10, y: 1082, w: 110, h: 43 },
      { id: "A10", x: 10, y: 1197, w: 110, h: 43 },
      { id: "A11", x: 10, y: 1312, w: 110, h: 43 },
      { id: "A12", x: 10, y: 1427, w: 110, h: 43 },
      { id: "A13", x: 10, y: 1542, w: 110, h: 43 },
      { id: "A14", x: 10, y: 1658, w: 110, h: 43 },
      { id: "A15", x: 10, y: 1773, w: 110, h: 43 },
      { id: "B1", x: 186, y: 29, w: 40, h: 102 },
      { id: "C1", x: 192, y: 274, w: 67, h: 38 },
      { id: "C2", x: 192, y: 360, w: 67, h: 38 },
      { id: "C3", x: 192, y: 446, w: 67, h: 38 },
      { id: "C4", x: 192, y: 533, w: 67, h: 38 },
      { id: "C5", x: 192, y: 619, w: 67, h: 38 },
      { id: "C6", x: 192, y: 706, w: 67, h: 38 },
      { id: "C7", x: 192, y: 792, w: 67, h: 38 },
      { id: "T1", x: 275, y: 858, w: 304, h: 19, tresen: true },
      { id: "T2", x: 560, y: 269, w: 19, h: 579, tresen: true },
      { id: "E1", x: 224, y: 1080, w: 211, h: 45 },
      { id: "E2", x: 224, y: 1160, w: 211, h: 45 },
      { id: "E3", x: 224, y: 1240, w: 211, h: 45 },
      { id: "E4", x: 283, y: 1395, w: 168, h: 45 },
      { id: "E5", x: 240, y: 1475, w: 211, h: 45 },
      { id: "E6", x: 240, y: 1555, w: 211, h: 45 },
      { id: "E7", x: 283, y: 1741, w: 43, h: 110 },
      { id: "E8", x: 384, y: 1741, w: 43, h: 110 },
      { id: "F1", x: 632, y: 1514, w: 110, h: 43 },
      { id: "F2", x: 632, y: 1602, w: 110, h: 43 },
      { id: "F3", x: 632, y: 1688, w: 110, h: 43 },
      { id: "F4", x: 632, y: 1776, w: 110, h: 43 },
      { id: "P1", x: -74, y: 1981, w: 43, h: 110 },
      { id: "P2", x: 11, y: 1981, w: 43, h: 110 },
      { id: "P3", x: 96, y: 1981, w: 43, h: 110 },
      { id: "P4", x: 181, y: 1981, w: 43, h: 110 },
      { id: "P5", x: 266, y: 1981, w: 43, h: 110 },
      { id: "P6", x: 350, y: 1981, w: 43, h: 110 },
      { id: "P7", x: 435, y: 1981, w: 43, h: 110 },
      { id: "P8", x: 520, y: 1981, w: 43, h: 110 },
      { id: "P9", x: 605, y: 1981, w: 43, h: 110 },
    ],
  },
};

export function seatLayout(canteenId) {
  return SEAT_LAYOUTS[canteenId] || null;
}

// Mensen, für die es schon einen Plan gibt
export const SEAT_CANTEENS = Object.keys(SEAT_LAYOUTS).map(Number);
