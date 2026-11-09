const NS = "http://www.w3.org/2000/svg";
let provinceData = null;
let updatePngMap = null;

export function renderProvinceMap(data) {
  provinceData = data;
  if (updatePngMap) updatePngMap();
}

function svg(name, attributes = {}) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function featureName(feature, kind) {
  return kind === "png" ? feature.properties.shapeName : feature.properties.ADMIN;
}

export function projectCoordinate(coordinate) {
  if (!Array.isArray(coordinate) || coordinate.length < 2 ||
      !Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1]) ||
      Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90) {
    throw new Error("Invalid geographic coordinate.");
  }
  const [longitude, latitude] = coordinate;
  const lat = Math.max(-80, Math.min(80, latitude)) * Math.PI / 180;
  return [longitude, -Math.log(Math.tan(Math.PI / 4 + lat / 2)) * 180 / Math.PI];
}

export function geometryPath(geometry) {
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type) ||
      !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    throw new Error("Unsupported boundary geometry.");
  }
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap(polygon => polygon.map(ring => {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error("Invalid geographic ring.");
    return ring.map((coordinate, index) => {
      const [x, y] = projectCoordinate(coordinate);
      return `${index === 0 ? "M" : "L"}${x.toFixed(4)},${y.toFixed(4)}`;
    }).join(" ") + " Z";
  })).join(" ");
}

export async function initializeMap(container, kind, fetchImpl = fetch) {
  const status = document.getElementById(`${kind}MapStatus`);
  const selection = document.getElementById(`${kind}MapSelection`);
  const leaderboard = document.getElementById(`${kind}Leaderboard`);
  status.textContent = "Loading geographic boundaries...";
  try {
    const response = await fetchImpl(`data/${kind === "png" ? "png-provinces" : "world-countries"}.geojson`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error("Boundary download failed.");
    const data = await response.json();
    if (data.type !== "FeatureCollection" || !Array.isArray(data.features) || data.features.length === 0 ||
        (kind === "png" && data.features.length !== 22)) throw new Error("Invalid boundary coverage.");
    const map = svg("svg", { role: "group", "aria-label": kind === "png" ? "PNG province map" : "World country map" });
    const coordinates = data.features.flatMap(feature =>
      (feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates)
        .flat(2).map(projectCoordinate));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of coordinates) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const initial = { x: minX - 1, y: minY - 1, width: maxX - minX + 2, height: maxY - minY + 2 };
    let view = { ...initial };
    const setView = () => map.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
    setView();
    let selectedName = null;
    const describe = name => {
      if (kind === "png" && provinceData?.status === "available") {
        const row = provinceData.rows.find(item => item.name === name);
        return `${name}: ${new Intl.NumberFormat().format(row.count)} profiles`;
      }
      return `${name}: Not connected`;
    };
    const choose = (feature, path) => {
      for (const node of map.querySelectorAll("path")) node.classList.remove("selected");
      path.classList.add("selected");
      const name = featureName(feature, kind);
      selectedName = name;
      selection.textContent = describe(name);
    };
    const dropdown = document.createElement("select");
    dropdown.setAttribute("aria-label", kind === "png" ? "Select a province" : "Select a country");
    const placeholder = document.createElement("option");
    placeholder.textContent = "Select a region";
    placeholder.value = "";
    dropdown.append(placeholder);
    const entries = data.features.map(feature => {
      const name = featureName(feature, kind);
      if (typeof name !== "string") throw new Error("Missing boundary name.");
      const path = svg("path", { d: geometryPath(feature.geometry), tabindex: "0", role: "button",
        "aria-label": `${name}: Not connected`, "fill-rule": "evenodd" });
      const title = svg("title");
      title.textContent = `${name}: Not connected`;
      path.append(title);
      path.addEventListener("click", () => choose(feature, path));
      path.addEventListener("keydown", event => {
        if (["Enter", " "].includes(event.key)) { event.preventDefault(); choose(feature, path); }
      });
      path.addEventListener("pointerenter", () => {
        status.textContent = describe(name);
      });
      map.append(path);
      return { name, feature, path };
    }).sort((a, b) => a.name.localeCompare(b.name));
    for (const [index, entry] of entries.entries()) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = entry.name;
      dropdown.append(option);
    }
    dropdown.addEventListener("change", () => {
      if (dropdown.value === "") return;
      const entry = entries[Number(dropdown.value)];
      choose(entry.feature, entry.path);
    });
    const controls = document.createElement("div");
    controls.className = "map-controls";
    const zoom = factor => {
      const width = Math.min(initial.width, Math.max(initial.width / 16, view.width * factor));
      const height = width / initial.width * initial.height;
      view = { x: view.x + (view.width - width) / 2, y: view.y + (view.height - height) / 2, width, height };
      setView();
    };
    for (const [label, action] of [
      ["Zoom in", () => zoom(0.7)], ["Zoom out", () => zoom(1 / 0.7)],
      ["Reset map", () => { view = { ...initial }; setView(); }]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", action);
      controls.append(button);
    }
    map.addEventListener("wheel", event => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoom(event.deltaY < 0 ? 0.8 : 1.25);
    }, { passive: false });
    let drag = null;
    map.addEventListener("pointerdown", event => {
      drag = { x: event.clientX, y: event.clientY, view: { ...view } };
    });
    map.addEventListener("pointermove", event => {
      if (!drag || !(event.buttons & 1)) return;
      const bounds = map.getBoundingClientRect();
      view.x = drag.view.x - (event.clientX - drag.x) / bounds.width * view.width;
      view.y = drag.view.y - (event.clientY - drag.y) / bounds.height * view.height;
      setView();
    });
    map.addEventListener("pointerup", () => { drag = null; });
    map.addEventListener("pointerleave", () => { drag = null; });
    container.replaceChildren(controls, dropdown, map);
    const table = document.createElement("table");
    table.className = "analytics-table";
    const caption = document.createElement("caption");
    caption.textContent = "Region directory (not ranked until user counts are verified)";
    table.append(caption);
    const head = document.createElement("thead");
    const header = document.createElement("tr");
    for (const text of ["Region", "Users", "Share", "Growth"]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = text;
      header.append(cell);
    }
    head.append(header);
    table.append(head);
    const body = document.createElement("tbody");
    for (const name of [...entries.map(entry => entry.name), "Unknown"]) {
      const row = document.createElement("tr");
      for (const [index, text] of [name, "Not connected", "Not connected", "Not connected"].entries()) {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = text;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
    leaderboard.replaceChildren(table);
    const update = () => {
      const available = kind === "png" && provinceData?.status === "available";
      const values = available ? new Map(provinceData.rows.map(row => [row.name, row.count])) : null;
      const maximum = available ? Math.max(...provinceData.rows.slice(0, -1).map(row => row.count), 1) : 1;
      for (const entry of entries) {
        const description = describe(entry.name);
        entry.path.setAttribute("aria-label", description);
        entry.path.querySelector("title").textContent = description;
        if (available) {
          const count = values.get(entry.name);
          const intensity = count / maximum;
          entry.path.style.fill = count === 0 ? "#29354a" : `hsl(265 75% ${75 - intensity * 35}%)`;
        } else entry.path.style.removeProperty("fill");
      }
      caption.textContent = available ? "Current profile distribution" : "Region directory (not ranked until user counts are verified)";
      for (const [index, name] of [...entries.map(entry => entry.name), "Unknown"].entries()) {
        const row = body.children[index];
        const count = available ? values.get(name === "Unknown" ? "Unknown / Not Set" : name) : null;
        row.children[1].textContent = available ? new Intl.NumberFormat().format(count) : "Not connected";
        row.children[2].textContent = available && provinceData.total
          ? new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(count / provinceData.total)
          : available ? "—" : "Not connected";
      }
      if (selectedName) selection.textContent = describe(selectedName);
      status.textContent = available
        ? "Current profile counts by province; darker purple means more profiles. Ctrl + scroll to zoom; drag to pan."
        : "Boundaries loaded. Counts and rankings: Not connected. Grey means unavailable, blue means selection. Ctrl + scroll to zoom; drag to pan.";
    };
    if (kind === "png") updatePngMap = update;
    update();
  }
  catch (error) {
    console.error("Could not load analytics map:", error);
    container.textContent = "Map unavailable.";
    status.textContent = "Boundary loading error. Reload the page to retry; no user location data is displayed.";
    status.classList.add("analytics-error");
  }
}
