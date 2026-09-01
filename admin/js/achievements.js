import { supabase }
from "../../js/supabase.js";


/* =========================================================
   CONFIGURATION
========================================================= */

const ACHIEVEMENT_BUCKET =
  "achievement-files";


const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;


const MAX_DOCUMENT_SIZE =
  25 * 1024 * 1024;



/* =========================================================
   STATE
========================================================= */

let achievements = [];

let filteredAchievements = [];



/* =========================================================
   PAGE ELEMENTS
========================================================= */

const grid =
  document.getElementById(
    "achievementAdminGrid"
  );


const statusElement =
  document.getElementById(
    "achievementStatus"
  );


const searchInput =
  document.getElementById(
    "achievementSearch"
  );


const typeFilter =
  document.getElementById(
    "achievementTypeFilter"
  );



/* =========================================================
   STATS
========================================================= */

const totalElement =
  document.getElementById(
    "achievementTotal"
  );


const publishedElement =
  document.getElementById(
    "achievementPublishedCount"
  );


const draftsElement =
  document.getElementById(
    "achievementDrafts"
  );



/* =========================================================
   MODAL
========================================================= */

const modal =
  document.getElementById(
    "achievementFormModal"
  );


const backdrop =
  document.getElementById(
    "achievementFormBackdrop"
  );


const openFormBtn =
  document.getElementById(
    "openAchievementFormBtn"
  );


const closeFormBtn =
  document.getElementById(
    "closeAchievementFormBtn"
  );


const cancelBtn =
  document.getElementById(
    "cancelAchievementBtn"
  );



/* =========================================================
   FORM
========================================================= */

const form =
  document.getElementById(
    "achievementForm"
  );


const formTitle =
  document.getElementById(
    "achievementFormTitle"
  );


const message =
  document.getElementById(
    "achievementFormMessage"
  );


const saveBtn =
  document.getElementById(
    "saveAchievementBtn"
  );


const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );



/* =========================================================
   FORM FIELDS
========================================================= */

const achievementId =
  document.getElementById(
    "achievementId"
  );


const achievementType =
  document.getElementById(
    "achievementType"
  );


const achievementTitle =
  document.getElementById(
    "achievementTitle"
  );


const achievementOrganization =
  document.getElementById(
    "achievementOrganization"
  );


const achievementDate =
  document.getElementById(
    "achievementDate"
  );


const credentialId =
  document.getElementById(
    "credentialId"
  );


const credentialUrl =
  document.getElementById(
    "credentialUrl"
  );


const achievementDescription =
  document.getElementById(
    "achievementDescription"
  );


const achievementTags =
  document.getElementById(
    "achievementTags"
  );


const achievementFeatured =
  document.getElementById(
    "achievementFeatured"
  );


const achievementPublishedInput =
  document.getElementById(
    "achievementPublishedInput"
  );



/* =========================================================
   FILE ELEMENTS
========================================================= */

const achievementImageFile =
  document.getElementById(
    "achievementImageFile"
  );


const achievementDocumentFile =
  document.getElementById(
    "achievementDocumentFile"
  );


const achievementImagePreview =
  document.getElementById(
    "achievementImagePreview"
  );


const achievementDocumentPreview =
  document.getElementById(
    "achievementDocumentPreview"
  );


const achievementImageUrl =
  document.getElementById(
    "achievementImageUrl"
  );


const achievementAttachmentUrl =
  document.getElementById(
    "achievementAttachmentUrl"
  );



/* =========================================================
   AUTHENTICATION
========================================================= */

async function requireAdmin() {


  try {


    const {

      data: {
        session
      },

      error

    } =
      await supabase.auth
        .getSession();



    if (
      error ||
      !session?.user
    ) {


      window.location.replace(
        "index.html"
      );


      return false;

    }


    return true;


  }

  catch (
    error
  ) {


    console.error(
      "Authentication error:",
      error
    );


    window.location.replace(
      "index.html"
    );


    return false;

  }

}



/* =========================================================
   LOAD ACHIEVEMENTS
========================================================= */

async function loadAchievements() {


  setStatus(
    "Loading achievements..."
  );


  if (
    grid
  ) {

    grid.innerHTML =
      "";

  }



  try {


    const {

      data,

      error

    } =
      await supabase
        .from(
          "achievements"
        )
        .select("*")
        .order(
          "featured",
          {
            ascending:
              false
          }
        )
        .order(
          "issue_date",
          {
            ascending:
              false,

            nullsFirst:
              false
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );



    if (
      error
    ) {

      throw error;

    }



    achievements =
      data || [];


    updateStats();

    filterAchievements();


  }

  catch (
    error
  ) {


    console.error(
      "Achievement load error:",
      error
    );


    achievements =
      [];


    filteredAchievements =
      [];


    updateStats();


    setStatus(
      error.message ||
      "Could not load achievements."
    );

  }

}



/* =========================================================
   FILTER ACHIEVEMENTS
========================================================= */

function filterAchievements() {


  const search =
    (
      searchInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();



  const selectedType =
    typeFilter?.value ||
    "All";



  filteredAchievements =
    achievements.filter(
      achievement => {


        const matchesType =

          selectedType ===
            "All"

          ||

          achievement.type ===
            selectedType;



        const searchText =
          [

            achievement.title,

            achievement.organization,

            achievement.description,

            achievement.type,

            achievement.credential_id,

            ...(
              Array.isArray(
                achievement.tags
              )

                ? achievement.tags

                : []
            )

          ]
            .filter(
              Boolean
            )
            .join(
              " "
            )
            .toLowerCase();



        const matchesSearch =

          !search

          ||

          searchText.includes(
            search
          );



        return (
          matchesType &&
          matchesSearch
        );

      }
    );


  renderAchievements();

}



/* =========================================================
   RENDER ACHIEVEMENTS
========================================================= */

function renderAchievements() {


  if (
    !grid
  ) {

    return;

  }



  grid.innerHTML =
    "";



  if (
    filteredAchievements.length ===
    0
  ) {


    setStatus(

      achievements.length ===
      0

        ? "No achievements have been added yet."

        : "No achievements match your search."

    );


    return;

  }



  hideStatus();



  filteredAchievements
    .forEach(
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
   CREATE ACHIEVEMENT CARD
========================================================= */

function createAchievementCard(
  achievement
) {


  const article =
    document.createElement(
      "article"
    );


  article.className =
    "admin-achievement-card";



  /* =======================================================
     IMAGE
  ======================================================= */

  const imageWrapper =
    document.createElement(
      "div"
    );


  imageWrapper.className =
    "admin-achievement-image";



  if (
    achievement.image_url
  ) {


    const image =
      document.createElement(
        "img"
      );


    image.src =
      achievement.image_url;


    image.alt =
      achievement.title ||
      "Achievement";


    image.loading =
      "lazy";


    image.addEventListener(
      "error",
      () => {


        console.error(
          "Achievement image failed:",
          achievement.image_url
        );


        showImageFallback(
          imageWrapper,
          achievement.type
        );

      }
    );


    imageWrapper.appendChild(
      image
    );


  }

  else {


    showImageFallback(
      imageWrapper,
      achievement.type
    );

  }



  /* =======================================================
     CONTENT
  ======================================================= */

  const content =
    document.createElement(
      "div"
    );


  content.className =
    "admin-achievement-content";



  const top =
    document.createElement(
      "div"
    );


  top.className =
    "admin-achievement-top";



  const type =
    document.createElement(
      "span"
    );


  type.className =
    "admin-achievement-type";


  type.textContent =
    achievement.type ||
    "Achievement";



  const publishStatus =
    document.createElement(
      "span"
    );


  publishStatus.className =

    achievement.published

      ? "admin-achievement-status published"

      : "admin-achievement-status draft";


  publishStatus.textContent =

    achievement.published

      ? "Published"

      : "Draft";


  top.append(
    type,
    publishStatus
  );



  const title =
    document.createElement(
      "h3"
    );


  title.textContent =
    achievement.title ||
    "Untitled";



  const organization =
    document.createElement(
      "p"
    );


  organization.className =
    "admin-achievement-organization";


  organization.textContent =
    achievement.organization ||
    "No organization";



  const description =
    document.createElement(
      "p"
    );


  description.className =
    "admin-achievement-description";


  description.textContent =
    achievement.description ||
    "No description provided.";



  content.append(

    top,

    title,

    organization,

    description

  );



  /* =======================================================
     FILE BADGES
  ======================================================= */

  if (

    achievement.image_url

    ||

    achievement.attachment_url

    ||

    achievement.credential_url

  ) {


    const files =
      document.createElement(
        "div"
      );


    files.className =
      "admin-achievement-files";



    if (
      achievement.image_url
    ) {


      const imageBadge =
        document.createElement(
          "span"
        );


      imageBadge.innerHTML =
        `
          <i class="fa-solid fa-image"></i>
          Image
        `;


      files.appendChild(
        imageBadge
      );

    }



    if (
      achievement.attachment_url
    ) {


      const documentBadge =
        document.createElement(
          "span"
        );


      documentBadge.innerHTML =
        `
          <i class="fa-solid fa-file"></i>
          Document
        `;


      files.appendChild(
        documentBadge
      );

    }



    if (
      achievement.credential_url
    ) {


      const credentialBadge =
        document.createElement(
          "span"
        );


      credentialBadge.innerHTML =
        `
          <i class="fa-solid fa-link"></i>
          Credential
        `;


      files.appendChild(
        credentialBadge
      );

    }



    content.appendChild(
      files
    );

  }



  /* =======================================================
     ACTIONS
  ======================================================= */

  const actions =
    document.createElement(
      "div"
    );


  actions.className =
    "admin-achievement-actions";



  /* EDIT */

  const editBtn =
    document.createElement(
      "button"
    );


  editBtn.type =
    "button";


  editBtn.className =
    "edit-achievement-btn";


  editBtn.innerHTML =
    `
      <i class="fa-solid fa-pen"></i>
      Edit
    `;


  editBtn.addEventListener(
    "click",
    () => {


      openEditForm(
        achievement
      );

    }
  );



  /* PUBLISH */

  const publishBtn =
    document.createElement(
      "button"
    );


  publishBtn.type =
    "button";


  publishBtn.className =
    "publish-achievement-btn";


  publishBtn.innerHTML =

    achievement.published

      ? `
          <i class="fa-solid fa-eye-slash"></i>
          Unpublish
        `

      : `
          <i class="fa-solid fa-eye"></i>
          Publish
        `;


  publishBtn.addEventListener(
    "click",
    () => {


      togglePublish(
        achievement
      );

    }
  );



  /* DELETE */

  const deleteBtn =
    document.createElement(
      "button"
    );


  deleteBtn.type =
    "button";


  deleteBtn.className =
    "delete-achievement-btn";


  deleteBtn.title =
    "Delete achievement";


  deleteBtn.innerHTML =
    `
      <i class="fa-solid fa-trash"></i>
    `;


  deleteBtn.addEventListener(
    "click",
    () => {


      deleteAchievement(
        achievement
      );

    }
  );



  actions.append(

    editBtn,

    publishBtn,

    deleteBtn

  );



  article.append(

    imageWrapper,

    content,

    actions

  );


  return article;

}



/* =========================================================
   IMAGE FALLBACK
========================================================= */

function showImageFallback(
  wrapper,
  type
) {


  wrapper.innerHTML =
    "";


  const icon =
    document.createElement(
      "i"
    );


  icon.className =
    getAchievementIcon(
      type
    );


  wrapper.appendChild(
    icon
  );

}



/* =========================================================
   ACHIEVEMENT ICON
========================================================= */

function getAchievementIcon(
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
   STATS
========================================================= */

function updateStats() {


  const total =
    achievements.length;



  const published =
    achievements.filter(
      achievement =>
        achievement.published ===
        true
    ).length;



  const drafts =
    total -
    published;



  if (
    totalElement
  ) {


    totalElement.textContent =
      String(
        total
      );

  }



  if (
    publishedElement
  ) {


    publishedElement.textContent =
      String(
        published
      );

  }



  if (
    draftsElement
  ) {


    draftsElement.textContent =
      String(
        drafts
      );

  }

}



/* =========================================================
   OPEN NEW FORM
========================================================= */

function openNewForm() {


  form?.reset();



  if (
    achievementId
  ) {


    achievementId.value =
      "";

  }



  if (
    achievementImageUrl
  ) {


    achievementImageUrl.value =
      "";

  }



  if (
    achievementAttachmentUrl
  ) {


    achievementAttachmentUrl.value =
      "";

  }



  if (
    achievementImagePreview
  ) {


    achievementImagePreview.innerHTML =
      "";

  }



  if (
    achievementDocumentPreview
  ) {


    achievementDocumentPreview.innerHTML =
      "";

  }



  if (
    achievementImageFile
  ) {


    achievementImageFile.value =
      "";

  }



  if (
    achievementDocumentFile
  ) {


    achievementDocumentFile.value =
      "";

  }



  if (
    formTitle
  ) {


    formTitle.textContent =
      "Add Achievement";

  }



  if (
    achievementPublishedInput
  ) {


    achievementPublishedInput.checked =
      true;

  }



  if (
    achievementFeatured
  ) {


    achievementFeatured.checked =
      false;

  }



  clearMessage();

  openModal();

}



/* =========================================================
   EDIT FORM
========================================================= */

function openEditForm(
  achievement
) {


  if (
    achievementId
  ) {


    achievementId.value =
      achievement.id ||
      "";

  }



  if (
    achievementType
  ) {


    achievementType.value =
      achievement.type ||
      "";

  }



  if (
    achievementTitle
  ) {


    achievementTitle.value =
      achievement.title ||
      "";

  }



  if (
    achievementOrganization
  ) {


    achievementOrganization.value =
      achievement.organization ||
      "";

  }



  if (
    achievementDate
  ) {


    achievementDate.value =
      achievement.issue_date ||
      "";

  }



  if (
    credentialId
  ) {


    credentialId.value =
      achievement.credential_id ||
      "";

  }



  if (
    credentialUrl
  ) {


    credentialUrl.value =
      achievement.credential_url ||
      "";

  }



  if (
    achievementDescription
  ) {


    achievementDescription.value =
      achievement.description ||
      "";

  }



  if (
    achievementTags
  ) {


    achievementTags.value =

      Array.isArray(
        achievement.tags
      )

        ? achievement.tags.join(
            ", "
          )

        : "";

  }



  if (
    achievementFeatured
  ) {


    achievementFeatured.checked =
      Boolean(
        achievement.featured
      );

  }



  if (
    achievementPublishedInput
  ) {


    achievementPublishedInput.checked =
      Boolean(
        achievement.published
      );

  }



  /* EXISTING IMAGE */

  if (
    achievementImageUrl
  ) {


    achievementImageUrl.value =
      achievement.image_url ||
      "";

  }



  if (
    achievementImageFile
  ) {


    achievementImageFile.value =
      "";

  }



  showExistingImagePreview(
    achievement.image_url
  );



  /* EXISTING DOCUMENT */

  if (
    achievementAttachmentUrl
  ) {


    achievementAttachmentUrl.value =
      achievement.attachment_url ||
      "";

  }



  if (
    achievementDocumentFile
  ) {


    achievementDocumentFile.value =
      "";

  }



  showExistingDocumentPreview(
    achievement.attachment_url
  );



  if (
    formTitle
  ) {


    formTitle.textContent =
      "Edit Achievement";

  }



  clearMessage();

  openModal();

}



/* =========================================================
   MODAL
========================================================= */

function openModal() {


  if (
    !modal
  ) {

    return;

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



function closeModal() {


  if (
    !modal
  ) {

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


  clearTemporaryPreviews();

}



/* =========================================================
   IMAGE VALIDATION
========================================================= */

function validateImage(
  file
) {


  if (
    !file
  ) {

    return true;

  }



  const allowedTypes =
    [

      "image/jpeg",

      "image/png",

      "image/webp"

    ];



  if (
    !allowedTypes.includes(
      file.type
    )
  ) {


    showMessage(
      "Please upload a JPG, PNG, or WEBP image.",
      "error"
    );


    return false;

  }



  if (
    file.size >
    MAX_IMAGE_SIZE
  ) {


    showMessage(
      "Image is too large. Maximum image size is 10 MB.",
      "error"
    );


    return false;

  }


  return true;

}



/* =========================================================
   DOCUMENT VALIDATION
========================================================= */

function validateDocument(
  file
) {


  if (
    !file
  ) {

    return true;

  }



  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase();



  const allowedExtensions =
    [

      "pdf",

      "doc",

      "docx"

    ];



  if (
    !allowedExtensions.includes(
      extension
    )
  ) {


    showMessage(
      "Please upload a PDF, DOC, or DOCX document.",
      "error"
    );


    return false;

  }



  if (
    file.size >
    MAX_DOCUMENT_SIZE
  ) {


    showMessage(
      "Document is too large. Maximum document size is 25 MB.",
      "error"
    );


    return false;

  }


  return true;

}



/* =========================================================
   CREATE STORAGE FILE PATH
========================================================= */

function createFilePath(
  file,
  folder
) {


  const extension =

    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      )

    ||

    "file";



  const randomId =

    typeof crypto.randomUUID ===
    "function"

      ? crypto.randomUUID()

      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;



  return (
    `${folder}/` +
    `${randomId}.` +
    `${extension}`
  );

}



/* =========================================================
   UPLOAD TO SUPABASE STORAGE
========================================================= */

async function uploadAchievementFile(
  file,
  folder
) {


  const filePath =
    createFilePath(
      file,
      folder
    );



  const {

    data: uploadData,

    error: uploadError

  } =
    await supabase.storage
      .from(
        ACHIEVEMENT_BUCKET
      )
      .upload(
        filePath,
        file,
        {

          cacheControl:
            "3600",

          upsert:
            false,

          contentType:
            file.type ||
            undefined

        }
      );



  if (
    uploadError
  ) {


    console.error(
      "Storage upload error:",
      uploadError
    );


    throw uploadError;

  }



  if (
    !uploadData?.path
  ) {


    throw new Error(
      "Upload completed but no storage path was returned."
    );

  }



  const {

    data:
      publicUrlData

  } =
    supabase.storage
      .from(
        ACHIEVEMENT_BUCKET
      )
      .getPublicUrl(
        uploadData.path
      );



  const publicUrl =
    publicUrlData?.publicUrl;



  if (
    !publicUrl
  ) {


    throw new Error(
      "File uploaded but no public URL was created."
    );

  }


  return publicUrl;

}



/* =========================================================
   GET STORAGE PATH
========================================================= */

function getStoragePathFromUrl(
  publicUrl
) {


  if (
    !publicUrl
  ) {

    return null;

  }



  try {


    const url =
      new URL(
        publicUrl
      );



    const marker =
      `/storage/v1/object/public/${ACHIEVEMENT_BUCKET}/`;



    const index =
      url.pathname.indexOf(
        marker
      );



    if (
      index ===
      -1
    ) {


      return null;

    }



    return decodeURIComponent(

      url.pathname.substring(

        index +
        marker.length

      )

    );


  }

  catch (
    error
  ) {


    console.warn(
      "Could not parse storage URL:",
      error
    );


    return null;

  }

}



/* =========================================================
   DELETE STORAGE FILE
========================================================= */

async function deleteStorageFile(
  publicUrl
) {


  const path =
    getStoragePathFromUrl(
      publicUrl
    );



  if (
    !path
  ) {

    return;

  }



  const {
    error
  } =
    await supabase.storage
      .from(
        ACHIEVEMENT_BUCKET
      )
      .remove(
        [
          path
        ]
      );



  if (
    error
  ) {


    console.warn(
      "Could not delete storage file:",
      error
    );

  }

}



/* =========================================================
   IMAGE PREVIEW
========================================================= */

achievementImageFile
  ?.addEventListener(
    "change",
    () => {


      clearMessage();



      const file =
        achievementImageFile
          .files?.[0];



      if (
        !file
      ) {


        showExistingImagePreview(
          achievementImageUrl?.value ||
          ""
        );


        return;

      }



      if (
        !validateImage(
          file
        )
      ) {


        achievementImageFile.value =
          "";


        return;

      }



      clearTemporaryPreviews();



      const previewUrl =
        URL.createObjectURL(
          file
        );



      if (
        !achievementImagePreview
      ) {

        return;

      }



      achievementImagePreview.innerHTML =
        "";



      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.className =
        "selected-upload-preview";



      const image =
        document.createElement(
          "img"
        );


      image.src =
        previewUrl;


      image.alt =
        "Selected achievement image";


      image.dataset.objectUrl =
        previewUrl;



      const info =
        document.createElement(
          "div"
        );


      info.className =
        "selected-upload-info";



      const name =
        document.createElement(
          "strong"
        );


      name.textContent =
        file.name;



      const size =
        document.createElement(
          "span"
        );


      size.textContent =
        formatFileSize(
          file.size
        );



      info.append(
        name,
        size
      );


      wrapper.append(
        image,
        info
      );


      achievementImagePreview
        .appendChild(
          wrapper
        );

    }
  );



/* =========================================================
   DOCUMENT PREVIEW
========================================================= */

achievementDocumentFile
  ?.addEventListener(
    "change",
    () => {


      clearMessage();



      const file =
        achievementDocumentFile
          .files?.[0];



      if (
        !file
      ) {


        showExistingDocumentPreview(
          achievementAttachmentUrl?.value ||
          ""
        );


        return;

      }



      if (
        !validateDocument(
          file
        )
      ) {


        achievementDocumentFile.value =
          "";


        return;

      }



      if (
        !achievementDocumentPreview
      ) {

        return;

      }



      achievementDocumentPreview.innerHTML =
        "";



      const card =
        document.createElement(
          "div"
        );


      card.className =
        "uploaded-file-card";



      const icon =
        document.createElement(
          "i"
        );


      icon.className =
        getDocumentIcon(
          file.name
        );



      const info =
        document.createElement(
          "div"
        );



      const name =
        document.createElement(
          "strong"
        );


      name.textContent =
        file.name;



      const size =
        document.createElement(
          "span"
        );


      size.textContent =
        formatFileSize(
          file.size
        );



      info.append(
        name,
        size
      );


      card.append(
        icon,
        info
      );


      achievementDocumentPreview
        .appendChild(
          card
        );

    }
  );



/* =========================================================
   SHOW EXISTING IMAGE
========================================================= */

function showExistingImagePreview(
  url
) {


  if (
    !achievementImagePreview
  ) {

    return;

  }



  achievementImagePreview.innerHTML =
    "";



  if (
    !url
  ) {

    return;

  }



  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    "selected-upload-preview";



  const image =
    document.createElement(
      "img"
    );


  image.src =
    url;


  image.alt =
    "Current achievement image";



  image.addEventListener(
    "error",
    () => {


      console.warn(
        "Existing image preview failed:",
        url
      );

    }
  );



  const info =
    document.createElement(
      "div"
    );


  info.className =
    "selected-upload-info";



  const label =
    document.createElement(
      "strong"
    );


  label.textContent =
    "Current image";



  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.target =
    "_blank";


  link.rel =
    "noopener noreferrer";


  link.textContent =
    "View image";



  info.append(
    label,
    link
  );


  wrapper.append(
    image,
    info
  );


  achievementImagePreview
    .appendChild(
      wrapper
    );

}



/* =========================================================
   SHOW EXISTING DOCUMENT
========================================================= */

function showExistingDocumentPreview(
  url
) {


  if (
    !achievementDocumentPreview
  ) {

    return;

  }



  achievementDocumentPreview.innerHTML =
    "";



  if (
    !url
  ) {

    return;

  }



  const card =
    document.createElement(
      "div"
    );


  card.className =
    "uploaded-file-card";



  const icon =
    document.createElement(
      "i"
    );


  icon.className =
    "fa-solid fa-file";



  const info =
    document.createElement(
      "div"
    );



  const title =
    document.createElement(
      "strong"
    );


  title.textContent =
    "Current document";



  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.target =
    "_blank";


  link.rel =
    "noopener noreferrer";


  link.textContent =
    "View document";



  info.append(
    title,
    link
  );


  card.append(
    icon,
    info
  );


  achievementDocumentPreview
    .appendChild(
      card
    );

}



/* =========================================================
   DOCUMENT ICON
========================================================= */

function getDocumentIcon(
  filename
) {


  const extension =
    filename
      .split(".")
      .pop()
      ?.toLowerCase();



  switch (
    extension
  ) {


    case "pdf":

      return "fa-solid fa-file-pdf";


    case "doc":

    case "docx":

      return "fa-solid fa-file-word";


    default:

      return "fa-solid fa-file";

  }

}



/* =========================================================
   FORMAT FILE SIZE
========================================================= */

function formatFileSize(
  bytes
) {


  if (
    !bytes
  ) {

    return "0 KB";

  }



  if (
    bytes <
    1024 * 1024
  ) {


    return `${(
      bytes /
      1024
    ).toFixed(1)} KB`;

  }



  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(1)} MB`;

}



/* =========================================================
   CLEAR TEMP PREVIEW
========================================================= */

function clearTemporaryPreviews() {


  achievementImagePreview
    ?.querySelectorAll(
      "img[data-object-url]"
    )
    .forEach(
      image => {


        const objectUrl =
          image.dataset.objectUrl;


        if (
          objectUrl
        ) {


          URL.revokeObjectURL(
            objectUrl
          );

        }

      }
    );

}



/* =========================================================
   SAVE ACHIEVEMENT
========================================================= */

async function saveAchievement(
  event
) {


  event.preventDefault();


  clearMessage();



  const title =
    achievementTitle
      ?.value
      .trim();



  const type =
    achievementType
      ?.value;



  if (
    !title ||
    !type
  ) {


    showMessage(
      "Please enter a title and select a type.",
      "error"
    );


    return;

  }



  const imageFile =
    achievementImageFile
      ?.files?.[0]
      ||
    null;



  const documentFile =
    achievementDocumentFile
      ?.files?.[0]
      ||
    null;



  if (
    imageFile &&
    !validateImage(
      imageFile
    )
  ) {

    return;

  }



  if (
    documentFile &&
    !validateDocument(
      documentFile
    )
  ) {

    return;

  }



  const tags =
    (
      achievementTags
        ?.value ||
      ""
    )
      .split(",")
      .map(
        tag =>
          tag.trim()
      )
      .filter(
        Boolean
      );



  /* EXISTING FILES */

  const oldImageUrl =
    achievementImageUrl
      ?.value
      .trim()
      ||
    null;



  const oldAttachmentUrl =
    achievementAttachmentUrl
      ?.value
      .trim()
      ||
    null;



  let finalImageUrl =
    oldImageUrl;


  let finalAttachmentUrl =
    oldAttachmentUrl;


  let uploadedImageUrl =
    null;


  let uploadedDocumentUrl =
    null;



  setSaveButtonLoading(

    true,

    imageFile ||
    documentFile

      ? "Uploading..."

      : "Saving..."

  );



  try {


    /* =====================================================
       UPLOAD IMAGE
    ===================================================== */

    if (
      imageFile
    ) {


      showMessage(
        "Uploading image...",
        "success"
      );


      uploadedImageUrl =
        await uploadAchievementFile(
          imageFile,
          "images"
        );


      finalImageUrl =
        uploadedImageUrl;


      console.log(
        "Uploaded image:",
        finalImageUrl
      );

    }



    /* =====================================================
       UPLOAD DOCUMENT
    ===================================================== */

    if (
      documentFile
    ) {


      showMessage(

        imageFile

          ? "Image uploaded. Uploading document..."

          : "Uploading document...",

        "success"

      );


      uploadedDocumentUrl =
        await uploadAchievementFile(
          documentFile,
          "documents"
        );


      finalAttachmentUrl =
        uploadedDocumentUrl;


      console.log(
        "Uploaded document:",
        finalAttachmentUrl
      );

    }



    /* =====================================================
       DATABASE PAYLOAD
    ===================================================== */

    const payload =
      {


        type:
          type,


        title:
          title,


        organization:
          achievementOrganization
            ?.value
            .trim()
            ||
          null,


        description:
          achievementDescription
            ?.value
            .trim()
            ||
          null,


        issue_date:
          achievementDate
            ?.value
            ||
          null,


        credential_id:
          credentialId
            ?.value
            .trim()
            ||
          null,


        credential_url:
          credentialUrl
            ?.value
            .trim()
            ||
          null,


        image_url:
          finalImageUrl,


        attachment_url:
          finalAttachmentUrl,


        tags:
          tags,


        featured:
          Boolean(
            achievementFeatured
              ?.checked
          ),


        published:
          Boolean(
            achievementPublishedInput
              ?.checked
          ),


        updated_at:
          new Date()
            .toISOString()

      };



    console.log(
      "Achievement payload:",
      payload
    );



    const id =
      achievementId
        ?.value
        ||
      "";



    /* =====================================================
       UPDATE EXISTING ACHIEVEMENT

       IMPORTANT:
       No .select().single() here.
    ===================================================== */

    if (
      id
    ) {


      const {
        error
      } =
        await supabase
          .from(
            "achievements"
          )
          .update(
            payload
          )
          .eq(
            "id",
            id
          );



      if (
        error
      ) {

        throw error;

      }



      console.log(
        "Achievement updated successfully."
      );

    }



    /* =====================================================
       CREATE NEW ACHIEVEMENT

       IMPORTANT:
       No .select().single() here.
    ===================================================== */

    else {


      const {
        error
      } =
        await supabase
          .from(
            "achievements"
          )
          .insert(
            [
              payload
            ]
          );



      if (
        error
      ) {

        throw error;

      }



      console.log(
        "Achievement created successfully."
      );

    }



    /* =====================================================
       DELETE OLD IMAGE IF REPLACED
    ===================================================== */

    if (

      imageFile

      &&

      oldImageUrl

      &&

      oldImageUrl !==
        finalImageUrl

    ) {


      await deleteStorageFile(
        oldImageUrl
      );

    }



    /* =====================================================
       DELETE OLD DOCUMENT IF REPLACED
    ===================================================== */

    if (

      documentFile

      &&

      oldAttachmentUrl

      &&

      oldAttachmentUrl !==
        finalAttachmentUrl

    ) {


      await deleteStorageFile(
        oldAttachmentUrl
      );

    }



    /* =====================================================
       KEEP CURRENT URLS
    ===================================================== */

    if (
      achievementImageUrl
    ) {


      achievementImageUrl.value =
        finalImageUrl ||
        "";

    }



    if (
      achievementAttachmentUrl
    ) {


      achievementAttachmentUrl.value =
        finalAttachmentUrl ||
        "";

    }



    /* =====================================================
       SUCCESS
    ===================================================== */

    showMessage(

      id

        ? "Achievement updated successfully."

        : "Achievement added successfully.",

      "success"

    );



    await loadAchievements();



    setTimeout(
      () => {


        closeModal();

      },
      700
    );


  }

  catch (
    error
  ) {


    console.error(
      "Save achievement error:",
      error
    );



    /*
      If files were uploaded but the
      database operation failed,
      remove the new files.
    */

    if (
      uploadedImageUrl
    ) {


      await deleteStorageFile(
        uploadedImageUrl
      );

    }



    if (
      uploadedDocumentUrl
    ) {


      await deleteStorageFile(
        uploadedDocumentUrl
      );

    }



    showMessage(

      error.message

      ||

      "Could not save the achievement.",

      "error"

    );


  }

  finally {


    setSaveButtonLoading(
      false
    );

  }

}



/* =========================================================
   SAVE BUTTON
========================================================= */

function setSaveButtonLoading(
  loading,
  label = "Saving..."
) {


  if (
    !saveBtn
  ) {

    return;

  }



  saveBtn.disabled =
    loading;



  if (
    loading
  ) {


    saveBtn.innerHTML =
      `
        <i class="fa-solid fa-spinner fa-spin"></i>
        ${label}
      `;

  }

  else {


    saveBtn.innerHTML =
      `
        <i class="fa-solid fa-floppy-disk"></i>
        Save Achievement
      `;

  }

}



/* =========================================================
   PUBLISH / UNPUBLISH
========================================================= */

async function togglePublish(
  achievement
) {


  const newValue =
    !achievement.published;



  try {


    const {
      error
    } =
      await supabase
        .from(
          "achievements"
        )
        .update(
          {

            published:
              newValue,

            updated_at:
              new Date()
                .toISOString()

          }
        )
        .eq(
          "id",
          achievement.id
        );



    if (
      error
    ) {

      throw error;

    }



    await loadAchievements();


  }

  catch (
    error
  ) {


    console.error(
      "Publish error:",
      error
    );


    alert(
      error.message ||
      "Could not update publish status."
    );

  }

}



/* =========================================================
   DELETE ACHIEVEMENT
========================================================= */

async function deleteAchievement(
  achievement
) {


  const confirmed =
    window.confirm(
      `Delete "${achievement.title}"?

This will also remove its uploaded image and document.`
    );



  if (
    !confirmed
  ) {

    return;

  }



  try {


    const {
      error
    } =
      await supabase
        .from(
          "achievements"
        )
        .delete()
        .eq(
          "id",
          achievement.id
        );



    if (
      error
    ) {

      throw error;

    }



    if (
      achievement.image_url
    ) {


      await deleteStorageFile(
        achievement.image_url
      );

    }



    if (
      achievement.attachment_url
    ) {


      await deleteStorageFile(
        achievement.attachment_url
      );

    }



    await loadAchievements();


  }

  catch (
    error
  ) {


    console.error(
      "Delete error:",
      error
    );


    alert(
      error.message ||
      "Could not delete achievement."
    );

  }

}



/* =========================================================
   STATUS
========================================================= */

function setStatus(
  text
) {


  if (
    !statusElement
  ) {

    return;

  }


  statusElement.style.display =
    "block";


  statusElement.textContent =
    text;

}



function hideStatus() {


  if (
    statusElement
  ) {


    statusElement.style.display =
      "none";

  }

}



/* =========================================================
   FORM MESSAGE
========================================================= */

function showMessage(
  text,
  type
) {


  if (
    !message
  ) {

    return;

  }



  message.className =
    `form-message ${type}`;


  message.textContent =
    text;

}



function clearMessage() {


  if (
    !message
  ) {

    return;

  }



  message.className =
    "form-message";


  message.textContent =
    "";

}



/* =========================================================
   EVENTS
========================================================= */

openFormBtn
  ?.addEventListener(
    "click",
    openNewForm
  );


closeFormBtn
  ?.addEventListener(
    "click",
    closeModal
  );


cancelBtn
  ?.addEventListener(
    "click",
    closeModal
  );


backdrop
  ?.addEventListener(
    "click",
    closeModal
  );


form
  ?.addEventListener(
    "submit",
    saveAchievement
  );


searchInput
  ?.addEventListener(
    "input",
    filterAchievements
  );


typeFilter
  ?.addEventListener(
    "change",
    filterAchievements
  );



/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
  "keydown",
  event => {


    if (

      event.key ===
        "Escape"

      &&

      modal?.classList.contains(
        "active"
      )

    ) {


      closeModal();

    }

  }
);



/* =========================================================
   LOGOUT
========================================================= */

logoutBtn
  ?.addEventListener(
    "click",
    async () => {


      try {


        const {
          error
        } =
          await supabase.auth
            .signOut();


        if (
          error
        ) {


          console.error(
            "Logout error:",
            error
          );

        }


      }

      finally {


        window.location.replace(
          "index.html"
        );

      }

    }
  );



/* =========================================================
   INITIALIZE
========================================================= */

async function initialize() {


  const authorized =
    await requireAdmin();


  if (
    !authorized
  ) {

    return;

  }


  await loadAchievements();

}



initialize();