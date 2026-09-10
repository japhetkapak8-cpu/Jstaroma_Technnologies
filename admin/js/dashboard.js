import { supabase }
from "../../js/supabase.js";


import {
  requireAdmin,
  logoutAdmin
}
from "./admin-auth.js";


// ========================================
// LOAD STATS
// ========================================

async function loadStats() {

  const {
    data,
    error
  } =
    await supabase
      .from("projects")
      .select(
        "id, published"
      );


  if (error) {

    console.error(
      "Could not load project stats:",
      error
    );

    return;
  }


  const projects =
    data || [];


  const totalElement =
    document.getElementById(
      "totalProjects"
    );


  const publishedElement =
    document.getElementById(
      "publishedProjects"
    );


  const draftElement =
    document.getElementById(
      "draftProjects"
    );


  if (
    totalElement
  ) {

    totalElement.textContent =
      String(
        projects.length
      );

  }


  if (
    publishedElement
  ) {

    publishedElement.textContent =
      String(
        projects.filter(
          project =>
            project.published ===
            true
        ).length
      );

  }


  if (
    draftElement
  ) {

    draftElement.textContent =
      String(
        projects.filter(
          project =>
            project.published !==
            true
        ).length
      );

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