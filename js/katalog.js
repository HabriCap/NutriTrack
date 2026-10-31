// =============================================================================
// katalog.js — Halaman Katalog Makanan
// Depends on: db.js (DB, FOOD_META, titleCase)
// =============================================================================

// ── Build flat catalogue array from DB ────────────────────────────────────────
// Returns one entry per food item with per-serving macros pre-calculated.
// SWAP POINT: replace this function body with an async Supabase/SQLite fetch
// that maps rows to the same shape — the rest of this file stays unchanged.
function buildCatalogueFromDB() {
  return Object.entries(DB).map(([key, e]) => {
    const factor = e.std / 100;
    const meta   = FOOD_META[key] || ["Lainnya", "semua"];
    return {
      key,
      name:     titleCase(key),
      category: meta[0],   // human-readable label shown on card
      filter:   meta[1],   // matches data-filter on chip buttons
      serving:  `${e.std}${e.unit}`,
      note:     e.note,
      cal:      Math.round(e.cal * factor),
      prot:     +(e.p * factor).toFixed(1),
      carb:     +(e.c * factor).toFixed(1),
      fat:      +(e.f * factor).toFixed(1),
      // Raw per-100g values for "Tinggi Protein" / "Rendah Kalori" predicates
      cal100:  e.cal,
      prot100: e.p,
    };
  });
}

const CATALOGUE = buildCatalogueFromDB();

// ── Reactive UI state ─────────────────────────────────────────────────────────
const katState = {
  query:  "",      // lowercased search string
  filter: "semua", // active chip data-filter value
};

// ── Special cross-category filter predicates ──────────────────────────────────
// Add more here to support future dynamic filters without touching HTML/CSS.
const SPECIAL_FILTERS = {
  "tinggi-protein": item => item.prot100 >= 20,   // ≥20g protein per 100g
  "rendah-kalori":  item => item.cal    <  100,   // <100 kcal per serving
};

// ── Filter + search logic ─────────────────────────────────────────────────────
function applyFilters(items, query, filter) {
  return items.filter(item => {
    // Text search: name OR category must contain the query string
    const matchesQuery =
      query === "" ||
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);

    // Category filter: either a special predicate or a direct tag match
    let matchesFilter = true;
    if (filter !== "semua") {
      matchesFilter = SPECIAL_FILTERS[filter]
        ? SPECIAL_FILTERS[filter](item)
        : item.filter === filter;
    }

    return matchesQuery && matchesFilter;
  });
}

// ── Render the food grid ──────────────────────────────────────────────────────
function renderKatalog() {
  const results = applyFilters(CATALOGUE, katState.query, katState.filter);

  // Update results count
  document.getElementById("katMeta").innerHTML =
    `Menampilkan <strong>${results.length}</strong> dari ${CATALOGUE.length} item`;

  const grid = document.getElementById("katGrid");

  if (!results.length) {
    grid.innerHTML = `
      <div class="kat-empty">
        <div class="icon">🔍</div>
        <p>Tidak ada makanan yang cocok dengan pencarian atau filter ini.</p>
      </div>`;
    return;
  }

  // Each card renders: name, calorie badge, category tag, note, macro cells
  grid.innerHTML = results.map(item => `
    <div class="food-card" onclick="openModal('${item.key}')">
      <div class="food-card-header">
        <span class="food-card-name">
          ${item.name}${item.custom ? '<span class="food-card-custom-badge">⭐ Kustom</span>' : ""}
        </span>
        <span class="food-card-badge">🔥 ${item.cal} kcal</span>
      </div>
      <div class="food-card-body">
        <span class="food-cat-tag">${item.category}</span>
        <p class="food-card-note">${item.note}</p>
        <div class="food-macro-row">
          <div class="food-macro-cell">
            <div class="food-macro-val prot">${item.prot}g</div>
            <div class="food-macro-lbl">Protein</div>
          </div>
          <div class="food-macro-cell">
            <div class="food-macro-val carb">${item.carb}g</div>
            <div class="food-macro-lbl">Karbo</div>
          </div>
          <div class="food-macro-cell">
            <div class="food-macro-val fat">${item.fat}g</div>
            <div class="food-macro-lbl">Lemak</div>
          </div>
        </div>
      </div>
    </div>`).join("");
}

// ── Search input handler (debounced 180 ms) ───────────────────────────────────
let _searchTimer = null;

function initKatalogSearch() {
  document.getElementById("katSearch").addEventListener("input", e => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      katState.query = e.target.value.trim().toLowerCase();
      renderKatalog();
    }, 180);
  });
}

// ── Filter chip toggle ────────────────────────────────────────────────────────
function setFilter(btn) {
  document.querySelectorAll(".kat-chip").forEach(c => c.classList.remove("active"));
  btn.classList.add("active");
  katState.filter = btn.dataset.filter;
  renderKatalog();
}

// ── Detail modal: open ────────────────────────────────────────────────────────
function openModal(key) {
  const item = CATALOGUE.find(i => i.key === key);
  if (!item) return;

  document.getElementById("modalTitle").textContent = item.name;
  document.getElementById("modalBody").innerHTML = `
    <div class="kat-modal-row">
      <span class="kat-modal-key">Kategori</span>
      <span class="kat-modal-val">${item.category}</span>
    </div>
    <div class="kat-modal-row">
      <span class="kat-modal-key">Porsi standar</span>
      <span class="kat-modal-val">${item.serving}</span>
    </div>
    <div class="kat-modal-row">
      <span class="kat-modal-key">Catatan</span>
      <span class="kat-modal-val" style="max-width:220px;text-align:right">${item.note}</span>
    </div>
    <div class="kat-modal-row">
      <span class="kat-modal-key">Kalori</span>
      <span class="kat-modal-val" style="color:var(--clr-tertiary)">${item.cal} kcal</span>
    </div>
    <div class="kat-modal-row">
      <span class="kat-modal-key">Protein</span>
      <span class="kat-modal-val" style="color:var(--clr-protein)">${item.prot} g</span>
    </div>
    <div class="kat-modal-row">
      <span class="kat-modal-key">Karbohidrat</span>
      <span class="kat-modal-val" style="color:var(--clr-carbs)">${item.carb} g</span>
    </div>
    <div class="kat-modal-row">
      <span class="kat-modal-key">Lemak</span>
      <span class="kat-modal-val" style="color:var(--clr-fats)">${item.fat} g</span>
    </div>
    <button class="kat-add-btn" onclick="addToOrder('${key}')">+ Tambah ke Pesanan</button>
    ${item.custom ? `<button class="kat-delete-btn" onclick="deleteCustomFood('${key}')">🗑 Hapus dari Katalog</button>` : ""}`;

  document.getElementById("katModal").classList.add("open");
}

// ── Detail modal: close ───────────────────────────────────────────────────────
// closeModal handles backdrop click; closeModalDirect handles ✕ button.
function closeModal(e) {
  if (e.target === document.getElementById("katModal")) closeModalDirect();
}

function closeModalDirect() {
  document.getElementById("katModal").classList.remove("open");
}

// ── Bridge: add item from katalog directly into the analisis tab ──────────────
function addToOrder(key) {
  closeModalDirect();
  const current = document.getElementById("orderInput").value.trim();
  document.getElementById("orderInput").value =
    current ? `${current}, ${key}` : key;
  // Switch to analisis tab and re-run analysis
  switchPage("analisis", document.querySelectorAll(".nav-tab")[0]);
  analyzeOrder();
}

// =============================================================================
// TAMBAH MAKANAN — Custom food management
// Storage: localStorage key "nutritrack_custom_foods" (JSON array)
// Schema per item mirrors CATALOGUE entries, plus { custom: true }
// =============================================================================

const CUSTOM_STORAGE_KEY = "nutritrack_custom_foods";

// Category label map: filter-tag → display label
const CATEGORY_LABELS = {
  "karbohidrat":    "Karbohidrat",
  "protein-hewani": "Protein Hewani",
  "protein-nabati": "Protein Nabati",
  "sayuran":        "Sayuran",
  "pelengkap":      "Pelengkap",
  "minuman":        "Minuman",
  "kustom":         "Kustom",
};

// ── Load custom foods from localStorage into CATALOGUE ────────────────────────
function loadCustomFoods() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) || "[]"); }
  catch { saved = []; }
  // Remove stale entries that may already be in CATALOGUE
  saved.forEach(item => {
    if (!CATALOGUE.find(c => c.key === item.key)) {
      CATALOGUE.push(item);
    }
  });
}

// ── Persist custom foods to localStorage ──────────────────────────────────────
function _saveCustomFoods() {
  const customs = CATALOGUE.filter(c => c.custom);
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customs));
}

// ── Open add-food modal & reset form ─────────────────────────────────────────
function openAddFoodModal() {
  // Reset all fields
  ["af-name", "af-note"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  ["af-cal", "af-prot", "af-carb", "af-fat"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const serv = document.getElementById("af-serving");
  if (serv) serv.value = "100";
  const unit = document.getElementById("af-unit");
  if (unit) unit.value = "g";
  const cat = document.getElementById("af-category");
  if (cat) cat.value = "protein-hewani";

  // Clear errors & highlight
  document.querySelectorAll(".af-input").forEach(el => el.classList.remove("af-err"));
  const err = document.getElementById("af-error");
  if (err) err.textContent = "";

  document.getElementById("addFoodModal").classList.add("open");
  // Focus name input
  setTimeout(() => document.getElementById("af-name")?.focus(), 80);
}

function closeAddFoodModal(e) {
  if (e.target === document.getElementById("addFoodModal")) closeAddFoodModalDirect();
}

function closeAddFoodModalDirect() {
  document.getElementById("addFoodModal").classList.remove("open");
}

// ── Validate + submit custom food ─────────────────────────────────────────────
function submitCustomFood() {
  // Clear previous errors
  document.querySelectorAll(".af-input").forEach(el => el.classList.remove("af-err"));
  const errEl = document.getElementById("af-error");
  errEl.textContent = "";

  // Read values
  const name    = (document.getElementById("af-name").value   || "").trim();
  const catTag  = document.getElementById("af-category").value;
  const serving = parseInt(document.getElementById("af-serving").value, 10);
  const unit    = document.getElementById("af-unit").value;
  const note    = (document.getElementById("af-note").value || "").trim();
  const cal     = parseFloat(document.getElementById("af-cal").value);
  const prot    = parseFloat(document.getElementById("af-prot").value);
  const carb    = parseFloat(document.getElementById("af-carb").value  || "0");
  const fat     = parseFloat(document.getElementById("af-fat").value   || "0");

  // Validation
  const errors = [];
  if (!name) {
    errors.push("Nama makanan wajib diisi.");
    document.getElementById("af-name").classList.add("af-err");
  }
  if (isNaN(serving) || serving < 1) {
    errors.push("Porsi standar harus angka positif.");
    document.getElementById("af-serving").classList.add("af-err");
  }
  if (isNaN(cal) || cal < 0) {
    errors.push("Kalori wajib diisi (angka ≥ 0).");
    document.getElementById("af-cal").classList.add("af-err");
  }
  if (isNaN(prot) || prot < 0) {
    errors.push("Protein wajib diisi (angka ≥ 0).");
    document.getElementById("af-prot").classList.add("af-err");
  }

  if (errors.length) {
    errEl.textContent = errors[0];
    return;
  }

  // Generate unique key: slugify name + timestamp suffix
  const key = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") +
              "-" + Date.now().toString(36);

  // Build catalogue entry
  const entry = {
    key,
    name:     titleCase(name),
    category: CATEGORY_LABELS[catTag] || "Kustom",
    filter:   catTag,
    serving:  `${serving}${unit}`,
    note:     note || `${serving}${unit} per porsi`,
    cal:      Math.round(cal),
    prot:     +prot.toFixed(1),
    carb:     +carb.toFixed(1),
    fat:      +fat.toFixed(1),
    // Back-compute per-100g values for special filter predicates
    cal100:   +((cal  / serving) * 100).toFixed(1),
    prot100:  +((prot / serving) * 100).toFixed(1),
    custom:   true,
  };

  // Push to live CATALOGUE and persist
  CATALOGUE.push(entry);
  _saveCustomFoods();

  // Also register in PRICE_DB with 0 so recommender doesn't crash
  if (typeof PRICE_DB !== "undefined") PRICE_DB[key] = 0;

  // Close modal and re-render grid, jumping to "kustom" filter
  closeAddFoodModalDirect();

  // Switch filter chip to "Kustom" so user sees their new item
  const kustomChip = document.querySelector('.kat-chip[data-filter="kustom"]');
  if (kustomChip) setFilter(kustomChip);
  else renderKatalog();
}

// ── Delete custom food from detail modal ──────────────────────────────────────
function deleteCustomFood(key) {
  const idx = CATALOGUE.findIndex(c => c.key === key);
  if (idx !== -1) CATALOGUE.splice(idx, 1);
  _saveCustomFoods();
  closeModalDirect();
  renderKatalog();
}

