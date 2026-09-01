import { supabase } from "./supabase.js";


/* =========================================================
   JSTAROMA TECH
   PUBLIC PROJECTS
========================================================= */


/* =========================================================
   STATE
========================================================= */

let allProjects = [];

let currentFilter = "All";

let lastFocusedElement = null;



/* =========================================================
   PROJECT SECTION ELEMENTS
========================================================= */

const projectsGrid =
  document.getElementById(
    "projectsGrid"
  );


const projectsStatus =
  document.getElementById(
    "projectsStatus"
  );


const projectFilters =
  document.getElementById(
    "projectFilters"
  );



/* =========================================================
   EXISTING HTML MODAL ELEMENTS
========================================================= */

const projectModal =
  document.getElementById(
    "projectModal"
  );


const projectModalBackdrop =
  document.getElementById(
    "projectModalBackdrop"
  );


const projectModalClose =
  document.getElementById(
    "projectModalClose"
  );


const projectModalImage =
  document.getElementById(
    "projectModalImage"
  );


const projectModalPlaceholder =
  document.getElementById(
    "projectModalPlaceholder"
  );


const projectModalCategory =
  document.getElementById(
    "projectModalCategory"
  );


const projectModalTitle =
  document.getElementById(
    "projectModalTitle"
  );


const projectModalDescription =
  document.getElementById(
    "projectModalDescription"
  );


const projectModalTools =
  document.getElementById(
    "projectModalTools"
  );


const projectModalLive =
  document.getElementById(
    "projectModalLive"
  );


const projectModalGithub =
  document.getElementById(
    "projectModalGithub"
  );



/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    console.log(
      "JSTAROMA public-projects.js loaded"
    );


    setupFilters();

    setupProjectGrid();

    setupModal();

    await loadProjects();

  }
);



/* =========================================================
   LOAD PROJECTS
========================================================= */

async function loadProjects() {

  if (!projectsGrid) {

    console.error(
      "projectsGrid was not found."
    );

    return;

  }


  showLoading();


  try {

    /*
     * Using select("*") prevents errors if your
     * table uses "tools" instead of "tools_used".
     */

    const {
      data,
      error
    } =
      await supabase
        .from("projects")
        .select("*")
        .eq(
          "published",
          true
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      throw error;

    }


    console.log(
      "Public projects:",
      data
    );


    allProjects =
      Array.isArray(data)
        ? data
        : [];


    renderProjects(
      allProjects
    );

  }

  catch (error) {

    console.error(
      "Public projects error:",
      error
    );


    projectsGrid.innerHTML =
      "";


    showError(
      error.message ||
      "Unable to load projects."
    );

  }

}



/* =========================================================
   RENDER PROJECTS
========================================================= */

function renderProjects(
  projects
) {

  projectsGrid.innerHTML =
    "";


  hideStatus();


  if (
    !projects ||
    projects.length === 0
  ) {

    showEmpty();

    return;

  }


  projects.forEach(
    project => {

      const card =
        createProjectCard(
          project
        );


      projectsGrid.appendChild(
        card
      );

    }
  );

}



/* =========================================================
   CREATE PROJECT CARD
========================================================= */

function createProjectCard(
  project
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "project-card";


  card.dataset.projectId =
    String(
      project.id
    );



  /* =======================================================
     IMAGE
  ======================================================= */

  const imageWrapper =
    document.createElement(
      "div"
    );


  imageWrapper.className =
    "project-card-image-wrapper";


  const imageURL =
    getProjectImage(
      project
    );


  if (imageURL) {

    const image =
      document.createElement(
        "img"
      );


    image.className =
      "project-card-image";


    image.src =
      imageURL;


    image.alt =
      project.title
        ? `${project.title} preview`
        : "Project preview";


    image.loading =
      "lazy";


    image.decoding =
      "async";


    image.addEventListener(
      "error",
      () => {

        renderImageFallback(
          imageWrapper
        );

      },
      {
        once: true
      }
    );


    imageWrapper.appendChild(
      image
    );

  }

  else {

    renderImageFallback(
      imageWrapper
    );

  }



  /* =======================================================
     BODY
  ======================================================= */

  const body =
    document.createElement(
      "div"
    );


  body.className =
    "project-card-body";



  /* =======================================================
     CATEGORY
  ======================================================= */

  const category =
    document.createElement(
      "span"
    );


  category.className =
    "project-card-category";


  category.textContent =
    getCategory(
      project
    );



  /* =======================================================
     TITLE
  ======================================================= */

  const title =
    document.createElement(
      "h3"
    );


  title.className =
    "project-card-title";


  title.textContent =
    project.title?.trim()
    ||
    "Untitled Project";



  /* =======================================================
     DESCRIPTION
  ======================================================= */

  const description =
    document.createElement(
      "p"
    );


  description.className =
    "project-card-description";


  description.textContent =
    project.description?.trim()
    ||
    "View the complete project for more information.";



  /* =======================================================
     TOOLS
  ======================================================= */

  const tools =
    getTools(
      project
    );


  const toolsContainer =
    document.createElement(
      "div"
    );


  toolsContainer.className =
    "project-card-tools";


  tools
    .slice(
      0,
      8
    )
    .forEach(
      tool => {

        const tag =
          document.createElement(
            "span"
          );


        tag.className =
          "project-card-tool";


        tag.textContent =
          tool;


        toolsContainer.appendChild(
          tag
        );

      }
    );



  /* =======================================================
     VIEW FULL PROJECT
  ======================================================= */

  const viewButton =
    document.createElement(
      "button"
    );


  viewButton.type =
    "button";


  viewButton.className =
    "project-view-button";


  viewButton.dataset.projectId =
    String(
      project.id
    );


  viewButton.setAttribute(
    "aria-label",
    `View full project: ${
      project.title ||
      "project"
    }`
  );


  viewButton.innerHTML = `

    <span>
      View full project
    </span>

    <i
      class="fa-solid fa-arrow-right"
      aria-hidden="true"
    ></i>

  `;



  /* =======================================================
     BUILD CARD
  ======================================================= */

  body.appendChild(
    category
  );


  body.appendChild(
    title
  );


  body.appendChild(
    description
  );


  if (
    tools.length > 0
  ) {

    body.appendChild(
      toolsContainer
    );

  }


  body.appendChild(
    viewButton
  );


  card.appendChild(
    imageWrapper
  );


  card.appendChild(
    body
  );


  return card;

}



/* =========================================================
   IMAGE FALLBACK
========================================================= */

function renderImageFallback(
  wrapper
) {

  wrapper.innerHTML = `

    <div class="project-image-fallback">

      <i
        class="fa-regular fa-image"
        aria-hidden="true"
      ></i>

      <span>
        Project Preview
      </span>

    </div>

  `;

}



/* =========================================================
   SETUP PROJECT GRID
========================================================= */

function setupProjectGrid() {

  if (!projectsGrid) {
    return;
  }


  projectsGrid.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".project-view-button"
        );


      if (!button) {
        return;
      }


      const projectID =
        button.dataset.projectId;


      const project =
        allProjects.find(
          item =>
            String(
              item.id
            )
            ===
            String(
              projectID
            )
        );


      if (!project) {

        console.error(
          "Could not find project:",
          projectID
        );

        return;

      }


      lastFocusedElement =
        button;


      openProjectModal(
        project
      );

    }
  );

}



/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

  if (!projectFilters) {
    return;
  }


  projectFilters.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".project-filter"
        );


      if (!button) {
        return;
      }


      currentFilter =
        button.dataset.filter
        ||
        "All";


      projectFilters
        .querySelectorAll(
          ".project-filter"
        )
        .forEach(
          filterButton => {

            filterButton.classList.remove(
              "active"
            );

          }
        );


      button.classList.add(
        "active"
      );


      applyFilter();

    }
  );

}



/* =========================================================
   APPLY FILTER
========================================================= */

function applyFilter() {

  if (
    normalizeText(
      currentFilter
    )
    ===
    "all"
  ) {

    renderProjects(
      allProjects
    );

    return;

  }


  const filtered =
    allProjects.filter(
      project => {

        return (
          normalizeText(
            getCategory(
              project
            )
          )
          ===
          normalizeText(
            currentFilter
          )
        );

      }
    );


  renderProjects(
    filtered
  );

}



/* =========================================================
   OPEN PROJECT MODAL
========================================================= */

function openProjectModal(
  project
) {

  if (!projectModal) {

    console.error(
      "Project modal was not found in HTML."
    );

    return;

  }



  /* CATEGORY */

  if (projectModalCategory) {

    projectModalCategory.textContent =
      getCategory(
        project
      );

  }



  /* TITLE */

  if (projectModalTitle) {

    projectModalTitle.textContent =
      project.title?.trim()
      ||
      "Untitled Project";

  }



  /* DESCRIPTION */

  if (projectModalDescription) {

    projectModalDescription.textContent =
      project.description?.trim()
      ||
      "No description is available for this project.";

  }



  /* IMAGE */

  setModalImage(
    project
  );



  /* TOOLS */

  renderModalTools(
    project
  );



  /* LIVE PROJECT */

  configureLink(
    projectModalLive,

    project.project_url
    ??
    project.live_url
    ??
    project.website_url
  );



  /* GITHUB */

  configureLink(
    projectModalGithub,

    project.github_url
    ??
    project.repository_url
    ??
    project.repo_url
  );



  /* SHOW MODAL */

  projectModal.classList.add(
    "active"
  );


  projectModal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.classList.add(
    "project-modal-open"
  );


  requestAnimationFrame(
    () => {

      projectModalClose?.focus();

    }
  );

}



/* =========================================================
   MODAL IMAGE
========================================================= */

function setModalImage(
  project
) {

  if (
    !projectModalImage ||
    !projectModalPlaceholder
  ) {

    return;

  }


  projectModalImage.onerror =
    null;


  const imageURL =
    getProjectImage(
      project
    );


  if (!imageURL) {

    showModalPlaceholder();

    return;

  }


  projectModalPlaceholder.style.display =
    "none";


  projectModalImage.style.display =
    "block";


  projectModalImage.src =
    imageURL;


  projectModalImage.alt =
    project.title
      ? `${project.title} preview`
      : "Project preview";


  projectModalImage.onerror =
    () => {

      showModalPlaceholder();

    };

}



/* =========================================================
   MODAL IMAGE PLACEHOLDER
========================================================= */

function showModalPlaceholder() {

  if (
    !projectModalImage ||
    !projectModalPlaceholder
  ) {

    return;

  }


  projectModalImage.style.display =
    "none";


  projectModalImage.removeAttribute(
    "src"
  );


  projectModalPlaceholder.style.display =
    "flex";

}



/* =========================================================
   MODAL TOOLS
========================================================= */

function renderModalTools(
  project
) {

  if (!projectModalTools) {
    return;
  }


  projectModalTools.innerHTML =
    "";


  const tools =
    getTools(
      project
    );


  if (
    tools.length === 0
  ) {

    const empty =
      document.createElement(
        "span"
      );


    empty.className =
      "project-modal-tool";


    empty.textContent =
      "No tools listed";


    projectModalTools.appendChild(
      empty
    );


    return;

  }


  tools.forEach(
    tool => {

      const tag =
        document.createElement(
          "span"
        );


      tag.className =
        "project-modal-tool";


      tag.textContent =
        tool;


      projectModalTools.appendChild(
        tag
      );

    }
  );

}



/* =========================================================
   CONFIGURE LIVE / GITHUB LINK
========================================================= */

function configureLink(
  element,
  value
) {

  if (!element) {
    return;
  }


  const url =
    normalizeURL(
      value
    );


  if (!url) {

    element.style.display =
      "none";


    element.removeAttribute(
      "href"
    );


    return;

  }


  element.href =
    url;


  element.target =
    "_blank";


  element.rel =
    "noopener noreferrer";


  element.style.display =
    "inline-flex";

}



/* =========================================================
   CLOSE PROJECT MODAL
========================================================= */

function closeProjectModal() {

  if (!projectModal) {
    return;
  }


  projectModal.classList.remove(
    "active"
  );


  projectModal.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.classList.remove(
    "project-modal-open"
  );


  if (projectModalImage) {

    projectModalImage.onerror =
      null;

  }


  if (
    lastFocusedElement
    &&
    typeof lastFocusedElement.focus
    === "function"
  ) {

    setTimeout(
      () => {

        lastFocusedElement.focus();

      },
      100
    );

  }

}



/* =========================================================
   MODAL EVENTS
========================================================= */

function setupModal() {

  if (!projectModal) {
    return;
  }


  projectModalClose?.addEventListener(
    "click",
    closeProjectModal
  );


  projectModalBackdrop?.addEventListener(
    "click",
    closeProjectModal
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
        &&
        projectModal.classList.contains(
          "active"
        )
      ) {

        closeProjectModal();

      }

    }
  );


  projectModal.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        projectModal
      ) {

        closeProjectModal();

      }

    }
  );

}



/* =========================================================
   GET TOOLS
========================================================= */

function getTools(
  project
) {

  const tools =
    project.tools_used
    ??
    project.tools
    ??
    "";


  return parseTools(
    tools
  );

}



/* =========================================================
   PARSE TOOLS
========================================================= */

function parseTools(
  value
) {

  if (!value) {
    return [];
  }


  if (
    Array.isArray(
      value
    )
  ) {

    return uniqueValues(
      value
        .map(
          item =>
            String(
              item
            ).trim()
        )
        .filter(Boolean)
    );

  }


  if (
    typeof value ===
    "object"
  ) {

    return uniqueValues(

      Object.values(
        value
      )
        .flat()
        .map(
          item =>
            String(
              item
            ).trim()
        )
        .filter(Boolean)

    );

  }


  return uniqueValues(

    String(
      value
    )
      .split(
        /[,;|]+/
      )
      .map(
        item =>
          item.trim()
      )
      .filter(Boolean)

  );

}



/* =========================================================
   UNIQUE VALUES
========================================================= */

function uniqueValues(
  values
) {

  return [
    ...new Set(
      values
    )
  ];

}



/* =========================================================
   CATEGORY
========================================================= */

function getCategory(
  project
) {

  return (
    project.category?.trim()
    ||
    project.project_category?.trim()
    ||
    "Project"
  );

}



/* =========================================================
   IMAGE
========================================================= */

function getProjectImage(
  project
) {

  return normalizeURL(

    project.image_url
    ??
    project.image
    ??
    project.thumbnail_url
    ??
    project.preview_image_url

  );

}



/* =========================================================
   NORMALIZE TEXT
========================================================= */

function normalizeText(
  value
) {

  return String(
    value
    ??
    ""
  )
    .trim()
    .toLowerCase();

}



/* =========================================================
   NORMALIZE URL
========================================================= */

function normalizeURL(
  value
) {

  if (!value) {
    return "";
  }


  const url =
    String(
      value
    ).trim();


  if (!url) {
    return "";
  }



  /* ABSOLUTE URL */

  if (
    url.startsWith(
      "https://"
    )
    ||
    url.startsWith(
      "http://"
    )
  ) {

    return url;

  }



  /* RELATIVE WEBSITE FILE */

  if (
    url.startsWith(
      "/"
    )
    ||
    url.startsWith(
      "./"
    )
    ||
    url.startsWith(
      "../"
    )
    ||
    url.startsWith(
      "images/"
    )
    ||
    url.startsWith(
      "assets/"
    )
  ) {

    return url;

  }



  /* DOMAIN WITHOUT HTTPS */

  return `https://${url}`;

}



/* =========================================================
   LOADING
========================================================= */

function showLoading() {

  if (!projectsStatus) {
    return;
  }


  projectsStatus.style.display =
    "block";


  projectsStatus.innerHTML = `

    <div class="projects-loader">

      <span class="projects-spinner"></span>

      <span>
        Loading projects...
      </span>

    </div>

  `;

}



/* =========================================================
   EMPTY
========================================================= */

function showEmpty() {

  if (!projectsStatus) {
    return;
  }


  projectsStatus.style.display =
    "block";


  projectsStatus.innerHTML = `

    <div class="projects-message">

      <i
        class="fa-regular fa-folder-open"
        aria-hidden="true"
      ></i>

      <h3>
        No projects found
      </h3>

      <p>
        ${
          normalizeText(
            currentFilter
          )
          ===
          "all"

            ?

            "No projects have been published yet."

            :

            `No ${escapeHTML(
              currentFilter
            )} projects are available yet.`
        }
      </p>

    </div>

  `;

}



/* =========================================================
   ERROR
========================================================= */

function showError(
  message
) {

  if (!projectsStatus) {
    return;
  }


  projectsStatus.style.display =
    "block";


  projectsStatus.innerHTML = `

    <div class="projects-message projects-message-error">

      <i
        class="fa-solid fa-triangle-exclamation"
        aria-hidden="true"
      ></i>

      <h3>
        Projects unavailable
      </h3>

      <p>
        ${escapeHTML(
          message
        )}
      </p>

    </div>

  `;

}



/* =========================================================
   HIDE STATUS
========================================================= */

function hideStatus() {

  if (!projectsStatus) {
    return;
  }


  projectsStatus.innerHTML =
    "";


  projectsStatus.style.display =
    "none";

}



/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
  value
) {

  const div =
    document.createElement(
      "div"
    );


  div.textContent =
    value
    ??
    "";


  return div.innerHTML;

}