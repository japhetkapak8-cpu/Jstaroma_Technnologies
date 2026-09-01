import { supabase }
from "../../js/supabase.js";


async function requireAdmin() {

  const {
    data: {
      session
    }
  } =
    await supabase.auth
      .getSession();


  if (!session) {

    window.location.replace(
      "index.html"
    );

    return false;
  }


  const {
    data: admin
  } =
    await supabase
      .from("admins")
      .select("user_id")
      .eq(
        "user_id",
        session.user.id
      )
      .maybeSingle();


  if (!admin) {

    await supabase.auth
      .signOut();


    window.location.replace(
      "index.html"
    );

    return false;
  }


  return true;

}


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
      error
    );

    return;
  }


  const projects =
    data || [];


  document.getElementById(
    "totalProjects"
  ).textContent =
    projects.length;


  document.getElementById(
    "publishedProjects"
  ).textContent =
    projects.filter(
      project =>
        project.published
    ).length;


  document.getElementById(
    "draftProjects"
  ).textContent =
    projects.filter(
      project =>
        !project.published
    ).length;

}


document.getElementById(
  "logoutBtn"
)
.addEventListener(
  "click",
  async () => {

    await supabase.auth
      .signOut();


    window.location.replace(
      "index.html"
    );

  }
);


async function init() {

  const authorized =
    await requireAdmin();


  if (!authorized) {
    return;
  }


  await loadStats();

}


init();