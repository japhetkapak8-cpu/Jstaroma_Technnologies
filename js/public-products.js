import { supabase }
from "./supabase.js";


let products = [];
let filteredProducts = [];


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
    numericPrice > 0
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


  meta.append(
    price,
    availability
  );


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
      "a"
    );


  primary.href =
    "index.html#contact";


  primary.className =
    "product-primary-btn";


  primary.innerHTML =
    `
      Contact About Product
      <i class="fa-solid fa-arrow-right"></i>
    `;


  actions.appendChild(
    primary
  );


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