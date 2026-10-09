import { supabase }
from "./supabase.js";


let products = [];
let filteredProducts = [];

// Add Wantok Chat's published Google Play URL here when it is available.
const wantokPlayStoreUrl = "";


const grid =
  document.getElementById(
    "productsGrid"
  );

const statusElement =
  document.getElementById(
    "productStatus"
  );

const searchInput =
  document.getElementById(
    "productSearch"
  );

const categoryFilter =
  document.getElementById(
    "productCategoryFilter"
  );


async function loadProducts() {

  setStatus(
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


    filterProducts();

  }

  catch (error) {

    console.error(
      "Product loading error:",
      error
    );


    products = [];

    filteredProducts = [];


    if (grid) {
      grid.innerHTML = "";
    }


    setStatus(
      "Products are currently unavailable."
    );

  }

}


function filterProducts() {

  const search =
    (
      searchInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const category =
    categoryFilter?.value ||
    "All";


  filteredProducts =
    products.filter(
      product => {

        const searchText =
          [
            product.name,
            product.category,
            product.description,
            product.sku,
            ...(
              Array.isArray(
                product.tags
              )
                ? product.tags
                : []
            )
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        const matchesSearch =
          !search ||
          searchText.includes(
            search
          );


        const matchesCategory =
          category === "All" ||
          product.category === category;


        return (
          matchesSearch &&
          matchesCategory
        );

      }
    );


  renderProducts();

}


function renderProducts() {

  if (!grid) {
    return;
  }


  grid.innerHTML = "";


  if (
    filteredProducts.length === 0
  ) {

    setStatus(
      products.length === 0
        ? "No products are available yet."
        : "No products match your search."
    );

    return;

  }


  hideStatus();


  filteredProducts.forEach(
    product => {

      const card =
        createProductCard(
          product
        );


      grid.appendChild(
        card
      );

    }
  );

}


function createProductCard(
  product
) {

  const article =
    document.createElement(
      "article"
    );


  article.className =
    "jstaroma-product-card dynamic-product-card";


  const content =
    document.createElement(
      "div"
    );


  content.className =
    "product-content";


  const top =
    document.createElement(
      "div"
    );


  top.className =
    "product-card-top";


  const logo =
    document.createElement(
      "div"
    );


  logo.className =
    "product-logo";


  logo.textContent =
    getProductInitials(
      product.name
    );


  const status =
    document.createElement(
      "span"
    );


  status.className =
    "product-status";


  const stock =
    Number(
      product.stock || 0
    );


  if (stock > 0) {

    status.textContent =
      "AVAILABLE";

    status.classList.add(
      "available"
    );

  } else {

    status.textContent =
      "COMING SOON";

    status.classList.add(
      "coming-soon"
    );

  }


  top.append(
    logo,
    status
  );


  const type =
    document.createElement(
      "span"
    );


  type.className =
    "product-type";


  type.textContent =
    product.category ||
    "JSTAROMA PRODUCT";


  const title =
    document.createElement(
      "h3"
    );


  title.textContent =
    product.name ||
    "JStaroma Product";


  const description =
    document.createElement(
      "p"
    );


  description.className =
    "product-description";


  description.textContent =
    product.description ||
    "Technology developed by JStaroma Technologies.";


  content.append(
    top,
    type,
    title,
    description
  );


  if (
    Array.isArray(
      product.tags
    ) &&
    product.tags.length > 0
  ) {

    const features =
      document.createElement(
        "div"
      );


    features.className =
      "product-features";


    product.tags
      .slice(0, 4)
      .forEach(
        tag => {

          const item =
            document.createElement(
              "span"
            );


          const icon =
            document.createElement(
              "i"
            );


          icon.className =
            getTagIcon(
              tag
            );


          const text =
            document.createTextNode(
              String(tag)
            );


          item.append(
            icon,
            text
          );


          features.appendChild(
            item
          );

        }
      );


    content.appendChild(
      features
    );

  }


  const productText =
    [
      product.name,
      product.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const isWantokChat =
    productText.includes("wantok chat");

  const meta =
    document.createElement(
      "div"
    );


  meta.className =
    "public-product-meta";


  const price =
    document.createElement(
      "strong"
    );


  price.className =
    "public-product-price";


  const numericPrice =
    Number(
      product.price || 0
    );


  price.textContent =
    isWantokChat
      ? "Download on Google Play"
      : numericPrice > 0
      ? formatCurrency(
          numericPrice
        )
      : "Contact for pricing";


  const availability =
    document.createElement(
      "span"
    );


  availability.className =
    stock > 0
      ? "public-product-stock available"
      : "public-product-stock unavailable";


  availability.textContent =
    stock > 0
      ? `${stock} available`
      : "Currently unavailable";


  meta.appendChild(price);

  if (!isWantokChat) {
    meta.appendChild(availability);
  }


  content.appendChild(
    meta
  );


  const actions =
    document.createElement(
      "div"
    );


  actions.className =
    "product-actions";


  const primary =
    document.createElement(
      isWantokChat && !wantokPlayStoreUrl
        ? "button"
        : "a"
    );

  primary.className =
    "product-primary-btn";

  if (isWantokChat && !wantokPlayStoreUrl) {
    primary.type = "button";
    primary.disabled = true;
    primary.textContent = "Play Store link coming soon";
  } else {
    primary.href =
      isWantokChat
        ? wantokPlayStoreUrl
        : "index.html#contact";

    if (isWantokChat) {
      primary.target = "_blank";
      primary.rel = "noopener noreferrer";
    }

    primary.innerHTML =
      `
        ${isWantokChat ? "Download on Google Play" : "Contact About Product"}
        <i class="fa-solid fa-arrow-right"></i>
      `;
  }


  actions.appendChild(
    primary
  );


  const configuredPolicyLinks =
    [
      {
        label: "Privacy Policy",
        url: product.privacy_policy_url
      },
      {
        label: "Terms of Use",
        url: product.terms_of_use_url
      },
      {
        label: "Account Deletion",
        url: product.account_deletion_url
      },
      {
        label: "Child Safety Standards",
        url: product.child_safety_url
      }
    ]
      .filter(
        policy => Boolean(policy.url)
      );


  const defaultPolicyLinks =
    configuredPolicyLinks.length === 0 &&
    isWantokChat
      ? [
          {
            label: "Privacy Policy",
            url: "/privacy/"
          },
          {
            label: "Terms of Use",
            url: "/terms/"
          },
          {
            label: "Account Deletion",
            url: "/account-deletion/"
          },
          {
            label: "Child Safety Standards",
            url: "/child-safety/"
          }
        ]
      : [];


  const visiblePolicyLinks =
    configuredPolicyLinks.length > 0
      ? configuredPolicyLinks
      : defaultPolicyLinks;


  if (
    visiblePolicyLinks.length > 0
  ) {

    const legalLinks =
      document.createElement(
        "div"
      );


    legalLinks.className =
      "product-legal-links";


    visiblePolicyLinks.forEach(
      policy => {

      const safeUrl =
        getSafePolicyUrl(
          policy.url
        );


      if (!safeUrl) {
        return;
      }


      const link =
        document.createElement(
          "a"
        );


      link.href =
        safeUrl;


      link.textContent =
        policy.label;


      if (
        safeUrl.startsWith("https://") ||
        safeUrl.startsWith("http://")
      ) {
        link.target =
          "_blank";

        link.rel =
          "noopener noreferrer";
      }


      legalLinks.appendChild(
        link
      );

      }
    );


    if (legalLinks.childElementCount > 0) {
      actions.appendChild(
        legalLinks
      );
    }

  }


  content.appendChild(
    actions
  );


  const visual =
    document.createElement(
      "div"
    );


  visual.className =
    "product-visual dynamic-product-visual";


  if (product.image_url) {

    const image =
      document.createElement(
        "img"
      );


    image.className =
      "dynamic-product-image";


    image.src =
      product.image_url;


    image.alt =
      product.name ||
      "JStaroma product";


    image.loading =
      "lazy";


    image.addEventListener(
      "error",
      () => {

        renderProductPlaceholder(
          visual,
          product
        );

      }
    );


    visual.appendChild(
      image
    );

  } else {

    renderProductPlaceholder(
      visual,
      product
    );

  }


  article.append(
    content,
    visual
  );


  return article;

}


function getSafePolicyUrl(
  value
) {

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return "";
  }


  const url =
    value.trim();


  if (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.includes("\\")
  ) {
    return url;
  }


  try {
    const parsedUrl =
      new URL(url);

    if (
    parsedUrl.protocol === "https:" ||
    parsedUrl.protocol === "http:"
    ) {
    return parsedUrl.href;
    }
  } catch {
    return "";
  }


  return "";

}


function renderProductPlaceholder(
  visual,
  product
) {

  visual.innerHTML = "";


  const placeholder =
    document.createElement(
      "div"
    );


  placeholder.className =
    "dynamic-product-placeholder";


  const icon =
    document.createElement(
      "i"
    );


  icon.className =
    getCategoryIcon(
      product.category
    );


  const label =
    document.createElement(
      "span"
    );


  label.textContent =
    product.category ||
    "JStaroma Technology";


  placeholder.append(
    icon,
    label
  );


  visual.appendChild(
    placeholder
  );

}


function getProductInitials(
  name
) {

  if (!name) {
    return "JS";
  }


  const words =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);


  if (
    words.length === 1
  ) {

    return words[0]
      .substring(
        0,
        2
      )
      .toUpperCase();

  }


  return (
    words[0][0] +
    words[1][0]
  ).toUpperCase();

}


function getCategoryIcon(
  category
) {

  switch (category) {

    case "GIS":
      return "fa-solid fa-earth-americas";

    case "Software":
      return "fa-solid fa-laptop-code";

    case "Drone":
      return "fa-solid fa-plane-up";

    case "Data":
      return "fa-solid fa-database";

    case "Service":
      return "fa-solid fa-gears";

    default:
      return "fa-solid fa-cubes";

  }

}


function getTagIcon(
  tag
) {

  const value =
    String(
      tag || ""
    ).toLowerCase();


  if (
    value.includes("gis") ||
    value.includes("map")
  ) {
    return "fa-solid fa-earth-americas";
  }


  if (
    value.includes("data") ||
    value.includes("sql")
  ) {
    return "fa-solid fa-database";
  }


  if (
    value.includes("drone") ||
    value.includes("uas")
  ) {
    return "fa-solid fa-plane-up";
  }


  if (
    value.includes("image")
  ) {
    return "fa-solid fa-image";
  }


  if (
    value.includes("dashboard")
  ) {
    return "fa-solid fa-chart-column";
  }


  if (
    value.includes("design") ||
    value.includes("brand")
  ) {
    return "fa-solid fa-palette";
  }


  if (
    value.includes("web")
  ) {
    return "fa-solid fa-globe";
  }


  if (
    value.includes("code") ||
    value.includes("program")
  ) {
    return "fa-solid fa-code";
  }


  return "fa-solid fa-check";

}


function formatCurrency(
  value
) {

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD"
    }
  ).format(
    value
  );

}


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

  if (statusElement) {
    statusElement.style.display =
      "none";
  }

}


searchInput
  ?.addEventListener(
    "input",
    filterProducts
  );


categoryFilter
  ?.addEventListener(
    "change",
    filterProducts
  );


loadProducts();