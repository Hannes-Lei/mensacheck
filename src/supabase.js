import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Verbindung zur Supabase-Datenbank
// ----------------------------------------------------------------------------
// Der "publishable key" ist dafür gemacht, öffentlich in der App zu stehen.
// Geschützt werden die Daten durch die Regeln (Row Level Security), die wir
// in Supabase angelegt haben. Den SECRET key niemals hier eintragen!
// ============================================================================

const SUPABASE_URL = "https://onfkgaeupwbxqvowtwgx.supabase.co";
const SUPABASE_KEY = "sb_publishable_yyVMmnrnCxpJN_DkXPmrbA_Y4X1Ah6I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Öffentliche Adresse eines Profilbilds (gespeichert ist nur der Pfad)
export function avatarUrl(path) {
  return path ? supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl : null;
}
