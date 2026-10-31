// =============================================================================
// recommender.js — Smart AI Recommender + Cost-to-Protein Ratio Engine
// Depends on: db.js (DB, titleCase)
//
// PUBLIC API (called by analisis.js after buildPayload):
//   runRecommender(payload, dailyGoals) → RecommenderResult
//
// JSON OUTPUT SHAPE:
// {
//   current_cost_to_protein : number,   // Rp per gram protein (total meal)
//   badge_status            : string,   // "High Value" | "Standard" | "Costly"
//   badge_color             : string,   // CSS var token for UI
//   remaining_calories      : number,
//   remaining_protein       : number,
//   protein_gap_status      : string,   // "on_track" | "low" | "critical"
//   ai_suggestion           : string,   // human-readable single sentence
//   top_picks               : Array<TopPick>
// }
//
// TopPick shape:
// {
//   key          : string,  // DB key
//   name         : string,
//   serving      : string,
//   cal_serving  : number,
//   prot_serving : number,
//   price        : number,  // estimated Rp
//   ctp_ratio    : number,  // Rp per g protein
//   fits_budget  : boolean  // cal_serving <= remaining_calories
// }
// =============================================================================

// ── Estimated prices (Rp per standard serving, warteg/kantin mahasiswa tier) ──
// Source: typical warung/warteg pricing in Jabodetabek 2024-2025.
// Update these values or fetch from a price API for production use.
const PRICE_DB = {
  "nasi putih":               3000,
  "nasi setengah":            2000,
  "nasi merah":               4000,
  "lontong":                  2500,
  "ketupat":                  2500,
  "mie goreng":               8000,
  "nasi goreng":              10000,
  "ayam goreng":              12000,
  "ayam bakar":               13000,
  "ayam bakar tanpa tepung":  13000,
  "ayam goreng tepung":       13000,
  "ayam suwir":               8000,
  "rendang ayam":             14000,
  "rendang":                  15000,
  "rendang daging":           15000,
  "semur daging":             13000,
  "bakso":                    10000,
  "rawon":                    14000,
  "ikan bakar":               13000,
  "ikan goreng":              11000,
  "ikan pesmol":              12000,
  "ikan nila bakar":          11000,
  "ikan lele goreng":         8000,
  "udang goreng":             15000,
  "cumi goreng":              14000,
  "ikan tongkol":             9000,
  "tempe goreng":             3000,
  "tahu goreng":              2500,
  "tempe bacem":              3500,
  "tahu bacem":               3000,
  "perkedel tahu":            3000,
  "tempe orek":               4000,
  "sayur asem":               4000,
  "sayur lodeh":              4000,
  "sayur bening":             3500,
  "cap cay":                  7000,
  "kangkung balado":          5000,
  "lalapan":                  2000,
  "sambal":                   1000,
  "sambal matah":             1000,
  "sambal hijau":             1000,
  "kerupuk":                  1000,
  "emping":                   1500,
  "teh tawar":                2000,
  "teh manis":                3000,
  "es teh manis":             3500,
  "air putih":                0,
  "jus jeruk":                5000,
  "telur dadar":              4000,
  "telur rebus":              3000,
  "telur balado":             4500,
  "perkedel":                 3000,
  "perkedel jagung":          3000,
  "soto ayam":                12000,
  "gado-gado":                10000,
};

// ── Thresholds ────────────────────────────────────────────────────────────────
const HIGH_VALUE_THRESHOLD   = 500;   // Rp/g protein → "High Value"
const STANDARD_THRESHOLD     = 800;   // Rp/g protein → "Standard"
// above STANDARD_THRESHOLD         → "Costly"

const PROTEIN_LOW_PCT        = 0.40;  // remaining_protein > 40% of daily goal → "low"
const PROTEIN_CRITICAL_PCT   = 0.60;  // remaining_protein > 60% of daily goal → "critical"
const CALORIE_TIGHT_PCT      = 0.25;  // remaining_calories < 25% of daily goal → calorie-tight

// ── Default daily goals for mahasiswa (adjustable by user profile) ─────────────
const DEFAULT_DAILY_GOALS = {
  calories: 2000,  // kcal
  protein:  120,   // g  (hypertrophy target ~1.5–2g/kg for ~70kg)
};

// ── Build candidate pool from DB ──────────────────────────────────────────────
// Returns all protein-bearing foods with per-serving macros + price + CTP ratio.
function _buildCandidatePool() {
  return Object.entries(DB)
    .map(([key, e]) => {
      const factor       = e.std / 100;
      const cal_serving  = Math.round(e.cal * factor);
      const prot_serving = +(e.p * factor).toFixed(1);
      const price        = PRICE_DB[key] ?? 5000;
      const ctp_ratio    = prot_serving > 0
        ? Math.round(price / prot_serving)
        : Infinity;

      return {
        key,
        name:        titleCase(key),
        serving:     `${e.std}${e.unit}`,
        cal_serving,
        prot_serving,
        price,
        ctp_ratio,
      };
    })
    // Only keep items with meaningful protein (≥3g/serving)
    .filter(c => c.prot_serving >= 3);
}

const _CANDIDATE_POOL = _buildCandidatePool();

// ── Core engine ───────────────────────────────────────────────────────────────
/**
 * runRecommender(payload, dailyGoals?) → RecommenderResult
 *
 * @param {object} payload     — output of buildPayload() from analisis.js
 * @param {object} dailyGoals  — { calories: number, protein: number }
 * @returns {RecommenderResult}
 */
function runRecommender(payload, dailyGoals) {
  const goals = Object.assign({}, DEFAULT_DAILY_GOALS, dailyGoals || {});

  // ── 1. Totals from today's meal log ─────────────────────────────────────────
  const eaten_cal  = payload.total_calories;
  const eaten_prot = payload.total_protein;

  // ── 2. Cost-to-Protein Ratio for this meal ───────────────────────────────────
  // Sum prices of all recognised items in payload
  const total_price = payload.items.reduce((sum, item) => {
    // Match item_name back to DB key (case-insensitive)
    const key   = _resolveKey(item.item_name);
    const price = key ? (PRICE_DB[key] ?? 0) : 0;
    return sum + price;
  }, 0);

  const current_cost_to_protein = eaten_prot > 0
    ? Math.round(total_price / eaten_prot)
    : null;

  // ── 3. Badge ─────────────────────────────────────────────────────────────────
  let badge_status, badge_color;
  if (current_cost_to_protein === null) {
    badge_status = "Tidak Ada Data";
    badge_color  = "var(--clr-text-dim)";
  } else if (current_cost_to_protein < HIGH_VALUE_THRESHOLD) {
    badge_status = "High Value";
    badge_color  = "var(--clr-secondary)";     // green
  } else if (current_cost_to_protein < STANDARD_THRESHOLD) {
    badge_status = "Standard";
    badge_color  = "var(--clr-carbs)";          // amber
  } else {
    badge_status = "Costly";
    badge_color  = "#c0614a";                   // terracotta red
  }

  // ── 4. Remaining targets ──────────────────────────────────────────────────────
  const remaining_calories = Math.max(0, goals.calories - eaten_cal);
  const remaining_protein  = Math.max(0, goals.protein  - eaten_prot);

  // ── 5. Protein gap status ─────────────────────────────────────────────────────
  const protein_pct_remaining = remaining_protein / goals.protein;
  let protein_gap_status;
  if (protein_pct_remaining > PROTEIN_CRITICAL_PCT) {
    protein_gap_status = "critical";
  } else if (protein_pct_remaining > PROTEIN_LOW_PCT) {
    protein_gap_status = "low";
  } else {
    protein_gap_status = "on_track";
  }

  const calorie_tight = remaining_calories < (goals.calories * CALORIE_TIGHT_PCT);

  // ── 6. Top picks: best CTP ratio that fits remaining calorie budget ───────────
  const fits = _CANDIDATE_POOL
    .filter(c => c.cal_serving <= remaining_calories)
    .sort((a, b) => a.ctp_ratio - b.ctp_ratio)   // lowest Rp/g prot first
    .slice(0, 3)
    .map(c => ({ ...c, fits_budget: true }));

  // Fallback: if nothing fits, show top 3 by CTP regardless of calories
  const top_picks = fits.length > 0
    ? fits
    : _CANDIDATE_POOL
        .sort((a, b) => a.ctp_ratio - b.ctp_ratio)
        .slice(0, 3)
        .map(c => ({ ...c, fits_budget: false }));

  // ── 7. AI suggestion sentence ─────────────────────────────────────────────────
  const ai_suggestion = _buildSuggestion({
    remaining_calories,
    remaining_protein,
    protein_gap_status,
    calorie_tight,
    top_picks,
    badge_status,
    current_cost_to_protein,
    eaten_cal,
    eaten_prot,
    goals,
  });

  // ── 8. Return structured payload ─────────────────────────────────────────────
  return {
    current_cost_to_protein,   // Rp per g protein (integer), or null
    badge_status,              // "High Value" | "Standard" | "Costly"
    badge_color,               // CSS value for UI badge
    total_meal_price: total_price,
    remaining_calories,
    remaining_protein: +remaining_protein.toFixed(1),
    protein_gap_status,        // "on_track" | "low" | "critical"
    calorie_tight,             // boolean
    ai_suggestion,             // string
    top_picks,                 // Array<TopPick> max 3
    goals_snapshot: {
      daily_calories: goals.calories,
      daily_protein:  goals.protein,
      pct_calories_consumed: +(eaten_cal  / goals.calories  * 100).toFixed(1),
      pct_protein_consumed:  +(eaten_prot / goals.protein   * 100).toFixed(1),
    },
  };
}

// ── Suggestion builder ────────────────────────────────────────────────────────
function _buildSuggestion(ctx) {
  const {
    remaining_calories, remaining_protein,
    protein_gap_status, calorie_tight,
    top_picks, badge_status,
    current_cost_to_protein, eaten_cal, eaten_prot, goals,
  } = ctx;

  const best = top_picks[0];

  // Case 1 — Over calorie, protein OK
  if (remaining_calories === 0 && protein_gap_status === "on_track") {
    return `Target kalori dan protein sudah tercapai. Minum air putih yang cukup untuk pemulihan otot.`;
  }

  // Case 2 — Over calorie, protein still needed
  if (remaining_calories === 0 && protein_gap_status !== "on_track") {
    return `Kalori harian sudah penuh (${eaten_cal} kkal) namun protein kurang ${remaining_protein.toFixed(1)}g. Pertimbangkan suplementasi whey protein rendah kalori.`;
  }

  // Case 3 — Calorie tight + protein critical
  if (calorie_tight && protein_gap_status === "critical") {
    const pick = best
      ? `Rekomendasi: ${best.name} (${best.cal_serving} kkal, ${best.prot_serving}g prot, Rp${best.ctp_ratio}/g prot).`
      : "";
    return `Sisa ${remaining_calories} kkal namun protein masih kurang ${remaining_protein.toFixed(1)}g — pilih lauk padat protein rendah kalori. ${pick}`;
  }

  // Case 4 — Calorie tight + protein low
  if (calorie_tight && protein_gap_status === "low") {
    const pick = best
      ? `Tambah ${best.name} (${best.cal_serving} kkal, Rp${best.ctp_ratio}/g prot) untuk menutup gap protein.`
      : "";
    return `Sisa ${remaining_calories} kkal, target protein hampir tercapai (kurang ${remaining_protein.toFixed(1)}g). ${pick}`;
  }

  // Case 5 — Normal + protein critical
  if (protein_gap_status === "critical") {
    const picks = top_picks.slice(0, 2).map(p => p.name).join(" atau ");
    return `Protein baru ${eaten_prot}g dari target ${goals.protein}g. Sisa ${remaining_calories} kkal tersedia — tambah ${picks} untuk hit target protein hari ini.`;
  }

  // Case 6 — Normal + protein low
  if (protein_gap_status === "low") {
    const pick = best
      ? `${best.name} (${best.prot_serving}g prot, Rp${best.price.toLocaleString("id-ID")}, Rp${best.ctp_ratio}/g)`
      : "lauk berprotein";
    return `Sisa protein ${remaining_protein.toFixed(1)}g. Sisa kalori ${remaining_calories} kkal — tambah ${pick} untuk closing protein.`;
  }

  // Case 7 — On track + High Value badge
  if (protein_gap_status === "on_track" && badge_status === "High Value") {
    return `Performa makanan hari ini efisien — rasio biaya Rp${current_cost_to_protein}/g protein (High Value ✓). Protein dan kalori dalam jalur target.`;
  }

  // Case 8 — On track + Costly badge
  if (protein_gap_status === "on_track" && badge_status === "Costly") {
    const pick = best
      ? `${best.name} (Rp${best.ctp_ratio}/g prot)`
      : "tempe/tahu goreng";
    return `Protein sudah aman, tapi biaya Rp${current_cost_to_protein}/g protein — di atas optimal. Besok coba ${pick} untuk efisiensi anggaran.`;
  }

  // Default — on track
  return `Asupan hari ini sudah baik. Sisa ${remaining_calories} kkal dan ${remaining_protein.toFixed(1)}g protein — tetap pantau target harian Anda.`;
}

// ── Key resolver: item_name (title-case) → DB key (lowercase) ─────────────────
function _resolveKey(itemName) {
  const lower = itemName.toLowerCase();
  // Exact match first
  if (DB[lower]) return lower;
  // Substring fallback
  return Object.keys(DB).find(k => lower.includes(k) || k.includes(lower)) || null;
}

// ── Render recommender card into the DOM ──────────────────────────────────────
// Called by analisis.js after injecting the meal card HTML.
function renderRecommenderCard(result) {
  const container = document.getElementById("recommender-output");
  if (!container) return;

  const ctpDisplay = result.current_cost_to_protein !== null
    ? `Rp${result.current_cost_to_protein.toLocaleString("id-ID")}/g protein`
    : "—";

  const pctCal  = result.goals_snapshot.pct_calories_consumed;
  const pctProt = result.goals_snapshot.pct_protein_consumed;

  const gapClass = {
    on_track: "gap-ok",
    low:      "gap-low",
    critical: "gap-critical",
  }[result.protein_gap_status] || "gap-ok";

  const picksHtml = result.top_picks.map(p => `
    <div class="rec-pick ${p.fits_budget ? "" : "rec-pick--tight"}">
      <div class="rec-pick-name">${p.name}</div>
      <div class="rec-pick-meta">${p.cal_serving} kkal · ${p.prot_serving}g prot</div>
      <div class="rec-pick-ctp">Rp${p.ctp_ratio.toLocaleString("id-ID")}<span>/g prot</span></div>
      <div class="rec-pick-price">Rp${p.price.toLocaleString("id-ID")}</div>
    </div>`).join("");

  container.innerHTML = `
  <div class="rec-card">

    <!-- Header -->
    <div class="rec-card-header">
      <div>
        <div class="rec-card-title">🤖 Smart AI Recommender</div>
        <div class="rec-card-sub">Cost-to-Protein Efficiency Analysis</div>
      </div>
      <span class="rec-badge" style="background:${result.badge_color}">${result.badge_status}</span>
    </div>

    <!-- CTP + Progress -->
    <div class="rec-stats-row">
      <div class="rec-stat">
        <div class="rec-stat-val">${ctpDisplay}</div>
        <div class="rec-stat-lbl">Biaya / Gram Protein</div>
      </div>
      <div class="rec-stat">
        <div class="rec-stat-val" style="color:var(--clr-tertiary)">Rp${result.total_meal_price.toLocaleString("id-ID")}</div>
        <div class="rec-stat-lbl">Total Harga Meal</div>
      </div>
      <div class="rec-stat">
        <div class="rec-stat-val ${gapClass}">${result.remaining_protein}g</div>
        <div class="rec-stat-lbl">Sisa Protein Target</div>
      </div>
      <div class="rec-stat">
        <div class="rec-stat-val" style="color:var(--clr-protein)">${result.remaining_calories}</div>
        <div class="rec-stat-lbl">Sisa Kalori (kkal)</div>
      </div>
    </div>

    <!-- Daily progress bars -->
    <div class="rec-progress-wrap">
      <div class="rec-progress-row">
        <span class="rec-progress-lbl">Kalori</span>
        <div class="rec-progress-bar">
          <div class="rec-progress-fill fill-cal" style="width:${Math.min(pctCal,100)}%"></div>
        </div>
        <span class="rec-progress-pct">${pctCal}%</span>
      </div>
      <div class="rec-progress-row">
        <span class="rec-progress-lbl">Protein</span>
        <div class="rec-progress-bar">
          <div class="rec-progress-fill fill-prot" style="width:${Math.min(pctProt,100)}%"></div>
        </div>
        <span class="rec-progress-pct">${pctProt}%</span>
      </div>
    </div>

    <!-- AI suggestion -->
    <div class="rec-suggestion">
      <div class="rec-suggestion-label">💡 Saran AI</div>
      <div class="rec-suggestion-text">${result.ai_suggestion}</div>
    </div>

    <!-- Top picks -->
    ${result.top_picks.length ? `
    <div class="rec-picks-wrap">
      <div class="rec-picks-title">🏆 Lauk Terbaik (Efisiensi Biaya-Protein)</div>
      <div class="rec-picks-grid">${picksHtml}</div>
    </div>` : ""}

    <!-- JSON toggle -->
    <button class="json-toggle" onclick="toggleRecJson()">{ } Lihat JSON Recommender</button>
    <div class="json-panel" id="rec-json-panel">
      <pre>${JSON.stringify(result, null, 2)}</pre>
    </div>

  </div>`;
}

function toggleRecJson() {
  const el = document.getElementById("rec-json-panel");
  el.classList.toggle("open");
  el.previousElementSibling.textContent =
    el.classList.contains("open") ? "{ } Tutup JSON Recommender" : "{ } Lihat JSON Recommender";
}
