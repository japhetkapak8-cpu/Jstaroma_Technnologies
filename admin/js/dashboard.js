import { supabase }
from "../../js/supabase.js";


import {
  requireAdmin,
  logoutAdmin
}
from "./admin-auth.js";

import { loadPublicationStats }
from "./content-data.js";


// ========================================
// LOAD STATS
// ========================================

async function loadStats() {
  await Promise.all([
    loadSectionStats("projects", "Projects"),
    loadSectionStats("achievements", "Achievements"),
    loadSectionStats("products", "Products")
  ]);
}

async function loadSectionStats(table, suffix) {
  const totalElement = document.getElementById(`total${suffix}`);
  const publishedElement = document.getElementById(`published${suffix}`);
  const draftElement = document.getElementById(`draft${suffix}`);
  const statusElement = document.getElementById(`${table}StatsStatus`);
  const elements = [totalElement, publishedElement, draftElement];

  elements.forEach(element => {
    element.textContent = "...";
  });
  statusElement.hidden = true;

  try {
    const stats = await loadPublicationStats(supabase, table);

    totalElement.textContent = String(stats.total);
    publishedElement.textContent = String(stats.published);
    draftElement.textContent = String(stats.drafts);
  }
  catch (error) {
    console.error(`Could not load ${table} stats:`, error);
    elements.forEach(element => {
      element.textContent = "Error";
    });
    statusElement.textContent = `Could not load ${table} counts. Please reload to try again.`;
    statusElement.hidden = false;
  }
}


// ========================================
// LOGOUT
// ========================================

document.getElementById(
  "logoutBtn"
)
?.addEventListener(
  "click",
  logoutAdmin
);


// ========================================
// INITIALIZE
// ========================================

async function init() {

  const user =
    await requireAdmin();


  if (
    !user
  ) {

    return;

  }


  await loadStats();

}


init();