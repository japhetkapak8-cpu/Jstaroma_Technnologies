console.log(
  "JStaroma Products Admin loaded"
);


/* =========================================================
   STATE
========================================================= */

let supabase = null;

let products = [];

let filteredProducts = [];


/* =========================================================
   DOM
========================================================= */

const productsList =
  document.getElementById(
    "productsList"
  );

const productsStatus =
  document.getElementById(
    "productsStatus"
  );

const productSearch =
  document.getElementById(
    "productSearch"
  );

const categoryFilter =
  document.getElementById(
    "categoryFilter"
  );

const statusFilter =
  document.getElementById(
    "statusFilter"
  );


const totalProducts =
  document.getElementById(
    "totalProducts"
  );

const publishedProducts =
  document.getElementById(
    "publishedProducts"
  );

const draftProducts =
  document.getElementById(
    "draftProducts"
  );

const featuredProducts =
  document.getElementById(
    "featuredProducts"
  );


const addProductBtn =
  document.getElementById(
    "addProductBtn"
  );

const productModal =
  document.getElementById(
    "productModal"
  );

const productModalBackdrop =
  document.getElementById(
    "productModalBackdrop"
  );

const closeProductModal =
  document.getElementById(
    "closeProductModal"
  );

const cancelProductBtn =
  document.getElementById(
    "cancelProductBtn"
  );

const productModalTitle =
  document.getElementById(
    "productModalTitle"
  );


const productForm =
  document.getElementById(
    "productForm"
  );

const productId =
  document.getElementById(
    "productId"
  );

const productName =
  document.getElementById(
    "productName"
  );

const productCategory =
  document.getElementById(
    "productCategory"
  );

const productSku =
  document.getElementById(
    "productSku"
  );

const productPrice =
  document.getElementById(
    "productPrice"
  );

const productStock =
  document.getElementById(
    "productStock"
  );

const productImageFile =
  document.getElementById(
    "productImageFile"
  );

const productImageUrl =
  document.getElementById(
    "productImageUrl"
  );

const productImagePath =
  document.getElementById(
    "productImagePath"
  );

const productImagePreview =
  document.getElementById(
    "productImagePreview"
  );

const productDescription =
  document.getElementById(
    "productDescription"
  );

const productTags =
  document.getElementById(
    "productTags"
  );

const productPrivacyPolicyUrl =
  document.getElementById(
    "productPrivacyPolicyUrl"
  );

const productTermsOfUseUrl =
  document.getElementById(
    "productTermsOfUseUrl"
  );

const productAccountDeletionUrl =
  document.getElementById(
    "productAccountDeletionUrl"
  );

const productChildSafetyUrl =
  document.getElementById(
    "productChildSafetyUrl"
  );

const productFeatured =
  document.getElementById(
    "productFeatured"
  );

const productPublished =
  document.getElementById(
    "productPublished"
  );

const formStatus =
  document.getElementById(
    "formStatus"
  );

const saveProductBtn =
  document.getElementById(
    "saveProductBtn"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );


/* =========================================================
   EVENTS FIRST
========================================================= */

setupEvents();

initialize();


function setupEvents() {

  addProductBtn
    ?.addEventListener(
      "click",
      openNewProduct
    );


  closeProductModal
    ?.addEventListener(
      "click",
      closeModal
    );


  cancelProductBtn
    ?.addEventListener(
      "click",
      closeModal
    );


  productModalBackdrop
    ?.addEventListener(
      "click",
      closeModal
    );


  productForm
    ?.addEventListener(
      "submit",
      saveProduct
    );


  productSearch
    ?.addEventListener(
      "input",
      filterProducts
    );


  categoryFilter
    ?.addEventListener(
      "change",
      filterProducts
    );


  statusFilter
    ?.addEventListener(
      "change",
      filterProducts
    );


  productImageFile
    ?.addEventListener(
      "change",
      previewSelectedProductImage
    );


  logoutBtn
    ?.addEventListener(
      "click",
      logoutAdmin
    );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        productModal
          ?.classList
          .contains("open")
      ) {

        closeModal();

      }

    }
  );

}


/* =========================================================
   INITIALIZE
========================================================= */

async function initialize() {

  setProductsStatus(
    "Connecting to database..."
  );


  try {

    const supabaseModule =
      await import(
        "../../js/supabase.js"
      );


    supabase =
      supabaseModule.supabase;


    if (!supabase) {

      throw new Error(
        "Supabase client could not be loaded."
      );

    }


    const authModule =
      await import(
        "./admin-auth.js"
      );


    if (
      typeof authModule.requireAdmin !==
      "function"
    ) {

      throw new Error(
        "requireAdmin is not exported from admin-auth.js."
      );

    }


    const user =
      await authModule
        .requireAdmin();


    if (!user) {
      return;
    }


    await loadProducts();

  }

  catch (error) {

    console.error(
      error
    );


    setProductsStatus(
      `Products connection error: ${
        error.message || error
      }`,
      true
    );

  }

}


/* =========================================================
   LOAD
========================================================= */

async function loadProducts() {

  setProductsStatus(
    "Loading products..."
  );


  try {

    const {
      data,
      error
    } =
      await supabase
        .from("products")
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


    products =
      data || [];


    updateStats();

    filterProducts();

  }

  catch (error) {

    console.error(
      error
    );


    setProductsStatus(
      `Could not load products: ${
        error.message
      }`,
      true
    );

  }

}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

  totalProducts.textContent =
    products.length;


  publishedProducts.textContent =
    products.filter(
      product =>
        product.published === true
    ).length;


  draftProducts.textContent =
    products.filter(
      product =>
        product.published !== true
    ).length;


  featuredProducts.textContent =
    products.filter(
      product =>
        product.featured === true
    ).length;

}


/* =========================================================
   FILTER
========================================================= */

function filterProducts() {

  const search =
    (
      productSearch.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const category =
    categoryFilter.value;


  const status =
    statusFilter.value;


  filteredProducts =
    products.filter(
      product => {

        const text =
          [
            product.name,
            product.category,
            product.description,
            product.sku,
            ...(Array.isArray(product.tags)
              ? product.tags
              : [])
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        const searchMatch =
          !search ||
          text.includes(search);


        const categoryMatch =
          category === "All" ||
          product.category ===
            category;


        let statusMatch =
          true;


        if (
          status === "Published"
        ) {

          statusMatch =
            product.published === true;

        }


        if (
          status === "Draft"
        ) {

          statusMatch =
            product.published !== true;

        }


        return (
          searchMatch &&
          categoryMatch &&
          statusMatch
        );

      }
    );


  renderProducts();

}


/* =========================================================
   RENDER
========================================================= */

function renderProducts() {

  productsList.innerHTML = "";


  if (
    filteredProducts.length === 0
  ) {

    setProductsStatus(
      products.length === 0
        ? "No products yet. Click Add Product to create your first product."
        : "No products match your filters."
    );


    return;

  }


  hideProductsStatus();


  filteredProducts.forEach(
    product => {

      productsList.appendChild(
        createProductCard(
          product
        )
      );

    }
  );

}


/* =========================================================
   CARD
========================================================= */

function createProductCard(
  product
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "admin-product-card";


  const imageArea =
    document.createElement(
      "div"
    );


  imageArea.className =
    "admin-product-image";


  if (product.image_url) {

    const image =
      document.createElement(
        "img"
      );


    image.src =
      product.image_url;


    image.alt =
      product.name ||
      "Product image";


    image.loading =
      "lazy";


    image.addEventListener(
      "error",
      () => {

        showPlaceholder(
          imageArea,
          product.category
        );

      }
    );


    imageArea.appendChild(
      image
    );

  }

  else {

    showPlaceholder(
      imageArea,
      product.category
    );

  }


  const content =
    document.createElement(
      "div"
    );


  content.className =
    "admin-product-content";


  const top =
    document.createElement(
      "div"
    );


  top.className =
    "admin-product-top";


  const heading =
    document.createElement(
      "div"
    );


  const title =
    document.createElement(
      "h3"
    );


  title.textContent =
    product.name;


  const category =
    document.createElement(
      "span"
    );


  category.className =
    "admin-product-category";


  category.textContent =
    product.category;


  heading.append(
    title,
    category
  );


  const badges =
    document.createElement(
      "div"
    );


  badges.className =
    "admin-product-badges";


  const statusBadge =
    document.createElement(
      "span"
    );


  statusBadge.className =
    product.published
      ? "admin-badge published"
      : "admin-badge draft";


  statusBadge.textContent =
    product.published
      ? "Published"
      : "Draft";


  badges.appendChild(
    statusBadge
  );


  if (product.featured) {

    const featured =
      document.createElement(
        "span"
      );


    featured.className =
      "admin-badge featured";


    featured.innerHTML =
      `
        <i class="fa-solid fa-star"></i>
        Featured
      `;


    badges.appendChild(
      featured
    );

  }


  top.append(
    heading,
    badges
  );


  const description =
    document.createElement(
      "p"
    );


  description.className =
    "admin-product-description";


  description.textContent =
    product.description ||
    "No description provided.";


  const meta =
    document.createElement(
      "div"
    );


  meta.className =
    "admin-product-meta";


  meta.innerHTML =
    `
      <span>
        <strong>Price:</strong>
        ${formatPrice(product.price)}
      </span>

      <span>
        <strong>Stock:</strong>
        ${Number(product.stock || 0)}
      </span>

      <span>
        <strong>SKU:</strong>
        ${escapeHtml(product.sku || "—")}
      </span>
    `;


  const actions =
    document.createElement(
      "div"
    );


  actions.className =
    "admin-product-actions";


  const publishBtn =
    document.createElement(
      "button"
    );


  publishBtn.type =
    "button";


  publishBtn.className =
    product.published
      ? "admin-small-btn warning"
      : "admin-small-btn success";


  publishBtn.innerHTML =
    product.published
      ? `
          <i class="fa-solid fa-eye-slash"></i>
          Unpublish
        `
      : `
          <i class="fa-solid fa-globe"></i>
          Publish
        `;


  publishBtn.addEventListener(
    "click",
    () => {

      togglePublish(
        product
      );

    }
  );


  const editBtn =
    document.createElement(
      "button"
    );


  editBtn.type =
    "button";


  editBtn.className =
    "admin-small-btn";


  editBtn.innerHTML =
    `
      <i class="fa-solid fa-pen"></i>
      Edit
    `;


  editBtn.addEventListener(
    "click",
    () => {

      openEditProduct(
        product
      );

    }
  );


  const deleteBtn =
    document.createElement(
      "button"
    );


  deleteBtn.type =
    "button";


  deleteBtn.className =
    "admin-small-btn danger";


  deleteBtn.innerHTML =
    `
      <i class="fa-solid fa-trash"></i>
      Delete
    `;


  deleteBtn.addEventListener(
    "click",
    () => {

      deleteProduct(
        product
      );

    }
  );


  actions.append(
    publishBtn,
    editBtn,
    deleteBtn
  );


  content.append(
    top,
    description,
    meta,
    actions
  );


  card.append(
    imageArea,
    content
  );


  return card;

}


/* =========================================================
   PLACEHOLDER
========================================================= */

function showPlaceholder(
  container,
  category
) {

  container.innerHTML =
    `
      <div class="admin-product-placeholder">

        <i class="fa-solid fa-box-open"></i>

        <span>
          ${escapeHtml(
            category ||
            "Product"
          )}
        </span>

      </div>
    `;

}


/* =========================================================
   ADD
========================================================= */

function openNewProduct() {

  resetForm();


  productModalTitle.textContent =
    "Add Product";


  productPublished.checked =
    true;


  openModal();

}


/* =========================================================
   EDIT
========================================================= */

function openEditProduct(
  product
) {

  resetForm();

  const hasPolicyLinks =
    [
      product.privacy_policy_url,
      product.terms_of_use_url,
      product.account_deletion_url,
      product.child_safety_url
    ]
      .some(Boolean);

  const isLegacyWantokProduct =
    !hasPolicyLinks &&
    [
      product.name,
      product.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes("wantok chat");


  productId.value =
    product.id ||
    "";


  productName.value =
    product.name ||
    "";


  productCategory.value =
    product.category ||
    "";


  productSku.value =
    product.sku ||
    "";


  productPrice.value =
    product.price ??
    0;


  productStock.value =
    product.stock ??
    0;


  productDescription.value =
    product.description ||
    "";


  productTags.value =
    Array.isArray(
      product.tags
    )
      ? product.tags.join(", ")
      : "";

  productPrivacyPolicyUrl.value =
    product.privacy_policy_url ||
    (
      isLegacyWantokProduct
        ? "/privacy/"
        : ""
    );

  productTermsOfUseUrl.value =
    product.terms_of_use_url ||
    (
      isLegacyWantokProduct
        ? "/terms/"
        : ""
    );

  productAccountDeletionUrl.value =
    product.account_deletion_url ||
    (
      isLegacyWantokProduct
        ? "/account-deletion/"
        : ""
    );

  productChildSafetyUrl.value =
    product.child_safety_url ||
    (
      isLegacyWantokProduct
        ? "/child-safety/"
        : ""
    );


  productFeatured.checked =
    product.featured === true;


  productPublished.checked =
    product.published === true;


  productImageUrl.value =
    product.image_url ||
    "";


  productImagePath.value =
    product.image_path ||
    "";


  productImageFile.value =
    "";


  if (product.image_url) {

    showImagePreview(
      product.image_url,
      product.name,
      true
    );

  }


  productModalTitle.textContent =
    "Edit Product";


  openModal();

}


/* =========================================================
   MODAL
========================================================= */

function openModal() {

  productModal.classList.add(
    "open"
  );


  productModal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.classList.add(
    "modal-open"
  );

}


function closeModal() {

  productModal.classList.remove(
    "open"
  );


  productModal.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.classList.remove(
    "modal-open"
  );


  setFormStatus("");

}


/* =========================================================
   RESET
========================================================= */

function resetForm() {

  productForm.reset();


  productId.value =
    "";


  productImageUrl.value =
    "";


  productImagePath.value =
    "";


  productImageFile.value =
    "";


  productPrice.value =
    "0";


  productStock.value =
    "0";


  productFeatured.checked =
    false;


  productPublished.checked =
    true;


  clearImagePreview();


  setFormStatus("");

}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function previewSelectedProductImage() {

  const file =
    productImageFile
      ?.files?.[0];


  if (!file) {
    return;
  }


  const types = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];


  if (
    !types.includes(
      file.type
    )
  ) {

    alert(
      "Use JPG, PNG or WEBP."
    );


    productImageFile.value =
      "";


    return;

  }


  if (
    file.size >
    5 * 1024 * 1024
  ) {

    alert(
      "Image must be below 5 MB."
    );


    productImageFile.value =
      "";


    return;

  }


  const localUrl =
    URL.createObjectURL(
      file
    );


  showImagePreview(
    localUrl,
    file.name,
    false
  );

}


/* =========================================================
   SHOW IMAGE PREVIEW
========================================================= */

function showImagePreview(
  url,
  label,
  existing
) {

  productImagePreview.innerHTML =
    "";


  const card =
    document.createElement(
      "div"
    );


  card.className =
    "product-image-preview-card";


  const image =
    document.createElement(
      "img"
    );


  image.src =
    url;


  image.alt =
    "Product image preview";


  image.className =
    "product-image-preview-image";


  const info =
    document.createElement(
      "div"
    );


  info.className =
    "product-image-preview-info";


  const title =
    document.createElement(
      "strong"
    );


  title.textContent =
    existing
      ? "Current Product Image"
      : "New Product Image";


  const text =
    document.createElement(
      "span"
    );


  text.textContent =
    label ||
    "Product image";


  const remove =
    document.createElement(
      "button"
    );


  remove.type =
    "button";


  remove.className =
    "remove-product-image-btn";


  remove.innerHTML =
    `
      <i class="fa-solid fa-trash"></i>
      Remove Image
    `;


  remove.addEventListener(
    "click",
    removeProductImage
  );


  info.append(
    title,
    text,
    remove
  );


  card.append(
    image,
    info
  );


  productImagePreview.appendChild(
    card
  );


  productImagePreview.classList.add(
    "visible"
  );

}


/* =========================================================
   CLEAR PREVIEW
========================================================= */

function clearImagePreview() {

  productImagePreview.innerHTML =
    "";


  productImagePreview.classList.remove(
    "visible"
  );

}


/* =========================================================
   REMOVE IMAGE
========================================================= */

function removeProductImage() {

  productImageFile.value =
    "";


  productImageUrl.value =
    "";


  /*
    Keep path temporarily so
    saveProduct can delete it
    if necessary.
  */

  clearImagePreview();

}


/* =========================================================
   UPLOAD IMAGE
========================================================= */

async function uploadProductImage(
  file
) {

  if (!file) {

    return {
      publicUrl:
        productImageUrl.value ||
        null,

      path:
        productImagePath.value ||
        null
    };

  }


  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();


  const safeExt =
    extension === "jpeg"
      ? "jpg"
      : extension;


  const fileName =
    `${crypto.randomUUID()}.${safeExt}`;


  const path =
    `products/${fileName}`;


  const {
    error
  } =
    await supabase
      .storage
      .from("product-images")
      .upload(
        path,
        file,
        {
          cacheControl: "3600",
          upsert: false,
          contentType:
            file.type
        }
      );


  if (error) {

    throw error;

  }


  const {
    data
  } =
    supabase
      .storage
      .from("product-images")
      .getPublicUrl(
        path
      );


  return {

    publicUrl:
      data.publicUrl,

    path

  };

}


/* =========================================================
   DELETE STORAGE IMAGE
========================================================= */

async function deleteStorageImage(
  path
) {

  if (!path) {
    return;
  }


  const {
    error
  } =
    await supabase
      .storage
      .from("product-images")
      .remove([
        path
      ]);


  if (error) {

    console.warn(
      "Could not remove old product image:",
      error
    );

  }

}


/* =========================================================
   SAVE PRODUCT
========================================================= */

async function saveProduct(
  event
) {

  event.preventDefault();


  if (!supabase) {

    setFormStatus(
      "Database not connected.",
      true
    );

    return;

  }


  const name =
    productName.value
      .trim();


  const category =
    productCategory.value;


  if (!name) {

    setFormStatus(
      "Enter a product name.",
      true
    );

    return;

  }


  if (!category) {

    setFormStatus(
      "Select a category.",
      true
    );

    return;

  }


  setSaving(true);


  try {

    const privacyPolicyUrl =
      getOptionalPolicyUrl(
        productPrivacyPolicyUrl.value,
        "Privacy Policy"
      );

    const termsOfUseUrl =
      getOptionalPolicyUrl(
        productTermsOfUseUrl.value,
        "Terms of Use"
      );

    const accountDeletionUrl =
      getOptionalPolicyUrl(
        productAccountDeletionUrl.value,
        "Account Deletion"
      );

    const childSafetyUrl =
      getOptionalPolicyUrl(
        productChildSafetyUrl.value,
        "Child Safety Standards"
      );


    const originalProduct =
      products.find(
        item =>
          item.id ===
          productId.value
      );


    let imageUrl =
      productImageUrl.value ||
      null;


    let imagePath =
      productImagePath.value ||
      null;


    const selectedFile =
      productImageFile
        ?.files?.[0];


    if (selectedFile) {

      setFormStatus(
        "Uploading product image..."
      );


      const uploaded =
        await uploadProductImage(
          selectedFile
        );


      imageUrl =
        uploaded.publicUrl;


      imagePath =
        uploaded.path;


      /*
        Delete old image after
        replacement upload succeeded.
      */

      if (
        originalProduct?.image_path &&
        originalProduct.image_path !==
          imagePath
      ) {

        await deleteStorageImage(
          originalProduct.image_path
        );

      }

    }


    /*
      Image was manually removed.
    */

    if (
      originalProduct?.image_url &&
      !imageUrl &&
      originalProduct.image_path
    ) {

      await deleteStorageImage(
        originalProduct.image_path
      );


      imagePath =
        null;

    }


    const tags =
      productTags.value
        .split(",")
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean);

    const payload = {

      name,

      category,

      sku:
        productSku.value
          .trim() ||
        null,

      description:
        productDescription.value
          .trim() ||
        null,

      price:
        Number(
          productPrice.value ||
          0
        ),

      stock:
        Number(
          productStock.value ||
          0
        ),

      image_url:
        imageUrl,

      image_path:
        imagePath,

      tags,

      privacy_policy_url:
        privacyPolicyUrl,

      terms_of_use_url:
        termsOfUseUrl,

      account_deletion_url:
        accountDeletionUrl,

      child_safety_url:
        childSafetyUrl,

      featured:
        productFeatured.checked,

      published:
        productPublished.checked,

      updated_at:
        new Date()
          .toISOString()

    };


    setFormStatus(
      productId.value
        ? "Updating product..."
        : "Creating product..."
    );


    let result;


    if (productId.value) {

      result =
        await supabase
          .from("products")
          .update(payload)
          .eq(
            "id",
            productId.value
          );

    }

    else {

      result =
        await supabase
          .from("products")
          .insert([
            payload
          ]);

    }


    if (result.error) {

      if (
        result.error.code === "PGRST204" ||
        result.error.code === "42703"
      ) {
        throw new Error(
          "The products table is missing policy link columns. Apply supabase/migrations/20261009_add_product_policy_links.sql, then try again."
        );
      }

      throw result.error;

    }


    closeModal();


    await loadProducts();

  }

  catch (error) {

    console.error(
      error
    );


    setFormStatus(
      `Could not save product: ${
        error.message
      }`,
      true
    );

  }

  finally {

    setSaving(false);

  }

}


function getOptionalPolicyUrl(
  value,
  label
) {

  const url =
    value.trim();


  if (!url) {
    return null;
  }


  if (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.includes("\\")
  ) {
    return url;
  }


  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      `${label} URL must be an https URL or a site path beginning with /.`
    );
  }


  if (
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      `${label} URL must use https.`
    );
  }


  return parsedUrl.href;

}


/* =========================================================
   PUBLISH
========================================================= */

async function togglePublish(
  product
) {

  const {
    error
  } =
    await supabase
      .from("products")
      .update({

        published:
          !product.published,

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        "id",
        product.id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await loadProducts();

}


/* =========================================================
   DELETE PRODUCT
========================================================= */

async function deleteProduct(
  product
) {

  const confirmed =
    confirm(
      `Delete "${product.name}"?`
    );


  if (!confirmed) {
    return;
  }


  try {

    if (product.image_path) {

      await deleteStorageImage(
        product.image_path
      );

    }


    const {
      error
    } =
      await supabase
        .from("products")
        .delete()
        .eq(
          "id",
          product.id
        );


    if (error) {
      throw error;
    }


    await loadProducts();

  }

  catch (error) {

    alert(
      error.message
    );

  }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutAdmin() {

  try {

    await supabase
      ?.auth
      .signOut();

  }

  finally {

    window.location.replace(
      "index.html"
    );

  }

}


/* =========================================================
   HELPERS
========================================================= */

function setProductsStatus(
  message,
  error = false
) {

  productsStatus.style.display =
    "block";


  productsStatus.textContent =
    message;


  productsStatus.style.color =
    error
      ? "#dc2626"
      : "";

}


function hideProductsStatus() {

  productsStatus.style.display =
    "none";

}


function setFormStatus(
  message,
  error = false
) {

  formStatus.textContent =
    message;


  formStatus.classList.toggle(
    "error",
    error
  );

}


function setSaving(
  saving
) {

  saveProductBtn.disabled =
    saving;


  saveProductBtn.innerHTML =
    saving
      ? `
          <i class="fa-solid fa-spinner fa-spin"></i>
          Saving...
        `
      : `
          <i class="fa-solid fa-floppy-disk"></i>
          Save Product
        `;

}


function formatPrice(
  value
) {

  const number =
    Number(value || 0);


  if (number <= 0) {

    return "Contact";

  }


  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD"
    }
  ).format(number);

}


function escapeHtml(
  value
) {

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}