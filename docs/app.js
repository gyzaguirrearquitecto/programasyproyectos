/* Requisitos del Estado Peruano - App estática para GitHub Pages
   - Carga dataset curado: docs/data/manual.json
   - (Opcional) Carga dataset generado: docs/data/catalog.json
*/

const state = {
  manual: null,
  catalog: null,
  selectedSlug: null,
  selectedProgram: null,
  q: "",
  onlyCurated: false,
};

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.json();
}

async function init() {
  try {
    state.manual = await loadJson("./data/manual.json");
  } catch (e) {
    console.error(e);
    $("status").textContent = "No se pudo cargar manual.json. Revisa la ruta /docs/data/manual.json.";
    return;
  }

  // Catalog opcional
  try {
    state.catalog = await loadJson("./data/catalog.json");
  } catch (e) {
    state.catalog = null;
  }

  wireUI();
  render();
}

function wireUI() {
  $("q").addEventListener("input", (ev) => {
    state.q = ev.target.value.trim().toLowerCase();
    render();
  });

  $("onlyCurated").addEventListener("change", (ev) => {
    state.onlyCurated = ev.target.checked;
    render();
  });

  $("back").addEventListener("click", () => {
    state.selectedProgram = null;
    renderProgramDetail(null);
    $("programDetail").classList.add("hidden");
    $("back").classList.add("hidden");
  });

  $("tabCurated").addEventListener("click", () => setTab("curated"));
  $("tabCatalog").addEventListener("click", () => setTab("catalog"));
}

function setTab(tab) {
  $("tabCurated").classList.toggle("tab--active", tab === "curated");
  $("tabCatalog").classList.toggle("tab--active", tab === "catalog");
  $("curated").classList.toggle("hidden", tab !== "curated");
  $("catalog").classList.toggle("hidden", tab !== "catalog");
}

function render() {
  renderStatus();
  renderMinistries();
  renderDetail();
}

function renderStatus() {
  const total = state.manual?.ministerios?.length ?? 0;
  const curatedPrograms = (state.manual?.ministerios ?? [])
    .reduce((acc, m) => acc + (m.programas_curados?.length ?? 0), 0);

  const catalogInfo = state.catalog ? " | dataset generado: OK" : " | dataset generado: no";
  $("status").textContent = `Entidades: ${total} | Programas con requisitos (curado): ${curatedPrograms}${catalogInfo}`;
}

function matchesQuery(text) {
  if (!state.q) return true;
  return (text ?? "").toLowerCase().includes(state.q);
}

function renderMinistries() {
  const container = $("ministries");
  container.innerHTML = "";

  const items = (state.manual?.ministerios ?? []).filter((m) => {
    if (state.onlyCurated && (m.programas_curados?.length ?? 0) === 0) return false;
    if (!state.q) return true;

    // match by entity name
    if (matchesQuery(m.nombre)) return true;

    // match by any program title in curated
    for (const p of (m.programas_curados ?? [])) {
      if (matchesQuery(p.nombre) || matchesQuery(p.descripcion)) return true;
    }
    return false;
  });

  for (const m of items) {
    const el = document.createElement("div");
    el.className = "entity";
    el.setAttribute("role", "listitem");
    el.addEventListener("click", () => {
      state.selectedSlug = m.slug_gobpe;
      state.selectedProgram = null;
      $("programDetail").classList.add("hidden");
      $("back").classList.add("hidden");
      renderDetail();
      // En móvil, lleva foco al panel de detalle
      $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const badgeClass = (m.tipo === "pcm") ? "badge badge--pcm" : "badge";
    const curatedCount = (m.programas_curados?.length ?? 0);

    el.innerHTML = `
      <p class="entity__name">${escapeHtml(m.nombre)}</p>
      <div class="entity__meta">
        <span class="${badgeClass}">${escapeHtml(m.tipo === "pcm" ? "PCM" : "Ministerio")}</span>
        <span class="badge">${curatedCount} curados</span>
      </div>
    `;
    container.appendChild(el);
  }

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "notice";
    empty.innerHTML = `<p>No hay resultados para la búsqueda actual.</p>`;
    container.appendChild(empty);
  }
}

function getSelectedEntity() {
  if (!state.selectedSlug) return null;
  return (state.manual?.ministerios ?? []).find((m) => m.slug_gobpe === state.selectedSlug) ?? null;
}

function renderDetail() {
  const entity = getSelectedEntity();
  const emptyState = $("emptyState");
  const detailState = $("detailState");

  if (!entity) {
    emptyState.classList.remove("hidden");
    detailState.classList.add("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  detailState.classList.remove("hidden");

  $("entityName").textContent = entity.nombre;
  $("entityLink").href = entity.url_tramites_servicios;
  $("curatedCount").textContent = `Programas con requisitos cargados: ${(entity.programas_curados?.length ?? 0)}`;

  // Render cards
  renderCuratedPrograms(entity);
  renderCatalogPrograms(entity);

  // Default tab: curated
  setTab("curated");
}

function renderCuratedPrograms(entity) {
  const wrap = $("programs");
  wrap.innerHTML = "";

  const list = (entity.programas_curados ?? []);
  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="notice">
        <p>No hay programas con requisitos cargados para esta entidad en el dataset curado.</p>
        <p>Usa el enlace “Abrir catálogo oficial (gob.pe)” para ver todo lo disponible.</p>
      </div>
    `;
    return;
  }

  for (const p of list) {
    const card = document.createElement("div");
    card.className = "card";
    const short = (p.descripcion ?? "").trim();
    card.innerHTML = `
      <div class="card__top">
        <h3 class="card__title">${escapeHtml(p.nombre)}</h3>
      </div>
      <p class="card__sub">${escapeHtml(short)}</p>
      <div class="card__actions">
        <button class="pill" type="button" data-action="view">Ver requisitos</button>
        ${p.fuente ? `<a class="pill" href="${p.fuente}" target="_blank" rel="noopener noreferrer">Abrir fuente</a>` : ``}
      </div>
    `;
    card.querySelector("[data-action='view']").addEventListener("click", () => {
      state.selectedProgram = p;
      renderProgramDetail(p);
      $("programDetail").classList.remove("hidden");
      $("back").classList.remove("hidden");
      $("programDetail").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    wrap.appendChild(card);
  }
}

function normalizeCatalog() {
  // Admite dos formatos:
  // A) { meta, entities: { [slug]: [ { title, description, requirements, source_url } ] } }
  // B) { meta, ministerios: [ { slug_gobpe, programas: [...] } ] }
  if (!state.catalog) return { entities: {} };

  if (state.catalog.entities && typeof state.catalog.entities === "object") {
    return { entities: state.catalog.entities };
  }

  if (Array.isArray(state.catalog.ministerios)) {
    const entities = {};
    for (const m of state.catalog.ministerios) {
      if (!m?.slug_gobpe) continue;
      entities[m.slug_gobpe] = m.programas ?? m.programas_curados ?? [];
    }
    return { entities };
  }

  return { entities: {} };
}

function renderCatalogPrograms(entity) {
  const wrap = $("catalogPrograms");
  wrap.innerHTML = "";

  const norm = normalizeCatalog();
  const items = (norm.entities[entity.slug_gobpe] ?? []);

  if (!state.catalog) {
    wrap.innerHTML = `
      <div class="notice">
        <p><strong>No existe</strong> <code>docs/data/catalog.json</code>.</p>
        <p>Para generarlo: revisa <code>tools/README.md</code> dentro del ZIP.</p>
      </div>
    `;
    return;
  }

  if (items.length === 0) {
    wrap.innerHTML = `
      <div class="notice">
        <p>No hay entradas para esta entidad en <code>catalog.json</code>.</p>
        <p>Regenera el dataset filtrando por el slug: <code>${escapeHtml(entity.slug_gobpe)}</code>.</p>
      </div>
    `;
    return;
  }

  for (const p of items) {
    const title = p.title ?? p.nombre ?? "Sin título";
    const desc = p.description ?? p.descripcion ?? "";
    const source = p.source_url ?? p.fuente ?? "";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card__top">
        <h3 class="card__title">${escapeHtml(title)}</h3>
      </div>
      <p class="card__sub">${escapeHtml(desc)}</p>
      <div class="card__actions">
        <button class="pill" type="button" data-action="view">Ver requisitos</button>
        ${source ? `<a class="pill" href="${source}" target="_blank" rel="noopener noreferrer">Abrir fuente</a>` : ``}
      </div>
    `;
    card.querySelector("[data-action='view']").addEventListener("click", () => {
      // Homologar al formato de render
      const program = {
        nombre: title,
        descripcion: desc,
        requisitos: p.requirements ?? p.requisitos ?? [],
        fuente: source
      };
      state.selectedProgram = program;
      renderProgramDetail(program);
      $("programDetail").classList.remove("hidden");
      $("back").classList.remove("hidden");
      $("programDetail").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    wrap.appendChild(card);
  }
}

function renderProgramDetail(p) {
  if (!p) return;

  $("programTitle").textContent = p.nombre ?? "Programa";
  $("programDesc").textContent = p.descripcion ?? "";

  const link = $("programSource");
  if (p.fuente) {
    link.href = p.fuente;
    link.classList.remove("hidden");
  } else {
    link.href = "#";
    link.classList.add("hidden");
  }

  const list = $("programReqs");
  list.innerHTML = "";

  const reqs = (p.requisitos ?? []);
  if (!Array.isArray(reqs) || reqs.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No se encontraron requisitos estructurados en el dataset. Revisa la fuente oficial.";
    list.appendChild(li);
    return;
  }

  for (const r of reqs) {
    const li = document.createElement("li");
    li.textContent = r;
    list.appendChild(li);
  }
}

init();
