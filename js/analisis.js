// =============================================================================
// analisis.js — Halaman Analisis Pesanan
// Depends on: db.js (DB, EXAMPLES, titleCase)
// =============================================================================

// ── Quick-fill example orders ─────────────────────────────────────────────────
function fillExample(i) {
  document.getElementById("orderInput").value = EXAMPLES[i];
  analyzeOrder();
}

// ── Text parser: converts raw order string → array of item objects ─────────────
// Handles comma/semicolon/newline separators, strips quantity words,
// longest-key-first matching to prevent "ayam" eating "ayam bakar tanpa tepung".
function parseOrder(raw) {
  const tokens = raw.toLowerCase().split(/,|;|\n/).map(s => s.trim()).filter(Boolean);
  const found  = [];
  const keys   = Object.keys(DB).sort((a, b) => b.length - a.length); // longest first

  tokens.forEach(token => {
    // Strip common quantity words; preserve modifier phrases like "tanpa tepung"
    const cleaned = token
      .replace(/\b(satu|dua|tiga|se|setengah porsi|1|2|3)\b/g, "")
      .replace(/\btanpa\s+\S+/g, m => m)
      .trim();

    // Try exact match, then substring, then word-set match
    let match = keys.find(k => cleaned === k || cleaned.includes(k));
    if (!match) match = keys.find(k => k.split(" ").every(w => cleaned.includes(w)));

    if (match) {
      const entry  = DB[match];
      const factor = entry.std / 100;
      found.push({
        item_name:    titleCase(match),
        serving_grams: entry.std,
        serving_unit:  entry.unit,
        note:          entry.note,
        calories: Math.round(entry.cal * factor),
        protein:  +(entry.p * factor).toFixed(1),
        carbs:    +(entry.c * factor).toFixed(1),
        fats:     +(entry.f * factor).toFixed(1),
      });
    } else if (cleaned.length > 2) {
      // Unknown item: insert generic estimate so the payload stays complete
      found.push({
        item_name:    titleCase(cleaned),
        serving_grams: 100,
        serving_unit:  "g",
        note:          "estimasi generik — data tidak tersedia",
        calories: 120,
        protein: 5.0,
        carbs: 18.0,
        fats: 3.5,
        unknown: true,
      });
    }
  });

  return found;
}

// ── Build structured JSON payload from parsed items ───────────────────────────
// Shape matches the spec: meal_name, total_calories, total_protein,
// total_carbs, total_fats, items[].
function buildPayload(mealName, items) {
  return {
    meal_name:      mealName,
    meal_time:      new Date().toISOString(),
    total_calories: items.reduce((s, i) => s + i.calories, 0),
    total_protein:  +(items.reduce((s, i) => s + i.protein, 0).toFixed(1)),
    total_carbs:    +(items.reduce((s, i) => s + i.carbs,   0).toFixed(1)),
    total_fats:     +(items.reduce((s, i) => s + i.fats,    0).toFixed(1)),
    items: items.map(i => ({
      item_name: i.item_name,
      serving:   `${i.serving_grams}${i.serving_unit}`,
      note:      i.note,
      calories:  i.calories,
      protein:   i.protein,
      carbs:     i.carbs,
      fats:      i.fats,
    })),
  };
}

// ── Main render: reads textarea → parses → builds payload → injects HTML card ──
function analyzeOrder() {
  const raw = document.getElementById("orderInput").value.trim();
  if (!raw) return;

  const items = parseOrder(raw);

  if (!items.length) {
    document.getElementById("output").innerHTML =
      `<div class="empty-state">
         <div class="icon">🔍</div>
         <p>Tidak ada item yang dikenali. Coba gunakan nama makanan dalam Bahasa Indonesia.</p>
       </div>`;
    // Hide recommender if no items
    const rec = document.getElementById("recommender-output");
    if (rec) rec.innerHTML = "";
    const goalsBar = document.getElementById("rec-goals-bar");
    if (goalsBar) goalsBar.style.display = "none";
    return;
  }

  const payload = buildPayload(guessMealName(), items);

  // Macro calorie distribution percentages
  const calP   = payload.total_protein * 4;
  const calC   = payload.total_carbs   * 4;
  const calF   = payload.total_fats    * 9;
  const calTot = calP + calC + calF || 1;
  const pPct   = (calP / calTot * 100).toFixed(1);
  const cPct   = (calC / calTot * 100).toFixed(1);
  const fPct   = (calF / calTot * 100).toFixed(1);

  const jsonId   = "json-" + Date.now();
  const timeStr  = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const rowsHtml = payload.items.map(it => `
    <tr>
      <td>
        <div class="item-name">${it.item_name}</div>
        <div class="item-note">${it.note}</div>
      </td>
      <td class="item-cal">${it.calories}</td>
      <td class="item-prot">${it.protein}</td>
      <td class="item-carbs">${it.carbs}</td>
      <td class="item-fats">${it.fats}</td>
    </tr>`).join("");

  document.getElementById("output").innerHTML = `
  <div class="meal-card">
    <div class="card-header">
      <div>
        <div class="meal-title">${payload.meal_name}</div>
        <div class="meal-subtitle">${payload.items.length} komponen &bull; ${timeStr}</div>
      </div>
      <div class="total-cal">🔥 ${payload.total_calories} kcal</div>
    </div>

    <div class="macro-summary">
      <div class="macro-box">
        <div class="macro-val protein">${payload.total_protein}g</div>
        <div class="macro-lbl">Protein</div>
      </div>
      <div class="macro-box">
        <div class="macro-val carbs">${payload.total_carbs}g</div>
        <div class="macro-lbl">Karbo</div>
      </div>
      <div class="macro-box">
        <div class="macro-val fats">${payload.total_fats}g</div>
        <div class="macro-lbl">Lemak</div>
      </div>
    </div>

    <div class="ratio-bar-wrap">
      <div class="ratio-bar-lbl">Distribusi Kalori Makro</div>
      <div class="ratio-bar">
        <div class="ratio-seg protein" style="width:${pPct}%"></div>
        <div class="ratio-seg carbs"   style="width:${cPct}%"></div>
        <div class="ratio-seg fats"    style="width:${fPct}%"></div>
      </div>
      <div class="ratio-legend">
        <span><span class="dot" style="background:var(--clr-protein)"></span>Protein ${pPct}%</span>
        <span><span class="dot" style="background:var(--clr-carbs)"></span>Karbo ${cPct}%</span>
        <span><span class="dot" style="background:var(--clr-fats)"></span>Lemak ${fPct}%</span>
      </div>
    </div>

    <div class="items-wrap">
      <div class="items-title">Rincian Per Komponen</div>
      <table>
        <thead>
          <tr>
            <th>Komponen</th>
            <th>Kal</th>
            <th>Prot (g)</th>
            <th>Karbo (g)</th>
            <th>Lemak (g)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <button class="json-toggle" onclick="toggleJson('${jsonId}')">{ } Lihat JSON Payload</button>
    <div class="json-panel" id="${jsonId}">
      <pre>${JSON.stringify(payload, null, 2)}</pre>
    </div>
  </div>`;

  // ── Run Smart AI Recommender after meal card is rendered ─────────────────────
  const goalsBar = document.getElementById("rec-goals-bar");
  if (goalsBar) goalsBar.style.display = "block";

  if (typeof runRecommender === "function" && typeof renderRecommenderCard === "function") {
    const goals = _readGoalInputs();
    const result = runRecommender(payload, goals);
    renderRecommenderCard(result);
  }
}

// ── Read daily goal inputs from the goals config bar ─────────────────────────
function _readGoalInputs() {
  const calEl  = document.getElementById("goalCalories");
  const protEl = document.getElementById("goalProtein");
  return {
    calories: calEl  ? (parseInt(calEl.value,  10) || 2000) : 2000,
    protein:  protEl ? (parseInt(protEl.value, 10) || 120)  : 120,
  };
}

// ── Toggle JSON panel visibility ──────────────────────────────────────────────
function toggleJson(id) {
  const el  = document.getElementById(id);
  el.classList.toggle("open");
  el.previousElementSibling.textContent =
    el.classList.contains("open") ? "{ } Tutup JSON Payload" : "{ } Lihat JSON Payload";
}

// ── Guess meal name from current hour ─────────────────────────────────────────
function guessMealName() {
  const h = new Date().getHours();
  if (h >= 5  && h < 11) return "Sarapan";
  if (h >= 11 && h < 15) return "Makan Siang";
  if (h >= 15 && h < 18) return "Snack Sore";
  return "Makan Malam";
}
