import { supabase }
from "../../js/supabase.js";


const BUCKET_NAME =
  "project-images";


let projects = [];

let currentImagePath = null;


// ========================================
// ELEMENTS
// ========================================

const projectForm =
  document.getElementById(
    "projectForm"
  );


const projectId =
  document.getElementById(
    "projectId"
  );


const titleInput =
  document.getElementById(
    "title"
  );


const categoryInput =
  document.getElementById(
    "category"
  );


const descriptionInput =
  document.getElementById(
    "description"
  );


const toolsInput =
  document.getElementById(
    "tools"
  );


const projectUrlInput =
  document.getElementById(
    "projectUrl"
  );


const githubUrlInput =
  document.getElementById(
    "githubUrl"
  );


const projectImageInput =
  document.getElementById(
    "projectImage"
  );


const publishedInput =
  document.getElementById(
    "published"
  );


const saveProjectBtn =
  document.getElementById(
    "saveProjectBtn"
  );


const cancelEditBtn =
  document.getElementById(
    "cancelEditBtn"
  );


const formTitle =
  document.getElementById(
    "formTitle"
  );


const projectMessage =
  document.getElementById(
    "projectMessage"
  );


const projectsList =
  document.getElementById(
    "projectsList"
  );


const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );


// ========================================
// REQUIRE ADMIN
// ========================================

async function requireAdmin() {

  const {
    data: {
      session
    },
    error: sessionError
  } =
    await supabase.auth
      .getSession();


  if (sessionError) {

    console.error(
      "Session error:",
      sessionError
    );

    window.location.replace(
      "index.html"
    );

    return false;
  }


  if (!session) {

    window.location.replace(
      "index.html"
    );

    return false;
  }


  const {
    data: admin,
    error
  } =
    await supabase
      .from("admins")
      .select("user_id")
      .eq(
        "user_id",
        session.user.id
      )
      .maybeSingle();


  if (error) {

    console.error(
      "Admin check error:",
      error
    );

    await supabase.auth
      .signOut();

    window.location.replace(
      "index.html"
    );

    return false;
  }


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


// ========================================
// LOAD PROJECTS
// ========================================

async function loadProjects() {

  projectsList.innerHTML =
    `
      <div class="empty-admin-state">

        <i class="fa-solid fa-spinner fa-spin"></i>

        <p>
          Loading projects...
        </p>

      </div>
    `;


  try {

    const {
      data,
      error
    } =
      await supabase
        .from("projects")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      throw error;

    }


    projects =
      data || [];


    renderProjects();

  }

  catch (error) {

    console.error(
      "Load projects error:",
      error
    );


    projectsList.innerHTML =
      `
        <div class="empty-admin-state">

          <i class="fa-solid fa-triangle-exclamation"></i>

          <h3>
            Could not load projects
          </h3>

          <p>
            ${escapeHtml(
              error.message ||
              "Unknown error"
            )}
          </p>

        </div>
      `;

  }

}


// ========================================
// RENDER PROJECTS
// ========================================

function renderProjects() {

  projectsList.innerHTML =
    "";


  if (!projects.length) {

    projectsList.innerHTML =
      `
        <div class="empty-admin-state">

          <i class="fa-regular fa-folder-open"></i>

          <h3>
            No projects yet
          </h3>

          <p>
            Add your first project above.
          </p>

        </div>
      `;

    return;
  }


  projects.forEach(
    project => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "admin-project-item";


      const imageHtml =
        project.image_url
          ?
          `
            <img
              src="${escapeHtml(
                project.image_url
              )}"
              alt="${escapeHtml(
                project.title
              )}"
              class="admin-project-image"
            >
          `
          :
          `
            <div class="admin-project-placeholder">

              <i class="fa-solid fa-image"></i>

            </div>
          `;


      item.innerHTML =
        `

          ${imageHtml}


          <div class="admin-project-info">

            <div class="project-top-row">

              <span class="project-category-badge">

                ${escapeHtml(
                  project.category ||
                  "Other"
                )}

              </span>


              <span
                class="
                  project-status
                  ${
                    project.published
                      ?
                      "published"
                      :
                      "draft"
                  }
                "
              >

                ${
                  project.published
                    ?
                    "Published"
                    :
                    "Draft"
                }

              </span>

            </div>


            <h3>
              ${escapeHtml(
                project.title
              )}
            </h3>


            <p>
              ${escapeHtml(
                project.description ||
                ""
              )}
            </p>

          </div>


          <div class="admin-project-actions">

            <button
              type="button"
              class="edit-btn"
              data-id="${project.id}"
            >

              <i class="fa-solid fa-pen"></i>

              Edit

            </button>


            <button
              type="button"
              class="delete-project-btn"
              data-id="${project.id}"
            >

              <i class="fa-solid fa-trash"></i>

              Delete

            </button>

          </div>

        `;


      projectsList.appendChild(
        item
      );

    }
  );


  bindProjectButtons();

}


// ========================================
// SAVE PROJECT
// ========================================

projectForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    clearMessage();


    const title =
      titleInput.value
        .trim();


    const description =
      descriptionInput.value
        .trim();


    if (!title) {

      showMessage(
        "Please enter a project title.",
        "error"
      );

      return;
    }


    if (!description) {

      showMessage(
        "Please enter a project description.",
        "error"
      );

      return;
    }


    saveProjectBtn.disabled =
      true;


    saveProjectBtn.innerHTML =
      `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Saving...
      `;


    const editingId =
      projectId.value;


    let uploadedNewImagePath =
      null;


    try {

      const existingProject =
        editingId
          ?
          projects.find(
            project =>
              project.id ===
              editingId
          )
          :
          null;


      let imageUrl =
        existingProject?.image_url ||
        null;


      let imagePath =
        existingProject?.image_path ||
        null;


      // ========================================
      // UPLOAD NEW IMAGE
      // ========================================

      const selectedImage =
        projectImageInput.files[0];


      if (selectedImage) {

        validateImage(
          selectedImage
        );


        const extension =
          getFileExtension(
            selectedImage.name
          );


        const fileName =
          `${
            Date.now()
          }-${
            crypto.randomUUID()
          }.${
            extension
          }`;


        const filePath =
          `projects/${fileName}`;


        const {
          error:
            uploadError
        } =
          await supabase.storage
            .from(
              BUCKET_NAME
            )
            .upload(
              filePath,
              selectedImage,
              {
                cacheControl:
                  "3600",

                upsert:
                  false,

                contentType:
                  selectedImage.type
              }
            );


        if (uploadError) {

          throw uploadError;

        }


        uploadedNewImagePath =
          filePath;


        const {
          data:
            publicUrlData
        } =
          supabase.storage
            .from(
              BUCKET_NAME
            )
            .getPublicUrl(
              filePath
            );


        imageUrl =
          publicUrlData
            .publicUrl;


        imagePath =
          filePath;

      }


      // ========================================
      // PROJECT PAYLOAD
      // ========================================

      const payload = {

        title:
          title,

        category:
          categoryInput.value ||
          "Other",

        description:
          description,

        tools:
          toolsInput.value
            .trim()
            ||
          null,

        project_url:
          normalizeUrl(
            projectUrlInput.value
          ),

        github_url:
          normalizeUrl(
            githubUrlInput.value
          ),

        published:
          publishedInput.checked,

        image_url:
          imageUrl,

        image_path:
          imagePath,

        updated_at:
          new Date()
            .toISOString()

      };


      let saveError;


      // ========================================
      // UPDATE
      // ========================================

      if (editingId) {

        const {
          error
        } =
          await supabase
            .from("projects")
            .update(
              payload
            )
            .eq(
              "id",
              editingId
            );


        saveError =
          error;

      }


      // ========================================
      // INSERT
      // ========================================

      else {

        const {
          error
        } =
          await supabase
            .from("projects")
            .insert(
              payload
            );


        saveError =
          error;

      }


      if (saveError) {

        throw saveError;

      }


      // ========================================
      // DELETE OLD IMAGE AFTER SUCCESSFUL EDIT
      // ========================================

      if (
        editingId
        &&
        selectedImage
        &&
        existingProject?.image_path
        &&
        existingProject.image_path
          !==
        imagePath
      ) {

        const {
          error:
            oldImageDeleteError
        } =
          await supabase.storage
            .from(
              BUCKET_NAME
            )
            .remove([
              existingProject
                .image_path
            ]);


        if (
          oldImageDeleteError
        ) {

          console.warn(
            "Old image could not be deleted:",
            oldImageDeleteError
          );

        }

      }


      showMessage(
        editingId
          ?
          "Project updated successfully."
          :
          "Project added successfully.",
        "success"
      );


      resetForm();


      await loadProjects();

  }

  catch (error) {

    console.error(
      "Save project error:",
      error
    );


    // If upload succeeded but DB save failed,
    // remove the newly uploaded image.

    if (
      uploadedNewImagePath
    ) {

      await supabase.storage
        .from(
          BUCKET_NAME
        )
        .remove([
          uploadedNewImagePath
        ]);

    }


    showMessage(
      error.message ||
      "Could not save project.",
      "error"
    );

  }

  finally {

    saveProjectBtn.disabled =
      false;


    saveProjectBtn.innerHTML =
      `
        <i class="fa-solid fa-floppy-disk"></i>
        Save Project
      `;

  }

});


// ========================================
// BIND BUTTONS
// ========================================

function bindProjectButtons() {

  const editButtons =
    document.querySelectorAll(
      ".edit-btn"
    );


  editButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          editProject(
            button.dataset.id
          );

        }
      );

    }
  );


  const deleteButtons =
    document.querySelectorAll(
      ".delete-project-btn"
    );


  deleteButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          deleteProject(
            button.dataset.id
          );

        }
      );

    }
  );

}


// ========================================
// EDIT PROJECT
// ========================================

function editProject(
  id
) {

  const project =
    projects.find(
      project =>
        project.id === id
    );


  if (!project) {

    return;

  }


  projectId.value =
    project.id;


  titleInput.value =
    project.title ||
    "";


  categoryInput.value =
    project.category ||
    "Other";


  descriptionInput.value =
    project.description ||
    "";


  toolsInput.value =
    project.tools ||
    "";


  projectUrlInput.value =
    project.project_url ||
    "";


  githubUrlInput.value =
    project.github_url ||
    "";


  publishedInput.checked =
    Boolean(
      project.published
    );


  currentImagePath =
    project.image_path ||
    null;


  formTitle.textContent =
    "Edit Project";


  cancelEditBtn.classList.remove(
    "hidden"
  );


  clearMessage();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// ========================================
// DELETE PROJECT
// ========================================

async function deleteProject(
  id
) {

  const project =
    projects.find(
      project =>
        project.id === id
    );


  if (!project) {

    return;

  }


  const confirmed =
    window.confirm(
      `Delete "${project.title}"?`
    );


  if (!confirmed) {

    return;

  }


  try {

    // Delete database record first

    const {
      error
    } =
      await supabase
        .from("projects")
        .delete()
        .eq(
          "id",
          id
        );


    if (error) {

      throw error;

    }


    // Then delete image

    if (
      project.image_path
    ) {

      const {
        error:
          imageDeleteError
      } =
        await supabase.storage
          .from(
            BUCKET_NAME
          )
          .remove([
            project.image_path
          ]);


      if (
        imageDeleteError
      ) {

        console.warn(
          "Project deleted but image could not be removed:",
          imageDeleteError
        );

      }

    }


    showMessage(
      "Project deleted successfully.",
      "success"
    );


    await loadProjects();

  }

  catch (error) {

    console.error(
      "Delete project error:",
      error
    );


    showMessage(
      error.message ||
      "Could not delete project.",
      "error"
    );

  }

}


// ========================================
// CANCEL EDIT
// ========================================

cancelEditBtn.addEventListener(
  "click",
  () => {

    resetForm();

    clearMessage();

  }
);


// ========================================
// RESET FORM
// ========================================

function resetForm() {

  projectForm.reset();


  projectId.value =
    "";


  currentImagePath =
    null;


  formTitle.textContent =
    "Add New Project";


  cancelEditBtn.classList.add(
    "hidden"
  );


  projectImageInput.value =
    "";

}


// ========================================
// LOGOUT
// ========================================

logoutBtn.addEventListener(
  "click",
  async () => {

    await supabase.auth
      .signOut();


    window.location.replace(
      "index.html"
    );

  }
);


// ========================================
// IMAGE VALIDATION
// ========================================

function validateImage(
  file
) {

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

    throw new Error(
      "Please upload a JPG, PNG, or WebP image."
    );

  }


  const maxSize =
    10 * 1024 * 1024;


  if (
    file.size >
    maxSize
  ) {

    throw new Error(
      "Project image must be smaller than 10 MB."
    );

  }

}


// ========================================
// FILE EXTENSION
// ========================================

function getFileExtension(
  fileName
) {

  const parts =
    fileName
      .split(".");


  if (
    parts.length <
    2
  ) {

    return "jpg";

  }


  return parts
    .pop()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );

}


// ========================================
// URL NORMALIZATION
// ========================================

function normalizeUrl(
  value
) {

  const trimmed =
    value.trim();


  if (!trimmed) {

    return null;

  }


  if (
    trimmed.startsWith(
      "http://"
    )
    ||
    trimmed.startsWith(
      "https://"
    )
  ) {

    return trimmed;

  }


  return `https://${trimmed}`;

}


// ========================================
// MESSAGE
// ========================================

function showMessage(
  message,
  type
) {

  projectMessage.textContent =
    message;


  projectMessage.className =
    "form-message";


  if (type) {

    projectMessage.classList.add(
      type
    );

  }

}


function clearMessage() {

  projectMessage.textContent =
    "";


  projectMessage.className =
    "form-message";

}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(
  value
) {

  const div =
    document.createElement(
      "div"
    );


  div.textContent =
    value ||
    "";


  return div.innerHTML;

}


// ========================================
// INITIALIZE
// ========================================

async function initializePage() {

  const authorized =
    await requireAdmin();


  if (!authorized) {

    return;

  }


  await loadProjects();

}


initializePage();