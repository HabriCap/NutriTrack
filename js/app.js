// =============================================================================
// app.js — App bootstrap and page navigation
// Depends on: db.js, analisis.js, katalog.js
// =============================================================================

// ── Page / tab switcher ───────────────────────────────────────────────────────
// Called by nav-tab onclick attributes in index.html.
function switchPage(pageId, tabEl) {
  // Hide all pages, show the target
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${pageId}`).classList.add("active");

  // Update active tab indicator
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  tabEl.classList.add("active");

  // Lazy-render katalog grid only when the tab is first opened
  if (pageId === "katalog") renderKatalog();
}

// ── DOMContentLoaded bootstrap ────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  // Load persisted custom foods into CATALOGUE before first render
  if (typeof loadCustomFoods === "function") loadCustomFoods();

  // Analisis: prefill and run the first example on load
  document.getElementById("orderInput").value = EXAMPLES[0];
  analyzeOrder();

  // Katalog: pre-build grid in background so first visit is instant
  renderKatalog();

  // Attach debounced search listener
  initKatalogSearch();

  // Re-run recommender when daily goals are changed by the user
  ["goalCalories", "goalProtein"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => analyzeOrder());
  });
});
