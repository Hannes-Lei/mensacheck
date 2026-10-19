// ============================================================================
// MensaCheck – Server-Funktion für die Speisepläne
// ----------------------------------------------------------------------------
// Diese Datei läuft NICHT im Browser, sondern auf den Servern von Vercel.
// Sie holt die Speisepläne von OpenMensa (openmensa.org) und gibt sie
// aufgeräumt an die App weiter. Weil die Anfrage vom Server kommt, gibt es
// kein CORS-Problem.
//
//   /api/mensa              -> Liste aller Leipziger Mensen
//   /api/mensa?canteen=63   -> Speiseplan der Mensa mit der Nummer 63
// ============================================================================

// Alle Mensen des Studentenwerks Leipzig mit ihrer OpenMensa-Nummer.
// Neue Mensa dazunehmen? Einfach eine Zeile ergänzen.
const CANTEENS = [
  { id: 63, name: "Mensa am Park" },
  { id: 64, name: "Mensa Academica" },
  { id: 65, name: "Mensa am Elsterbecken" },
  { id: 67, name: "Mensa am Medizincampus" },
  { id: 68, name: "Mensa Peterssteinweg" },
  { id: 66, name: "Mensa an den Tierkliniken" },
  { id: 69, name: "Mensa Schönauer Straße" },
];

// OpenMensa wirft in "notes" Beilagen, Allergene und Zusatzstoffe
// zusammen. Diese Listen helfen beim Sortieren.
const ALLERGENS = [
  "glutenhaltiges Getreide", "Weizen", "Roggen", "Gerste", "Hafer", "Dinkel",
  "Milch/ Milchzucker", "Eier", "Soja", "Sellerie", "Senf", "Sesam", "Fisch",
  "Erdnüsse", "Schalenfrüchte/ Nüsse", "Mandeln", "Haselnüsse", "Walnüsse",
  "Cashewnüsse", "Pistazien", "Lupine", "Krebstiere", "Weichtiere",
  "Sulfit/ Schwefeldioxid",
];
const ADDITIVES = [
  "Farbstoff", "Konservierungsstoff", "Antioxidationsmittel", "Phosphat",
  "Geschmacksverstärker", "Süßungsmittel", "koffeinhaltig", "chininhaltig",
  "geschwefelt", "geschwärzt", "gewachst", "Alkohol",
];
const MEAT = ["Schwein", "Rind", "Geflügel", "Lamm", "Wild", "Fisch"];
const DIET = ["Vegan", "Vegetarisch"];

// Kategorien, die keine Hauptgerichte sind (werden in der App einklappbar).
const EXTRA_CATEGORY = /beilage|smoothie|dessert|salat|getränk|obst/i;

const lower = (list) => list.map((x) => x.toLowerCase());
const ALLERGENS_L = lower(ALLERGENS);
const ADDITIVES_L = lower(ADDITIVES);
const MEAT_L = lower(MEAT);
const DIET_L = lower(DIET);

function cleanMeal(meal) {
  const notes = [...new Set(meal.notes || [])];
  const sides = [];
  const allergens = [];
  let hasMeat = false;
  let saysVegan = false;
  let saysVegetarian = false;

  for (const note of notes) {
    const n = note.trim();
    const l = n.toLowerCase();
    if (ALLERGENS_L.includes(l)) {
      allergens.push(n);
      if (l === "fisch") hasMeat = true;
    } else if (MEAT_L.includes(l)) {
      hasMeat = true;
    } else if (DIET_L.includes(l)) {
      if (l === "vegan") saysVegan = true;
      if (l === "vegetarisch") saysVegetarian = true;
    } else if (!ADDITIVES_L.includes(l)) {
      sides.push(n); // alles andere sind Beilagen wie "Dillsoße" oder "Reis"
    }
  }

  // Ernährungsform: Kategorie ist am verlässlichsten. Die Notizen sind bei
  // manchen Theken (z.B. Pastateller) für die ganze Theke gesetzt und
  // widersprechen sich – dann zeigen wir lieber gar kein Label.
  const cat = (meal.category || "").toLowerCase();
  let diet = null;
  if (cat.includes("vegan")) diet = "vegan";
  else if (cat.includes("vegetar")) diet = "vegetarisch";
  else if (!hasMeat && saysVegan) diet = "vegan";
  else if (!hasMeat && saysVegetarian) diet = "vegetarisch";

  return {
    id: meal.id,
    name: (meal.name || "").replace(/\s+/g, " ").trim(),
    category: meal.category || "",
    price: meal.prices?.students ?? null,
    sides,
    allergens,
    diet,
    isMain: !EXTRA_CATEGORY.test(meal.category || ""),
  };
}

function cleanDays(days) {
  return (Array.isArray(days) ? days : []).map((day) => {
    const seen = new Set();
    const meals = [];
    for (const m of day.meals || []) {
      const meal = cleanMeal(m);
      const key = `${meal.category}|${meal.name}`;
      if (seen.has(key)) continue; // doppelte Einträge entfernen
      seen.add(key);
      meals.push(meal);
    }
    return { date: day.date, closed: !!day.closed, meals };
  });
}

export default async function handler(req, res) {
  const canteenId = Number(req.query?.canteen);

  // Ohne Nummer: nur die Liste der Mensen zurückgeben.
  if (!req.query?.canteen) {
    res.setHeader("Cache-Control", "s-maxage=86400");
    return res.status(200).json({ canteens: CANTEENS });
  }

  // Nur unsere eigenen Mensen erlauben, nichts anderes abfragen.
  const canteen = CANTEENS.find((c) => c.id === canteenId);
  if (!canteen) {
    return res.status(400).json({ error: "Unbekannte Mensa." });
  }

  try {
    const url = `https://openmensa.org/api/v2/canteens/${canteen.id}/meals`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });

    if (response.status === 404) {
      return res.status(200).json({ canteen, days: [] });
    }
    if (!response.ok) {
      throw new Error(`OpenMensa antwortet mit Status ${response.status}`);
    }

    const days = cleanDays(await response.json());

    // 15 Minuten zwischenspeichern, damit wir OpenMensa nicht überlasten.
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ canteen, days });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Speiseplan gerade nicht erreichbar." });
  }
}
