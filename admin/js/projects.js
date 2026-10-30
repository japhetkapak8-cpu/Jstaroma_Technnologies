import { supabase }
from "../../js/supabase.js";


const BUCKET_NAME =
  "project-images";

const DOCUMENT_BUCKET_NAME = "project-documents";
const projectDocumentInput = document.getElementById("projectDocument");
const currentProjectDocument = document.getElementById("currentProjectDocument");
const removeProjectDocument = document.getElementById("removeProjectDocument");


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


const playStoreUrlInput =
  document.getElementById(
    "playStoreUrl"
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

    let uploadedNewDocumentPath = null;

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

      const selectedDocument = projectDocumentInput.files[0];
      if (selectedDocument && removeProjectDocument.checked) {
        throw new Error("Choose a new document or remove the current document, not both.");
      }
      if (selectedDocument) {
        validateDocument(selectedDocument);
      }

      let documentUrl = existingProject?.document_url || null;
      let documentPath = existingProject?.document_path || null;
      let documentName = existingProject?.document_name || null;
      if (removeProjectDocument.checked) {
        documentUrl = null;
        documentPath = null;
        documentName = null;
      }

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


      if (selectedDocument) {
        const extension = getFileExtension(selectedDocument.name);
        const filePath = `projects/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage
          .from(DOCUMENT_BUCKET_NAME)
          .upload(filePath, selectedDocument, {
            cacheControl: "3600",
            upsert: false,
            contentType: documentContentTypes[extension]
          });
        if (error) {
          throw error;
        }
        uploadedNewDocumentPath = filePath;
        const { data } = supabase.storage.from(DOCUMENT_BUCKET_NAME).getPublicUrl(filePath);
        documentUrl = data.publicUrl;
        documentPath = filePath;
        documentName = selectedDocument.name;
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

        play_store_url:
          normalizeUrl(
            playStoreUrlInput.value
          ),

        published:
          publishedInput.checked,

        image_url:
          imageUrl,

        image_path:
          imagePath,

        document_url: documentUrl,
        document_path: documentPath,
        document_name: documentName,

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

      uploadedNewImagePath = null;
      uploadedNewDocumentPath = null;
      let documentCleanupFailed = false;
      if (existingProject?.document_path && existingProject.document_path !== documentPath) {
        documentCleanupFailed = !(await removeStoredDocument(existingProject.document_path));
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

      if (documentCleanupFailed) {
        showMessage("Project saved, but the old document could not be deleted from storage.", "error");
      }

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

      const { error: cleanupError } = await supabase.storage
        .from(
          BUCKET_NAME
        )
        .remove([
          uploadedNewImagePath
        ]);

      if (cleanupError) {
        console.warn("New image could not be removed after save failure:", cleanupError);
      }
    }

    let documentCleanupFailed = false;
    if (uploadedNewDocumentPath) {
      documentCleanupFailed = !(await removeStoredDocument(uploadedNewDocumentPath));
    }

    showMessage(
      (error.message || "Could not save project.") +
        (documentCleanupFailed ? " The uploaded document could not be removed from storage." : ""),
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


  playStoreUrlInput.value =
    project.play_store_url ||
    "";


  publishedInput.checked =
    Boolean(
      project.published
    );


  currentImagePath =
    project.image_path ||
    null;

  projectImageInput.value = "";
  projectDocumentInput.value = "";
  removeProjectDocument.checked = false;
  currentProjectDocument.textContent = project.document_name
    ? `Current document: ${project.document_name}`
    : project.document_url ? "Current document attached." : "No document attached.";

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


    const documentRemoved = !project.document_path ||
      await removeStoredDocument(project.document_path);
    showMessage(
      documentRemoved
        ? "Project deleted successfully."
        : "Project deleted, but its document could not be removed from storage.",
      documentRemoved ? "success" : "error"
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

  projectDocumentInput.value = "";
  removeProjectDocument.checked = false;
  currentProjectDocument.textContent = "";
}

const documentContentTypes = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

function validateDocument(file) {
  const extension = getFileExtension(file.name);
  const contentType = documentContentTypes[extension];
  if (!Object.hasOwn(documentContentTypes, extension) ||
      (file.type && file.type !== contentType && file.type !== "application/octet-stream")) {
    throw new Error("Please upload a PDF or Word document (.doc or .docx).");
  }
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("Project document must be non-empty and no larger than 10 MB.");
  }
}

async function removeStoredDocument(filePath) {
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET_NAME).remove([filePath]);
  if (error) {
    console.warn("Project document could not be deleted:", error);
    return false;
  }
  return true;
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