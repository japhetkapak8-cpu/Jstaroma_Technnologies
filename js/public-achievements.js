import { supabase }
from "./supabase.js";


let achievements = [];
let activeFilter = "All";


/* =========================================================
   ELEMENTS
========================================================= */

const grid =
  document.getElementById(
    "achievementsGrid"
  );


const statusElement =
  document.getElementById(
    "achievementsStatus"
  );


const filters =
  document.querySelectorAll(
    ".achievement-filter"
  );


/* =========================================================
   MODAL ELEMENTS
========================================================= */

const modal =
  document.getElementById(
    "achievementModal"
  );


const modalBackdrop =
  document.getElementById(
    "achievementModalBackdrop"
  );


const modalClose =
  document.getElementById(
    "achievementModalClose"
  );


const modalImage =
  document.getElementById(
    "achievementModalImage"
  );


const modalPlaceholder =
  document.getElementById(
    "achievementModalPlaceholder"
  );


const modalType =
  document.getElementById(
    "achievementModalType"
  );


const modalTitle =
  document.getElementById(
    "achievementModalTitle"
  );


const modalOrganization =
  document.getElementById(
    "achievementModalOrganization"
  );


const modalDate =
  document.getElementById(
    "achievementModalDate"
  );


const modalDescription =
  document.getElementById(
    "achievementModalDescription"
  );


const modalTags =
  document.getElementById(
    "achievementModalTags"
  );


const modalCredential =
  document.getElementById(
    "achievementModalCredential"
  );


const modalAttachment =
  document.getElementById(
    "achievementModalAttachment"
  );


/* =========================================================
   LOAD PUBLISHED ACHIEVEMENTS
========================================================= */

async function loadAchievements() {


  setStatus(
    "Loading achievements..."
  );


  const {

    data,
    error

  } =
    await supabase
      .from("achievements")
      .select("*")
      .eq(
        "published",
        true
      )
      .order(
        "featured",
        {
          ascending: false
        }
      )
      .order(
        "issue_date",
        {
          ascending: false,
          nullsFirst: false
        }
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {


    console.error(
      "Could not load achievements:",
      error
    );


    setStatus(
      error.message ||
      "Achievements could not be loaded."
    );


    return;

  }


  achievements =
    data || [];


  renderAchievements();

}


/* =========================================================
   RENDER
========================================================= */

function renderAchievements() {


  if (!grid) {

    return;

  }


  grid.innerHTML = "";


  const filtered =
    activeFilter === "All"
      ? achievements
      : achievements.filter(
          item =>
            item.type === activeFilter
        );


  if (
    filtered.length === 0
  ) {


    setStatus(
      activeFilter === "All"
        ? "No achievements have been published yet."
        : `No ${activeFilter.toLowerCase()} items have been published yet.`
    );


    return;

  }


  hideStatus();


  filtered.forEach(
    achievement => {


      const card =
        createAchievementCard(
          achievement
        );


      grid.appendChild(
        card
      );

    }
  );

}


/* =========================================================
   CREATE CARD
========================================================= */

function createAchievementCard(
  achievement
) {


  const card =
    document.createElement(
      "article"
    );


  card.className =
    "achievement-card";


  /* IMAGE */

  const imageWrapper =
    document.createElement(
      "div"
    );


  imageWrapper.className =
    "achievement-card-image-wrapper";


  if (
    achievement.image_url
  ) {


    const image =
      document.createElement(
        "img"
      );


    image.className =
      "achievement-card-image";


    image.src =
      achievement.image_url;


    image.alt =
      achievement.title ||
      "Achievement";


    image.loading =
      "lazy";


    image.onerror =
      () => {


        createImageFallback(
          imageWrapper,
          achievement.type
        );

      };


    imageWrapper.appendChild(
      image
    );


  }

  else {


    createImageFallback(
      imageWrapper,
      achievement.type
    );

  }


  /* BODY */

  const body =
    document.createElement(
      "div"
    );


  body.className =
    "achievement-card-body";


  const type =
    document.createElement(
      "span"
    );


  type.className =
    "achievement-card-type";


  type.textContent =
    achievement.type ||
    "Achievement";


  const title =
    document.createElement(
      "h3"
    );


  title.className =
    "achievement-card-title";


  title.textContent =
    achievement.title ||
    "Achievement";


  const organization =
    document.createElement(
      "p"
    );


  organization.className =
    "achievement-card-organization";


  organization.textContent =
    achievement.organization ||
    "";


  const date =
    document.createElement(
      "p"
    );


  date.className =
    "achievement-card-date";


  date.textContent =
    formatDate(
      achievement.issue_date
    );


  const description =
    document.createElement(
      "p"
    );


  description.className =
    "achievement-card-description";


  description.textContent =
    achievement.description ||
    "";


  const tags =
    document.createElement(
      "div"
    );


  tags.className =
    "achievement-card-tags";


  (
    achievement.tags ||
    []
  )
    .slice(
      0,
      5
    )
    .forEach(
      tag => {


        const span =
          document.createElement(
            "span"
          );


        span.className =
          "achievement-card-tag";


        span.textContent =
          tag;


        tags.appendChild(
          span
        );

      }
    );


  const viewButton =
    document.createElement(
      "button"
    );


  viewButton.type =
    "button";


  viewButton.className =
    "achievement-view-button";


  viewButton.innerHTML =
    `
      View Details
      <i class="fa-solid fa-arrow-right"></i>
    `;


  viewButton.addEventListener(
    "click",
    () => {


      openAchievementModal(
        achievement
      );

    }
  );


  body.appendChild(
    type
  );


  body.appendChild(
    title
  );


  if (
    achievement.organization
  ) {

    body.appendChild(
      organization
    );

  }


  if (
    achievement.issue_date
  ) {

    body.appendChild(
      date
    );

  }


  if (
    achievement.description
  ) {

    body.appendChild(
      description
    );

  }


  if (
    achievement.tags &&
    achievement.tags.length > 0
  ) {

    body.appendChild(
      tags
    );

  }


  body.appendChild(
    viewButton
  );


  card.append(
    imageWrapper,
    body
  );


  return card;

}


/* =========================================================
   IMAGE FALLBACK
========================================================= */

function createImageFallback(
  wrapper,
  type
) {


  wrapper.innerHTML = "";


  const fallback =
    document.createElement(
      "div"
    );


  fallback.className =
    "achievement-image-fallback";


  const icon =
    document.createElement(
      "i"
    );


  icon.className =
    getIcon(
      type
    );


  const label =
    document.createElement(
      "span"
    );


  label.textContent =
    type ||
    "Achievement";


  fallback.append(
    icon,
    label
  );


  wrapper.appendChild(
    fallback
  );

}


/* =========================================================
   ICONS
========================================================= */

function getIcon(
  type
) {


  switch (
    type
  ) {


    case "Certification":

      return "fa-solid fa-certificate";


    case "Award":

      return "fa-solid fa-trophy";


    case "Training":

      return "fa-solid fa-graduation-cap";


    case "Achievement":

      return "fa-solid fa-award";


    default:

      return "fa-solid fa-star";

  }

}


/* =========================================================
   FILTERS
========================================================= */

filters.forEach(
  button => {


    button.addEventListener(
      "click",
      () => {


        filters.forEach(
          item => {


            item.classList.remove(
              "active"
            );

          }
        );


        button.classList.add(
          "active"
        );


        activeFilter =
          button.dataset.filter ||
          "All";


        renderAchievements();

      }
    );

  }
);


/* =========================================================
   OPEN MODAL
========================================================= */

function openAchievementModal(
  achievement
) {


  if (!modal) {

    return;

  }


  if (modalType) {

    modalType.textContent =
      achievement.type ||
      "Achievement";

  }


  if (modalTitle) {

    modalTitle.textContent =
      achievement.title ||
      "Achievement";

  }


  if (modalOrganization) {

    modalOrganization.textContent =
      achievement.organization ||
      "";

  }


  if (modalDate) {

    modalDate.textContent =
      formatDate(
        achievement.issue_date
      );

  }


  if (modalDescription) {

    modalDescription.textContent =
      achievement.description ||
      "";

  }


  /* IMAGE */

  if (
    achievement.image_url &&
    modalImage &&
    modalPlaceholder
  ) {


    modalImage.src =
      achievement.image_url;


    modalImage.alt =
      achievement.title ||
      "Achievement";


    modalImage.style.display =
      "block";


    modalPlaceholder.style.display =
      "none";


    modalImage.onerror =
      () => {


        modalImage.style.display =
          "none";


        modalPlaceholder.style.display =
          "flex";

      };


  }

  else if (
    modalImage &&
    modalPlaceholder
  ) {


    modalImage.removeAttribute(
      "src"
    );


    modalImage.style.display =
      "none";


    modalPlaceholder.style.display =
      "flex";

  }


  /* TAGS */

  if (modalTags) {


    modalTags.innerHTML = "";


    (
      achievement.tags ||
      []
    ).forEach(
      tag => {


        const span =
          document.createElement(
            "span"
          );


        span.textContent =
          tag;


        modalTags.appendChild(
          span
        );

      }
    );

  }


  /* CREDENTIAL BUTTON */

  if (modalCredential) {


    if (
      achievement.credential_url
    ) {


      modalCredential.href =
        achievement.credential_url;


      modalCredential.style.display =
        "inline-flex";


    }

    else {


      modalCredential.style.display =
        "none";

    }

  }


  /* ATTACHMENT BUTTON */

  if (modalAttachment) {


    if (
      achievement.attachment_url
    ) {


      modalAttachment.href =
        achievement.attachment_url;


      modalAttachment.style.display =
        "inline-flex";


    }

    else {


      modalAttachment.style.display =
        "none";

    }

  }


  modal.classList.add(
    "active"
  );


  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeAchievementModal() {


  if (!modal) {

    return;

  }


  modal.classList.remove(
    "active"
  );


  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.style.overflow =
    "";

}


/* =========================================================
   MODAL EVENTS
========================================================= */

modalClose?.addEventListener(
  "click",
  closeAchievementModal
);


modalBackdrop?.addEventListener(
  "click",
  closeAchievementModal
);


document.addEventListener(
  "keydown",
  event => {


    if (
      event.key === "Escape"
    ) {

      closeAchievementModal();

    }

  }
);


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(
  value
) {


  if (!value) {

    return "";

  }


  const date =
    new Date(
      `${value}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  return date.toLocaleDateString(
    undefined,
    {

      year:
        "numeric",

      month:
        "long"

    }
  );

}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  text
) {


  if (!statusElement) {

    return;

  }


  statusElement.style.display =
    "block";


  statusElement.textContent =
    text;

}


function hideStatus() {


  if (!statusElement) {

    return;

  }


  statusElement.style.display =
    "none";

}


/* =========================================================
   START
========================================================= */

loadAchievements();