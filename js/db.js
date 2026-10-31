// =============================================================================
// db.js — Nutrition database, food metadata, and example orders
// Shared by analisis.js and katalog.js
// To swap in a backend: replace DB with a fetch() / Supabase query that returns
// the same shape, and replace FOOD_META with server-side category data.
// =============================================================================

// ── Nutrition database (values per 100 g or 100 ml) ──────────────────────────
// Fields: cal (kcal), p (protein g), c (carbs g), f (fats g),
//         unit ("g"|"ml"), std (standard serving size), note (display string)
const DB = {
  // ── Karbohidrat ─────────────────────────────────────────────────────────────
  "nasi putih":          { cal:130, p:2.7, c:28.2, f:0.3,  unit:"g",  std:200, note:"1 porsi standar ~200g" },
  "nasi setengah":       { cal:130, p:2.7, c:28.2, f:0.3,  unit:"g",  std:100, note:"setengah porsi ~100g" },
  "nasi merah":          { cal:111, p:2.6, c:23.0, f:0.9,  unit:"g",  std:200, note:"1 porsi standar ~200g" },
  "lontong":             { cal:84,  p:1.6, c:18.0, f:0.4,  unit:"g",  std:150, note:"~2 biji ~150g" },
  "ketupat":             { cal:84,  p:1.6, c:18.0, f:0.4,  unit:"g",  std:150, note:"~1 biji ~150g" },
  "mie goreng":          { cal:220, p:5.5, c:35.0, f:7.2,  unit:"g",  std:200, note:"1 porsi ~200g" },
  "nasi goreng":         { cal:190, p:5.0, c:30.0, f:6.0,  unit:"g",  std:250, note:"1 porsi ~250g" },

  // ── Protein Hewani — Unggas ──────────────────────────────────────────────────
  "ayam goreng":              { cal:260, p:27.0, c:4.0,  f:15.0, unit:"g", std:130, note:"1 potong ~130g" },
  "ayam bakar":               { cal:180, p:29.0, c:2.0,  f:6.5,  unit:"g", std:130, note:"1 potong ~130g" },
  "ayam bakar tanpa tepung":  { cal:165, p:30.0, c:0.5,  f:5.5,  unit:"g", std:130, note:"1 potong ~130g, no breading" },
  "ayam goreng tepung":       { cal:290, p:24.0, c:12.0, f:16.0, unit:"g", std:140, note:"1 potong ~140g" },
  "ayam suwir":               { cal:200, p:28.0, c:2.0,  f:9.0,  unit:"g", std:80,  note:"1 ladle ~80g" },
  "rendang ayam":             { cal:210, p:27.0, c:5.0,  f:10.0, unit:"g", std:100, note:"1 porsi ~100g" },

  // ── Protein Hewani — Sapi ────────────────────────────────────────────────────
  "rendang":        { cal:195, p:22.0, c:5.5,  f:9.5, unit:"g", std:100, note:"1 porsi ~100g" },
  "rendang daging": { cal:195, p:22.0, c:5.5,  f:9.5, unit:"g", std:100, note:"1 porsi ~100g" },
  "semur daging":   { cal:160, p:18.0, c:8.0,  f:7.0, unit:"g", std:100, note:"1 porsi ~100g" },
  "bakso":          { cal:155, p:12.0, c:10.0, f:7.5, unit:"g", std:150, note:"5–6 butir ~150g" },
  "rawon":          { cal:140, p:15.0, c:6.5,  f:6.0, unit:"g", std:200, note:"1 mangkuk ~200g" },

  // ── Protein Hewani — Seafood ─────────────────────────────────────────────────
  "ikan bakar":       { cal:145, p:28.0, c:0.5, f:3.5, unit:"g", std:150, note:"1 ekor sedang ~150g" },
  "ikan goreng":      { cal:195, p:26.0, c:3.5, f:8.5, unit:"g", std:150, note:"1 ekor sedang ~150g" },
  "ikan pesmol":      { cal:180, p:24.0, c:6.5, f:7.0, unit:"g", std:150, note:"1 ekor sedang ~150g" },
  "ikan nila bakar":  { cal:128, p:26.0, c:0.0, f:2.5, unit:"g", std:150, note:"1 ekor ~150g" },
  "ikan lele goreng": { cal:180, p:22.0, c:4.5, f:8.5, unit:"g", std:120, note:"1 ekor ~120g" },
  "udang goreng":     { cal:195, p:22.5, c:5.0, f:9.5, unit:"g", std:100, note:"5–6 ekor ~100g" },
  "cumi goreng":      { cal:175, p:18.0, c:6.0, f:8.5, unit:"g", std:100, note:"1 porsi ~100g" },
  "ikan tongkol":     { cal:155, p:27.0, c:2.0, f:4.5, unit:"g", std:100, note:"1 porsi ~100g" },

  // ── Protein Nabati ───────────────────────────────────────────────────────────
  "tempe goreng":  { cal:200, p:14.0, c:8.5,  f:11.5, unit:"g", std:70, note:"2 potong ~70g" },
  "tahu goreng":   { cal:165, p:10.5, c:4.5,  f:11.0, unit:"g", std:80, note:"2 potong ~80g" },
  "tempe bacem":   { cal:185, p:13.5, c:11.0, f:9.0,  unit:"g", std:70, note:"2 potong ~70g" },
  "tahu bacem":    { cal:150, p:9.5,  c:8.5,  f:8.5,  unit:"g", std:80, note:"2 potong ~80g" },
  "perkedel tahu": { cal:170, p:8.5,  c:12.0, f:9.5,  unit:"g", std:80, note:"1–2 biji ~80g" },
  "tempe orek":    { cal:215, p:13.0, c:14.5, f:12.0, unit:"g", std:70, note:"1 sendok ~70g" },

  // ── Sayuran ──────────────────────────────────────────────────────────────────
  "sayur asem":      { cal:40, p:2.0, c:7.5, f:0.5, unit:"g", std:200, note:"1 mangkuk ~200g" },
  "sayur lodeh":     { cal:75, p:3.5, c:8.0, f:3.5, unit:"g", std:200, note:"1 mangkuk ~200g" },
  "sayur bening":    { cal:35, p:2.5, c:5.5, f:0.5, unit:"g", std:200, note:"1 mangkuk ~200g" },
  "cap cay":         { cal:80, p:4.5, c:8.5, f:3.0, unit:"g", std:200, note:"1 porsi ~200g" },
  "kangkung balado": { cal:65, p:3.0, c:5.5, f:3.5, unit:"g", std:100, note:"1 porsi ~100g" },
  "lalapan":         { cal:25, p:1.5, c:4.0, f:0.5, unit:"g", std:80,  note:"sepiring ~80g" },

  // ── Sambal & Pelengkap ───────────────────────────────────────────────────────
  "sambal":       { cal:30,  p:0.8, c:4.5,  f:1.2, unit:"g", std:20, note:"1 sendok ~20g" },
  "sambal matah": { cal:35,  p:0.7, c:3.5,  f:2.0, unit:"g", std:20, note:"1 sendok ~20g" },
  "sambal hijau": { cal:28,  p:0.9, c:4.0,  f:1.0, unit:"g", std:20, note:"1 sendok ~20g" },
  "kerupuk":      { cal:375, p:4.5, c:65.0, f:9.5, unit:"g", std:15, note:"2–3 keping ~15g" },
  "emping":       { cal:360, p:6.5, c:62.0, f:8.5, unit:"g", std:15, note:"2–3 keping ~15g" },

  // ── Minuman ──────────────────────────────────────────────────────────────────
  "teh tawar":    { cal:2,  p:0.0, c:0.5,  f:0.0, unit:"ml", std:200, note:"1 gelas ~200ml" },
  "teh manis":    { cal:45, p:0.0, c:11.5, f:0.0, unit:"ml", std:200, note:"1 gelas ~200ml, 2 sdt gula" },
  "es teh manis": { cal:45, p:0.0, c:11.5, f:0.0, unit:"ml", std:200, note:"1 gelas ~200ml" },
  "air putih":    { cal:0,  p:0.0, c:0.0,  f:0.0, unit:"ml", std:250, note:"1 gelas ~250ml" },
  "jus jeruk":    { cal:47, p:0.7, c:11.5, f:0.2, unit:"ml", std:200, note:"1 gelas ~200ml" },

  // ── Extras ───────────────────────────────────────────────────────────────────
  "telur dadar":    { cal:185, p:11.5, c:1.5,  f:14.5, unit:"g", std:80,  note:"1 porsi ~80g" },
  "telur rebus":    { cal:155, p:12.5, c:1.2,  f:10.5, unit:"g", std:55,  note:"1 butir ~55g" },
  "telur balado":   { cal:175, p:12.0, c:3.5,  f:12.0, unit:"g", std:60,  note:"1 butir ~60g" },
  "perkedel":       { cal:185, p:5.5,  c:18.5, f:10.5, unit:"g", std:80,  note:"1 biji ~80g" },
  "perkedel jagung":{ cal:165, p:4.5,  c:20.0, f:8.0,  unit:"g", std:70,  note:"1 biji ~70g" },
  "soto ayam":      { cal:135, p:12.0, c:8.5,  f:5.5,  unit:"g", std:350, note:"1 mangkuk ~350g" },
  "gado-gado":      { cal:175, p:8.5,  c:14.5, f:10.5, unit:"g", std:300, note:"1 porsi ~300g" },
};

// ── Category metadata ─────────────────────────────────────────────────────────
// Maps DB key → [displayLabel, filterTag]
// filterTag must match data-filter values on the chip buttons in HTML.
const FOOD_META = {
  "nasi putih":               ["Karbohidrat",    "karbohidrat"],
  "nasi setengah":            ["Karbohidrat",    "karbohidrat"],
  "nasi merah":               ["Karbohidrat",    "karbohidrat"],
  "lontong":                  ["Karbohidrat",    "karbohidrat"],
  "ketupat":                  ["Karbohidrat",    "karbohidrat"],
  "mie goreng":               ["Karbohidrat",    "karbohidrat"],
  "nasi goreng":              ["Karbohidrat",    "karbohidrat"],
  "ayam goreng":              ["Protein Hewani", "protein-hewani"],
  "ayam bakar":               ["Protein Hewani", "protein-hewani"],
  "ayam bakar tanpa tepung":  ["Protein Hewani", "protein-hewani"],
  "ayam goreng tepung":       ["Protein Hewani", "protein-hewani"],
  "ayam suwir":               ["Protein Hewani", "protein-hewani"],
  "rendang ayam":             ["Protein Hewani", "protein-hewani"],
  "rendang":                  ["Protein Hewani", "protein-hewani"],
  "rendang daging":           ["Protein Hewani", "protein-hewani"],
  "semur daging":             ["Protein Hewani", "protein-hewani"],
  "bakso":                    ["Protein Hewani", "protein-hewani"],
  "rawon":                    ["Protein Hewani", "protein-hewani"],
  "ikan bakar":               ["Protein Hewani", "protein-hewani"],
  "ikan goreng":              ["Protein Hewani", "protein-hewani"],
  "ikan pesmol":              ["Protein Hewani", "protein-hewani"],
  "ikan nila bakar":          ["Protein Hewani", "protein-hewani"],
  "ikan lele goreng":         ["Protein Hewani", "protein-hewani"],
  "udang goreng":             ["Protein Hewani", "protein-hewani"],
  "cumi goreng":              ["Protein Hewani", "protein-hewani"],
  "ikan tongkol":             ["Protein Hewani", "protein-hewani"],
  "tempe goreng":             ["Protein Nabati", "protein-nabati"],
  "tahu goreng":              ["Protein Nabati", "protein-nabati"],
  "tempe bacem":              ["Protein Nabati", "protein-nabati"],
  "tahu bacem":               ["Protein Nabati", "protein-nabati"],
  "perkedel tahu":            ["Protein Nabati", "protein-nabati"],
  "tempe orek":               ["Protein Nabati", "protein-nabati"],
  "sayur asem":               ["Sayuran",        "sayuran"],
  "sayur lodeh":              ["Sayuran",        "sayuran"],
  "sayur bening":             ["Sayuran",        "sayuran"],
  "cap cay":                  ["Sayuran",        "sayuran"],
  "kangkung balado":          ["Sayuran",        "sayuran"],
  "lalapan":                  ["Sayuran",        "sayuran"],
  "sambal":                   ["Pelengkap",      "pelengkap"],
  "sambal matah":             ["Pelengkap",      "pelengkap"],
  "sambal hijau":             ["Pelengkap",      "pelengkap"],
  "kerupuk":                  ["Pelengkap",      "pelengkap"],
  "emping":                   ["Pelengkap",      "pelengkap"],
  "teh tawar":                ["Minuman",        "minuman"],
  "teh manis":                ["Minuman",        "minuman"],
  "es teh manis":             ["Minuman",        "minuman"],
  "air putih":                ["Minuman",        "minuman"],
  "jus jeruk":                ["Minuman",        "minuman"],
  "telur dadar":              ["Protein Hewani", "protein-hewani"],
  "telur rebus":              ["Protein Hewani", "protein-hewani"],
  "telur balado":             ["Protein Hewani", "protein-hewani"],
  "perkedel":                 ["Pelengkap",      "pelengkap"],
  "perkedel jagung":          ["Pelengkap",      "pelengkap"],
  "soto ayam":                ["Protein Hewani", "protein-hewani"],
  "gado-gado":                ["Protein Nabati", "protein-nabati"],
};

// ── Quick-fill example orders (used by analisis.js) ───────────────────────────
const EXAMPLES = [
  "nasi putih, tempe goreng, tahu goreng, sayur asem, sambal, teh tawar",
  "nasi setengah, rendang daging, ayam bakar tanpa tepung, sambal hijau, sayur lodeh",
  "nasi putih, ikan bakar, udang goreng, kangkung balado, sambal matah, teh tawar",
  "nasi putih, ayam goreng, telur dadar, tempe orek, sayur bening, kerupuk",
];

// ── Shared utility ────────────────────────────────────────────────────────────
function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}
