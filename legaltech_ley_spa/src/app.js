// LegalTech — Ley (MVP) — SPA estática
// Modo B: solo resúmenes operativos (texto_resumen) + enlaces a la fuente.
// Persistencia: LocalStorage (proyectos, checklist, override de dataset)

const LS = {
  projects: 'lt.projects.v1',
  active: 'lt.active_project_id.v1',
  dsOverride: 'lt.dataset_override.v1',
};

const state = {
  law: null,
  rules: null,
  searchIndex: [],
  projects: [],
  activeProjectId: null,
};

const elApp = () => document.getElementById('app');
const esc = (s) => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function toast(t, m){
  const host = document.getElementById('toastHost');
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerHTML = `<div class="t">${esc(t)}</div><div class="m">${esc(m)}</div>`;
  host.appendChild(d);
  setTimeout(()=>{ d.style.opacity='0'; d.style.transition='opacity .25s'; }, 3200);
  setTimeout(()=>d.remove(), 3700);
}

function uid(prefix='ID'){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function safeParse(raw, fallback){
  if(!raw) return fallback;
  try{ return JSON.parse(raw); }catch{ return fallback; }
}

function loadProjects(){
  state.projects = safeParse(localStorage.getItem(LS.projects), []) || [];
  state.activeProjectId = localStorage.getItem(LS.active) || null;
}

function saveProjects(){
  localStorage.setItem(LS.projects, JSON.stringify(state.projects));
  localStorage.setItem(LS.active, state.activeProjectId || '');
}

function getActiveProject(){
  return state.projects.find(p=>p.id === state.activeProjectId) || null;
}

function buildSearchIndex(){
  const items = [];
  walk(state.law.estructura, (sec)=>{
    items.push({ kind:'section', id:sec.id, title:`${labelFor(sec)} — ${sec.nombre||''}`.trim(), text:(sec.texto_resumen||'').toLowerCase() });
    for(const r of (sec.requisitos||[])){
      items.push({ kind:'requirement', id:r.id, title:r.nombre||r.id, text:`${r.nombre||''} ${r.descripcion||''} ${r.entidad||''}`.toLowerCase(), base:sec.id });
    }
  });
  state.searchIndex = items;
}

function search(q, kind='all'){
  const qq = (q||'').trim().toLowerCase();
  if(!qq) return [];
  const tks = qq.split(/\s+/).filter(Boolean);
  const scored = [];
  for(const it of state.searchIndex){
    if(kind !== 'all' && it.kind !== kind) continue;
    let s = 0;
    for(const tk of tks){
      if((it.title||'').toLowerCase().includes(tk)) s += 3;
      if((it.text||'').includes(tk)) s += 1;
    }
    if(s>0) scored.push({it, s});
  }
  scored.sort((a,b)=>b.s-a.s);
  return scored.slice(0, 50).map(x=>x.it);
}

function walk(sections, fn){
  for(const s of (sections||[])){
    fn(s);
    if(s.children?.length) walk(s.children, fn);
  }
}

function labelFor(sec){
  const t = (sec.tipo||'sección');
  const n = sec.numero ? ` ${sec.numero}` : '';
  return (t[0].toUpperCase()+t.slice(1))+n;
}

// -------------------- Dataset --------------------
async function fetchJson(path){
  const res = await fetch(path, { cache:'no-store' });
  if(!res.ok) throw new Error(`No se pudo cargar ${path} (${res.status})`);
  return await res.json();
}

function validateDataset(law, rules){
  const errs = [];
  for(const k of ['id','nombre','version','fuente_url','fecha_vigencia','estructura']){
    if(!(k in (law||{}))) errs.push(`LawDocument: falta ${k}`);
  }
  if(!Array.isArray(law?.estructura)) errs.push('LawDocument: estructura debe ser array');
  if(!rules?.wizard?.questions) errs.push('Rules: falta wizard.questions');
  if(!rules?.modalities) errs.push('Rules: falta modalities');
  if(!Array.isArray(rules?.stage_templates)) errs.push('Rules: stage_templates debe ser array');
  return errs;
}

async function loadDataset(){
  const ov = safeParse(localStorage.getItem(LS.dsOverride), null);
  if(ov?.law && ov?.rules){
    const errs = validateDataset(ov.law, ov.rules);
    if(errs.length) throw new Error('Dataset override inválido: ' + errs.join(' | '));
    return { law: ov.law, rules: ov.rules, source:'override' };
  }
  const [law, rules] = await Promise.all([fetchJson('./data/law.sample.json'), fetchJson('./data/rules.sample.json')]);
  const errs = validateDataset(law, rules);
  if(errs.length) throw new Error('Dataset /data inválido: ' + errs.join(' | '));
  return { law, rules, source:'data' };
}

// -------------------- Router --------------------
const routes = {
  '/': viewHome,
  '/library': viewLibrary,
  '/wizard': viewWizard,
  '/project': viewProject,
  '/checklist': viewChecklist,
  '/export': viewExport,
  '/settings': viewSettings,
};

function parseHash(){
  const raw = (location.hash || '#/').slice(1);
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query || '');
  return { path: path || '/', params };
}

function renderNav(){
  const nav = document.getElementById('nav');
  const count = state.projects.length;
  nav.innerHTML = `
    <nav class="nav">
      <div class="sec">Navegación</div>
      <a href="#/" data-r="/" class="r">Inicio <span class="badge" style="margin-left:auto">${count}</span></a>
      <a href="#/library" data-r="/library" class="r">Biblioteca normativa</a>
      <a href="#/wizard" data-r="/wizard" class="r">Calculadora (Wizard)</a>
      <div class="sec">Proyecto</div>
      <a href="#/project" data-r="/project" class="r">Nuevo / Editar</a>
      <a href="#/checklist" data-r="/checklist" class="r">Checklist</a>
      <a href="#/export" data-r="/export" class="r">Exportación</a>
      <div class="sec">Sistema</div>
      <a href="#/settings" data-r="/settings" class="r">Configuración</a>
      <div class="notice" style="margin-top:10px">
        <b>Atajos</b><br>
        <span class="kbd">Ctrl/⌘</span> + <span class="kbd">K</span> búsqueda
      </div>
    </nav>
  `;
}

function highlightNav(){
  const r = (location.hash || '#/').slice(1).split('?')[0] || '/';
  document.querySelectorAll('#nav a.r').forEach(a=>{
    a.classList.toggle('active', a.dataset.r === r);
  });
}

function go(){
  const { path, params } = parseHash();
  const fn = routes[path] || viewHome;
  elApp().innerHTML = '';
  elApp().appendChild(fn(params));
  renderNav();
  highlightNav();
}

window.addEventListener('hashchange', go);

// -------------------- Global Search (modal-less) --------------------
function bindSearch(){
  const input = document.getElementById('q');
  const btn = document.getElementById('btnSearch');

  const run = ()=>{
    const q = input.value;
    const found = search(q, 'all');
    if(!found.length){ toast('Búsqueda', 'Sin resultados'); return; }
    // open first result
    const first = found[0];
    if(first.kind === 'section') location.hash = `#/library?sid=${encodeURIComponent(first.id)}`;
    else location.hash = `#/library?rid=${encodeURIComponent(first.id)}`;
  };

  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); run(); } });

  window.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
      e.preventDefault(); input.focus(); input.select();
    }
  });
}

// -------------------- Views --------------------
function viewHome(){
  const el = document.createElement('div');
  const active = getActiveProject();
  const pct = active ? projectProgress(active) : 0;

  el.innerHTML = `
    <div class="h1">Inicio / Dashboard</div>
    <div class="muted">Dataset: <b>${esc(state.law?.nombre||'—')}</b> • Versión: <span class="badge">${esc(state.law?.version||'—')}</span></div>

    <div class="row" style="margin-top:12px">
      <div class="card">
        <div class="hd"><b>Acciones rápidas</b><div class="muted" style="font-size:12px;margin-top:4px">Proyectos, wizard, checklist</div></div>
        <div class="bd">
          <button class="btn btn--primary" id="new">+ Nuevo proyecto</button>
          <a class="btn" href="#/wizard" style="margin-left:8px">Wizard</a>
          <a class="btn" href="#/checklist" style="margin-left:8px">Checklist</a>
          <hr class="sep">
          <div class="muted" style="font-size:12px">Tip: selecciona un proyecto como “activo” para checklist/export.</div>
        </div>
      </div>
      <div class="card">
        <div class="hd"><b>Proyecto activo</b><div class="muted" style="font-size:12px;margin-top:4px">Semáforo (MVP)</div></div>
        <div class="bd">
          ${active ? `
            <div><b>${esc(active.nombre)}</b></div>
            <div class="muted" style="font-size:12px;margin-top:4px">Modalidad: <span class="badge">${esc(active.modalidad_resultado||'—')}</span></div>
            <div style="margin-top:10px" class="progress"><div style="width:${pct}%"></div></div>
            <div style="margin-top:8px" class="muted">Progreso: <b>${pct}%</b></div>
          ` : `<div class="notice warn">No hay proyecto activo. Crea uno o selecciona en la lista.</div>`}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="hd"><b>Proyectos</b><div class="muted" style="font-size:12px;margin-top:4px">Selecciona uno como activo</div></div>
      <div class="bd" id="list"></div>
    </div>
  `;

  el.querySelector('#new').addEventListener('click', ()=>{
    const p = newProjectTemplate();
    state.projects.unshift(p);
    state.activeProjectId = p.id;
    saveProjects();
    toast('Proyecto creado', 'Completa ficha y ejecuta Wizard para modalidad.');
    location.hash = `#/project?id=${encodeURIComponent(p.id)}`;
  });

  renderProjectList(el.querySelector('#list'));
  return el;
}

function renderProjectList(host){
  if(!state.projects.length){
    host.innerHTML = `<div class="notice warn">Aún no hay proyectos. Usa “Nuevo proyecto”.</div>`;
    return;
  }
  host.innerHTML = `
    <table class="table">
      <thead><tr><th>Activo</th><th>Proyecto</th><th>Modalidad</th><th>Progreso</th><th>Acciones</th></tr></thead>
      <tbody>
        ${state.projects.map(p=>{
          const pct = projectProgress(p);
          const isA = p.id === state.activeProjectId;
          return `
            <tr>
              <td>${isA ? '✅' : ''}</td>
              <td><b>${esc(p.nombre)}</b><div class="muted" style="font-size:12px">${esc(p.distrito||'')}</div></td>
              <td>${esc(p.modalidad_resultado||'—')}</td>
              <td>${pct}%</td>
              <td>
                <button class="btn btn--ghost" data-act="set" data-id="${esc(p.id)}">Hacer activo</button>
                <a class="btn btn--ghost" href="#/project?id=${encodeURIComponent(p.id)}">Editar</a>
                <a class="btn btn--ghost" href="#/checklist?id=${encodeURIComponent(p.id)}">Checklist</a>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  host.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-act="set"]');
    if(!b) return;
    state.activeProjectId = b.dataset.id;
    saveProjects();
    toast('Proyecto activo', 'Checklist y exportación aplican a este proyecto.');
    go();
  });
}

function viewLibrary(params){
  const sid = params.get('sid');
  const rid = params.get('rid');

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="h1">Biblioteca normativa</div>
    <div class="muted">Índice por árbol. Se muestra <b>texto_resumen</b> y enlace a la fuente.</div>

    <div class="row" style="margin-top:12px">
      <div class="card">
        <div class="hd"><b>Índice</b><div class="muted" style="font-size:12px;margin-top:4px">Click para leer</div></div>
        <div class="bd"><div class="tree" id="tree"></div></div>
      </div>
      <div class="card">
        <div class="hd"><b id="t">Seleccione una sección</b><div class="muted" style="font-size:12px;margin-top:4px" id="m"></div></div>
        <div class="bd" id="reader">
          <div class="notice">Seleccione una sección del árbol o use la búsqueda superior.</div>
        </div>
      </div>
    </div>
  `;

  const byId = new Map();
  walk(state.law.estructura, s=>byId.set(s.id, s));
  const treeHost = el.querySelector('#tree');
  treeHost.appendChild(renderTree(state.law.estructura, (sec)=>openSection(el, sec, null)));

  if(rid){
    let found = null;
    walk(state.law.estructura, (s)=>{ if(!found && (s.requisitos||[]).some(r=>r.id===rid)) found = s; });
    if(found) openSection(el, found, rid);
  } else if(sid && byId.get(sid)){
    openSection(el, byId.get(sid), null);
  }

  return el;
}

function renderTree(sections, onOpen){
  const wrap = document.createElement('div');
  for(const s of (sections||[])){
    const node = document.createElement('div');
    node.className = 'node';
    node.innerHTML = `<b>${esc(labelFor(s))}</b> — ${esc(s.nombre||'')}<div class="muted" style="font-size:12px;margin-top:4px">${esc((s.texto_resumen||'').slice(0,110))}${(s.texto_resumen||'').length>110?'…':''}</div>`;
    node.addEventListener('click', ()=>{
      wrap.querySelectorAll('.node').forEach(n=>n.classList.remove('active'));
      node.classList.add('active');
      onOpen(s);
    });
    wrap.appendChild(node);
    if(s.children?.length){
      const ch = document.createElement('div');
      ch.className = 'children';
      ch.appendChild(renderTree(s.children, onOpen));
      wrap.appendChild(ch);
    }
  }
  return wrap;
}

function openSection(root, sec, highlightRid){
  root.querySelector('#t').textContent = `${labelFor(sec)} — ${sec.nombre||''}`;
  root.querySelector('#m').innerHTML = `<span class="badge">${esc(sec.id)}</span> <span class="badge">${esc(sec.tipo||'')}</span>`;

  const reqs = sec.requisitos || [];
  const reqTable = reqs.length ? `
    <h3 style="margin:12px 0 8px">Requisitos asociados</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>Requisito</th><th>Entidad</th><th>Acción</th></tr></thead>
      <tbody>
        ${reqs.map(r=>`
          <tr ${highlightRid===r.id?'style="outline:2px solid rgba(93,209,255,.25)"':''}>
            <td><span class="badge">${esc(r.id)}</span></td>
            <td><b>${esc(r.nombre||r.id)}</b><div class="muted" style="font-size:12px;margin-top:4px">${esc(r.descripcion||'')}</div></td>
            <td>${esc(r.entidad||'')}</td>
            <td><a class="btn btn--ghost" href="#/checklist">Ver checklist</a></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : `<div class="notice warn" style="margin-top:12px">Esta sección no tiene requisitos modelados (MVP).</div>`;

  const src = sec.source_url ? `<div class="muted" style="font-size:12px;margin-top:8px">Fuente: <a href="${esc(sec.source_url)}" target="_blank" rel="noopener noreferrer">${esc(sec.source_url)}</a></div>` : '';
  root.querySelector('#reader').innerHTML = `
    <div class="notice">
      <b>Resumen operativo</b>
      <div style="margin-top:8px;white-space:pre-wrap">${esc(sec.texto_resumen||'')}</div>
      ${src}
    </div>
    ${reqTable}
  `;
}

function viewWizard(){
  const el = document.createElement('div');
  const qs = state.rules.wizard.questions || [];
  const answers = {};
  let modalityId = null;

  el.innerHTML = `
    <div class="h1">Calculadora (Wizard)</div>
    <div class="muted">Responde preguntas para determinar modalidad/caso y generar checklist.</div>

    <div class="row" style="margin-top:12px">
      <div class="card">
        <div class="hd"><b>Preguntas</b><div class="muted" style="font-size:12px;margin-top:4px">Configurable en rules.sample.json</div></div>
        <div class="bd" id="form"></div>
        <div class="bd" style="padding-top:0">
          <button class="btn btn--primary" id="run">Determinar modalidad</button>
        </div>
      </div>
      <div class="card">
        <div class="hd"><b>Resultado</b><div class="muted" style="font-size:12px;margin-top:4px">Modalidad/caso</div></div>
        <div class="bd" id="out"><div class="notice warn">Aún sin evaluación.</div></div>
        <div class="bd" style="padding-top:0">
          <button class="btn" id="mk" disabled>Crear proyecto con checklist</button>
        </div>
      </div>
    </div>
  `;

  const form = el.querySelector('#form');
  form.innerHTML = qs.map(q=>renderQ(q)).join('');

  form.addEventListener('change', (e)=>{
    const t = e.target;
    const qid = t?.dataset?.qid;
    if(!qid) return;
    answers[qid] = parseVal(t);
  });

  el.querySelector('#run').addEventListener('click', ()=>{
    // collect
    for(const q of qs){
      const inp = el.querySelector(`[data-qid="${q.id}"]`);
      if(inp) answers[q.id] = parseVal(inp);
    }
    modalityId = evalWizard(state.rules, answers);
    const mod = state.rules.modalities?.[modalityId];
    if(!mod){
      el.querySelector('#out').innerHTML = `<div class="notice bad">No se pudo determinar modalidad.</div>`;
      return;
    }
    el.querySelector('#out').innerHTML = `
      <div class="notice">
        <b>${esc(mod.nombre)}</b> <span class="badge">${esc(mod.id)}</span>
        <div class="muted" style="font-size:12px;margin-top:6px">${esc(mod.descripcion||'')}</div>
        <hr class="sep">
        <div class="muted" style="font-size:12px">Requisitos aplicables: <b>${(mod.applicable_requirement_ids||[]).length}</b></div>
      </div>
    `;
    el.querySelector('#mk').disabled = false;
    toast('Modalidad determinada', mod.nombre);
  });

  el.querySelector('#mk').addEventListener('click', ()=>{
    if(!modalityId) return;
    const p = newProjectTemplate();
    p.nombre = `Proyecto (${modalityId})`;
    p.modalidad_resultado = modalityId;
    p.etapas = generateStages(modalityId);
    state.projects.unshift(p);
    state.activeProjectId = p.id;
    saveProjects();
    toast('Proyecto creado', 'Checklist generado por etapas.');
    location.hash = `#/checklist?id=${encodeURIComponent(p.id)}`;
  });

  return el;
}

function renderQ(q){
  const help = q.help ? `<div class="muted" style="font-size:12px;margin-top:4px">${esc(q.help)}</div>` : '';
  let input = '';
  if(q.type === 'boolean'){
    input = `<select data-qid="${esc(q.id)}"><option value="">—</option><option value="true">Sí</option><option value="false">No</option></select>`;
  } else if(q.type === 'number'){
    input = `<input data-qid="${esc(q.id)}" type="number" min="${q.min??''}" max="${q.max??''}" step="1" placeholder="${esc(q.placeholder||'')}" />`;
  } else {
    input = `<select data-qid="${esc(q.id)}"><option value="">—</option>${(q.options||[]).map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`;
  }
  return `<div style="margin-bottom:12px"><div class="muted" style="font-size:12px;margin-bottom:6px">${esc(q.text)}</div>${input}${help}</div>`;
}

function parseVal(inp){
  if(inp.tagName === 'SELECT'){
    const v = inp.value;
    if(v === 'true') return true;
    if(v === 'false') return false;
    return v || null;
  }
  if(inp.type === 'number'){
    const n = Number(inp.value);
    return Number.isFinite(n) ? n : null;
  }
  return inp.value || null;
}

function evalWizard(rules, answers){
  for(const d of (rules.wizard.decisions || [])){
    if(matchesAll(d.when||[], answers)) return d.result_modality;
  }
  return rules.wizard.default_modality || null;
}

function matchesAll(conds, answers){
  for(const c of conds){
    const v = answers[c.q];
    if(!test(v, c.op, c.v)) return false;
  }
  return true;
}

function test(value, op, expected){
  switch(op){
    case 'eq': return value === expected;
    case 'neq': return value !== expected;
    case 'gte': return Number(value) >= Number(expected);
    case 'lte': return Number(value) <= Number(expected);
    case 'in': return Array.isArray(expected) ? expected.includes(value) : false;
    case 'truthy': return Boolean(value) === true;
    case 'falsy': return Boolean(value) === false;
    default: return false;
  }
}

// -------------------- Projects --------------------
function newProjectTemplate(){
  const today = new Date().toISOString().slice(0,10);
  return {
    id: uid('PRJ'),
    nombre: 'Nuevo proyecto',
    ubicacion: '',
    distrito: '',
    provincia: 'Lima',
    departamento: 'Lima',
    tipologia: '',
    metrado_m2: 0,
    pisos: 1,
    modalidad_resultado: null,
    fechas: { inicio: today, objetivo: '' },
    etapas: [],
    logs: [{ fecha:new Date().toISOString(), accion:'CREAR', detalle:'Proyecto creado' }]
  };
}

function viewProject(params){
  const id = params.get('id') || state.activeProjectId;
  let p = id ? state.projects.find(x=>x.id===id) : null;
  if(!p){
    p = newProjectTemplate();
    state.projects.unshift(p);
    state.activeProjectId = p.id;
    saveProjects();
  } else {
    state.activeProjectId = p.id;
  }

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="h1">Nuevo / Editar proyecto</div>
    <div class="muted">Completa ficha. Para generar checklist usa Wizard.</div>

    <div class="card" style="margin-top:12px">
      <div class="hd"><b>Ficha</b> <span class="badge">ID: ${esc(p.id)}</span></div>
      <div class="bd">
        <div class="row">
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Nombre</div>
            <input id="nombre" value="${esc(p.nombre)}">
          </div>
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Tipología</div>
            <input id="tipologia" value="${esc(p.tipologia||'')}" placeholder="Ej. Vivienda, comercio, equipamiento">
          </div>
        </div>

        <div class="row" style="margin-top:10px">
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Ubicación</div>
            <input id="ubicacion" value="${esc(p.ubicacion||'')}">
          </div>
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Distrito</div>
            <input id="distrito" value="${esc(p.distrito||'')}">
          </div>
        </div>

        <div class="row" style="margin-top:10px">
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Metrado (m²)</div>
            <input id="m2" type="number" min="0" step="1" value="${esc(p.metrado_m2)}">
          </div>
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Pisos</div>
            <input id="pisos" type="number" min="1" step="1" value="${esc(p.pisos)}">
          </div>
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Modalidad (wizard)</div>
            <input value="${esc(p.modalidad_resultado||'')}" disabled>
          </div>
        </div>

        <hr class="sep">

        <div class="row">
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Inicio</div>
            <input id="inicio" type="date" value="${esc(p.fechas?.inicio||'')}">
          </div>
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Objetivo</div>
            <input id="objetivo" type="date" value="${esc(p.fechas?.objetivo||'')}">
          </div>
        </div>
      </div>
      <div class="bd" style="padding-top:0;display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn" href="#/wizard">Ejecutar Wizard</a>
        <button class="btn btn--primary" id="save">Guardar</button>
        <a class="btn btn--ghost" href="#/">Volver</a>
      </div>
    </div>
  `;

  el.querySelector('#save').addEventListener('click', ()=>{
    p.nombre = el.querySelector('#nombre').value.trim() || p.nombre;
    p.tipologia = el.querySelector('#tipologia').value.trim();
    p.ubicacion = el.querySelector('#ubicacion').value.trim();
    p.distrito = el.querySelector('#distrito').value.trim();
    p.metrado_m2 = Number(el.querySelector('#m2').value || 0);
    p.pisos = Number(el.querySelector('#pisos').value || 1);
    p.fechas = p.fechas || {};
    p.fechas.inicio = el.querySelector('#inicio').value || p.fechas.inicio;
    p.fechas.objetivo = el.querySelector('#objetivo').value || p.fechas.objetivo;
    p.logs = p.logs || [];
    p.logs.unshift({ fecha:new Date().toISOString(), accion:'EDITAR', detalle:'Ficha actualizada' });
    saveProjects();
    toast('Guardado', 'Proyecto actualizado.');
    location.hash = '#/';
  });

  return el;
}

// -------------------- Checklist --------------------
function requirementMap(){
  const map = new Map();
  walk(state.law.estructura, (sec)=>{
    for(const r of (sec.requisitos||[])){
      map.set(r.id, { ...r, base_legal_ref: r.base_legal_ref || sec.id });
    }
  });
  return map;
}

function stageProgress(stage){
  const items = stage.checklist_items || [];
  const denom = items.filter(i=>i.estado!=='no_aplica').length;
  const ok = items.filter(i=>i.estado==='cumplido').length;
  const partial = items.filter(i=>i.estado==='parcial').length;
  const pct = denom ? Math.round(((ok + partial*0.5)/denom)*100) : 0;
  return { pct, denom, ok, partial };
}

function projectProgress(p){
  const sts = p.etapas || [];
  if(!sts.length) return 0;
  const avg = Math.round(sts.reduce((acc,s)=>acc+stageProgress(s).pct, 0)/sts.length);
  return avg;
}

function viewChecklist(params){
  const id = params.get('id') || state.activeProjectId;
  if(id) state.activeProjectId = id;
  const p = getActiveProject();

  const el = document.createElement('div');
  if(!p){
    el.innerHTML = `<div class="h1">Checklist</div><div class="notice warn">No hay proyecto activo. Crea uno o usa Wizard.</div><div style="margin-top:10px"><a class="btn btn--primary" href="#/wizard">Ir al Wizard</a></div>`;
    return el;
  }

  const reqMap = requirementMap();

  el.innerHTML = `
    <div class="h1">Checklist</div>
    <div class="muted"><b>${esc(p.nombre)}</b> • Modalidad: <span class="badge">${esc(p.modalidad_resultado||'—')}</span></div>

    <div class="card" style="margin-top:12px">
      <div class="hd"><b>Etapas</b><div class="muted" style="font-size:12px;margin-top:4px">Completa estado, valores y evidencias.</div></div>
      <div class="bd">
        <div class="tabs" id="tabs"></div>
        <div id="body" style="margin-top:10px"></div>
      </div>
      <div class="bd" style="padding-top:0;display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn" href="#/project?id=${encodeURIComponent(p.id)}">Editar ficha</a>
        <a class="btn" href="#/export?id=${encodeURIComponent(p.id)}">Exportación</a>
        <button class="btn btn--primary" id="saveAll">Guardar checklist</button>
      </div>
    </div>
  `;

  if(!(p.etapas||[]).length){
    el.querySelector('#tabs').innerHTML = '';
    el.querySelector('#body').innerHTML = `<div class="notice warn">Este proyecto no tiene checklist. Ejecuta Wizard.</div><div style="margin-top:10px"><a class="btn btn--primary" href="#/wizard">Ir al Wizard</a></div>`;
    return el;
  }

  let idx = 0;
  const tabs = el.querySelector('#tabs');
  const body = el.querySelector('#body');

  function render(){
    tabs.innerHTML = p.etapas.map((s,i)=>{
      const pr = stageProgress(s);
      return `<div class="tab ${i===idx?'active':''}" data-i="${i}">${esc(s.nombre)} <span class="badge">${pr.pct}%</span></div>`;
    }).join('');

    const st = p.etapas[idx];
    const pr = stageProgress(st);

    body.innerHTML = `
      <div class="notice"><b>Estado etapa:</b> ${esc(st.estado||'no_iniciado')} • <b>Progreso:</b> ${pr.pct}% (OK:${pr.ok}, Parcial:${pr.partial}, Total:${pr.denom})</div>
      <div style="margin-top:10px">
        ${(st.checklist_items||[]).map(ci=>renderReq(ci, reqMap)).join('')}
      </div>
    `;

    // bind per-item events
    body.querySelectorAll('[data-rid]').forEach(box=>{
      const rid = box.dataset.rid;
      const ci = st.checklist_items.find(x=>x.requirement_id===rid);
      if(!ci) return;

      box.querySelector('select[data-f="estado"]').addEventListener('change', (e)=>{
        ci.estado = e.target.value;
        ci.fecha_update = new Date().toISOString();
      });

      box.querySelectorAll('[data-k]').forEach(inp=>{
        inp.addEventListener('change', ()=>{
          ci.valores = ci.valores || {};
          const key = inp.dataset.k;
          if(inp.type === 'checkbox') ci.valores[key] = inp.checked;
          else ci.valores[key] = inp.value;
          ci.fecha_update = new Date().toISOString();
        });
      });

      const file = box.querySelector('input[type="file"]');
      file?.addEventListener('change', async ()=>{
        const f = file.files?.[0];
        if(!f) return;
        const b64 = await fileToBase64(f);
        ci.evidencia_adjunta = ci.evidencia_adjunta || [];
        ci.evidencia_adjunta.push({ id: uid('EV'), name:f.name, type:f.type, size:f.size, b64 });
        ci.fecha_update = new Date().toISOString();
        toast('Evidencia adjunta', f.name);
        render();
      });

      box.querySelectorAll('button[data-act="rm"]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const id = btn.dataset.id;
          ci.evidencia_adjunta = (ci.evidencia_adjunta||[]).filter(e=>e.id!==id);
          render();
        });
      });

      const notes = box.querySelector('textarea[data-f="notas"]');
      notes?.addEventListener('change', ()=>{
        ci.notas = notes.value;
        ci.fecha_update = new Date().toISOString();
      });
    });
  }

  tabs.addEventListener('click', (e)=>{
    const t = e.target.closest('.tab');
    if(!t) return;
    idx = Number(t.dataset.i);
    render();
  });

  el.querySelector('#saveAll').addEventListener('click', ()=>{
    // heuristic stage state
    for(const s of p.etapas){
      const pr = stageProgress(s);
      s.estado = pr.pct >= 99 ? 'completo' : (pr.pct > 0 ? 'en_proceso' : 'no_iniciado');
    }
    p.logs = p.logs || [];
    p.logs.unshift({ fecha:new Date().toISOString(), accion:'CHECKLIST', detalle:'Checklist guardado' });
    saveProjects();
    toast('Guardado', 'Checklist guardado en LocalStorage.');
    render();
  });

  render();
  return el;
}

function renderReq(ci, reqMap){
  const r = reqMap.get(ci.requirement_id);
  if(!r) return `<div class="notice bad">Requisito no encontrado: ${esc(ci.requirement_id)}</div>`;

  const fields = (r.entradas||[]).map(f=>{
    const v = ci.valores?.[f.key];
    if(f.type==='select'){
      return `<div><div class="muted" style="font-size:12px;margin-bottom:6px">${esc(f.label)}${f.required?' *':''}</div>
        <select data-k="${esc(f.key)}"><option value="">—</option>${(f.options||[]).map(o=>`<option value="${esc(o)}" ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
    }
    if(f.type==='boolean'){
      return `<div><div class="muted" style="font-size:12px;margin-bottom:6px">${esc(f.label)}${f.required?' *':''}</div>
        <input type="checkbox" data-k="${esc(f.key)}" ${v===true?'checked':''}></div>`;
    }
    if(f.type==='date'){
      return `<div><div class="muted" style="font-size:12px;margin-bottom:6px">${esc(f.label)}${f.required?' *':''}</div>
        <input type="date" data-k="${esc(f.key)}" value="${esc(v||'')}"></div>`;
    }
    if(f.type==='number'){
      return `<div><div class="muted" style="font-size:12px;margin-bottom:6px">${esc(f.label)}${f.required?' *':''}</div>
        <input type="number" data-k="${esc(f.key)}" value="${esc(v??'')}"></div>`;
    }
    return `<div><div class="muted" style="font-size:12px;margin-bottom:6px">${esc(f.label)}${f.required?' *':''}</div>
      <input type="text" data-k="${esc(f.key)}" value="${esc(v??'')}"></div>`;
  }).join('');

  const ev = (ci.evidencia_adjunta||[]).map(e=>`
    <div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span class="badge">${esc(e.name||'archivo')}</span>
      <span class="muted" style="font-size:12px">${Math.round((e.size||0)/1024)} KB</span>
      <button class="btn btn--ghost" data-act="rm" data-id="${esc(e.id)}">Quitar</button>
    </div>
  `).join('');

  const expected = (r.evidencias||[]).map(x=>`• ${esc(x.nombre)} (${esc(x.formato||'')})`).join('<br>');

  return `
    <div class="card" style="margin-bottom:12px" data-rid="${esc(ci.requirement_id)}">
      <div class="hd">
        <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap">
          <div>
            <b>${esc(r.nombre||r.id)}</b>
            <div class="muted" style="font-size:12px;margin-top:4px">${esc(r.descripcion||'')}</div>
            <div class="muted" style="font-size:12px;margin-top:6px">
              <span class="badge">${esc(r.id)}</span>
              <span class="badge">Entidad: ${esc(r.entidad||'')}</span>
              <span class="badge">Resp: ${esc(r.responsable_tipo||'')}</span>
              <span class="badge">Plazo: ${esc(r.plazo_estimado_dias??'')}d</span>
            </div>
          </div>
          <div style="min-width:180px">
            <div class="muted" style="font-size:12px;margin-bottom:6px">Estado</div>
            <select data-f="estado">
              ${opt(ci.estado,'pendiente','Pendiente')}
              ${opt(ci.estado,'parcial','Parcial')}
              ${opt(ci.estado,'cumplido','Cumplido')}
              ${opt(ci.estado,'no_aplica','No aplica')}
            </select>
          </div>
        </div>
      </div>
      <div class="bd">
        ${fields ? `<div class="row">${fields}</div>` : `<div class="muted" style="font-size:12px">Sin campos de entrada (MVP).</div>`}
        <hr class="sep">
        <div class="row">
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Adjuntar evidencia (MVP: base64 local)</div>
            <input type="file">
            <div class="muted" style="font-size:12px;margin-top:6px">Esperado:<br>${expected||'—'}</div>
            ${ev}
          </div>
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px">Notas</div>
            <textarea data-f="notas" placeholder="Observaciones…">${esc(ci.notas||'')}</textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}

function opt(cur, v, label){ return `<option value="${v}" ${cur===v?'selected':''}>${label}</option>`; }

function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = ()=>reject(r.error);
    r.readAsDataURL(file);
  });
}

// -------------------- Stage generation --------------------
function generateStages(modalityId){
  const mod = state.rules.modalities?.[modalityId];
  const applicable = new Set(mod?.applicable_requirement_ids || []);
  const stages = [];
  for(const st of (state.rules.stage_templates || [])){
    const reqIds = (st.requirement_ids || []).filter(id => applicable.has(id));
    if(!reqIds.length) continue;
    stages.push({
      id: st.id || uid('STG'),
      nombre: st.nombre,
      estado: 'no_iniciado',
      checklist_items: reqIds.map(rid => ({
        requirement_id: rid,
        estado: 'pendiente',
        valores: {},
        evidencia_adjunta: [],
        notas: '',
        fecha_update: new Date().toISOString()
      }))
    });
  }
  return stages;
}

// -------------------- Export --------------------
function viewExport(params){
  const id = params.get('id') || state.activeProjectId;
  if(id) state.activeProjectId = id;
  const p = getActiveProject();

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="h1">Exportación</div>
    <div class="muted">Expediente HTML imprimible (PDF por navegador) y respaldo JSON.</div>

    ${p ? `
      <div class="card" style="margin-top:12px">
        <div class="hd"><b>Proyecto activo</b> <span class="badge">${esc(p.id)}</span></div>
        <div class="bd">
          <div class="row">
            <div>
              <button class="btn btn--primary" id="exp">Generar expediente (HTML)</button>
              <div class="muted" style="font-size:12px;margin-top:6px">Se abre en otra pestaña. Luego “Imprimir / Guardar como PDF”.</div>
            </div>
            <div>
              <button class="btn" id="exjson">Exportar proyecto (JSON)</button>
              <div class="muted" style="font-size:12px;margin-top:6px">Incluye checklist y evidencias (base64). Puede ser grande.</div>
            </div>
          </div>

          <hr class="sep">

          <div class="row">
            <div>
              <div class="muted" style="font-size:12px;margin-bottom:6px">Importar (pegar JSON)</div>
              <textarea id="box" placeholder="Pega JSON exportado…"></textarea>
              <button class="btn btn--primary" id="im" style="margin-top:8px">Importar y activar</button>
            </div>
            <div>
              <div class="notice warn"><b>Nota</b><br>Si adjuntas muchos archivos, el LocalStorage se puede llenar. Para producción: IndexedDB o backend.</div>
            </div>
          </div>
        </div>
      </div>
    ` : `<div class="notice warn" style="margin-top:12px">No hay proyecto activo.</div><div style="margin-top:10px"><a class="btn btn--primary" href="#/wizard">Ir al Wizard</a></div>`}
  `;

  if(!p) return el;

  el.querySelector('#exp').addEventListener('click', ()=>{
    const html = buildExpedienteHTML(p);
    const blob = new Blob([html], { type:'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    toast('Expediente', 'Pestaña imprimible abierta.');
  });

  el.querySelector('#exjson').addEventListener('click', ()=>{
    const raw = JSON.stringify(p, null, 2);
    download(raw, `proyecto_${p.id}.json`, 'application/json');
    toast('Exportado', 'JSON descargado.');
  });

  el.querySelector('#im').addEventListener('click', ()=>{
    const obj = safeParse(el.querySelector('#box').value, null);
    if(!obj?.id){ toast('Error', 'JSON inválido o sin id'); return; }
    // upsert
    const idx = state.projects.findIndex(x=>x.id===obj.id);
    if(idx>=0) state.projects[idx] = obj; else state.projects.unshift(obj);
    state.activeProjectId = obj.id;
    saveProjects();
    toast('Importado', 'Proyecto guardado y activado.');
    location.hash = `#/checklist?id=${encodeURIComponent(obj.id)}`;
  });

  return el;
}

function download(text, filename, mime){
  const blob = new Blob([text], { type:mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 400);
}

function buildExpedienteHTML(p){
  const reqMap = requirementMap();
  const secMap = new Map();
  walk(state.law.estructura, s=>secMap.set(s.id, s));

  const idx = (p.etapas||[]).map((st,i)=>`<li><a href="#st_${i}">${esc(st.nombre)}</a></li>`).join('');
  const stages = (p.etapas||[]).map((st,i)=>renderStage(st,i,reqMap,secMap)).join('\n');

  const cover = `
    <h1>Expediente (MVP)</h1>
    <div style="color:#333">Generado desde LegalTech — Ley (SPA estática)</div>
    <hr>
    <h2>Ficha del proyecto</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${row('Proyecto', p.nombre)}
      ${row('Ubicación', p.ubicacion)}
      ${row('Distrito', p.distrito)}
      ${row('Tipología', p.tipologia)}
      ${row('Metrado (m²)', String(p.metrado_m2 ?? ''))}
      ${row('Pisos', String(p.pisos ?? ''))}
      ${row('Modalidad', String(p.modalidad_resultado ?? ''))}
      ${row('Inicio', p.fechas?.inicio || '')}
      ${row('Objetivo', p.fechas?.objetivo || '')}
    </table>
  `;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Expediente — ${esc(p.nombre)}</title>
  <style>
    body{font-family:Arial, Helvetica, sans-serif;margin:0;color:#111}
    .wrap{max-width:980px;margin:0 auto;padding:12px 16px 24px}
    a{color:#0645ad}
    h1,h2,h3{page-break-after:avoid}
    table{page-break-inside:avoid}
    .stage{border-top:2px solid #eee;margin-top:18px;padding-top:16px}
    .req{border:1px solid #ddd;border-radius:10px;padding:10px 12px;margin:10px 0}
    .badge{display:inline-block;padding:2px 8px;border:1px solid #ccc;border-radius:999px;font-size:12px}
    .muted{color:#444;font-size:12px}
    @media print{ .noprint{display:none} }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="noprint" style="padding:8px 0"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
    ${cover}
    <h2>Índice</h2>
    <ol>${idx}</ol>
    <p class="muted">Nota: este expediente contiene resúmenes operativos y referencias por ID.</p>
    ${stages}
  </div>
</body>
</html>`;
}

function row(k,v){
  return `<tr><td style="border-bottom:1px solid #eee;padding:6px 8px;width:220px"><b>${esc(k)}</b></td><td style="border-bottom:1px solid #eee;padding:6px 8px">${esc(v ?? '')}</td></tr>`;
}

function renderStage(stage, i, reqMap, secMap){
  const items = (stage.checklist_items||[]).map(ci=>{
    const r = reqMap.get(ci.requirement_id);
    if(!r) return '';
    const sec = secMap.get(r.base_legal_ref);
    const base = sec ? `${labelFor(sec)} — ${sec.nombre||''}` : r.base_legal_ref;
    const ev = (ci.evidencia_adjunta||[]).map(e=>`<div class="muted">• ${esc(e.name||'archivo')}</div>`).join('');
    return `
      <div class="req">
        <h4 style="margin:0 0 6px">${esc(r.nombre||r.id)} <span class="badge">${esc(ci.estado||'pendiente')}</span></h4>
        <div class="muted">${esc(r.descripcion||'')}</div>
        <div style="margin-top:8px;font-size:12px">
          <div><b>Entidad:</b> ${esc(r.entidad||'')}</div>
          <div><b>Responsable:</b> ${esc(r.responsable_tipo||'')}</div>
          <div><b>Base legal:</b> ${esc(base)}</div>
          ${ci.notas ? `<div style="margin-top:6px"><b>Notas:</b> ${esc(ci.notas)}</div>` : ''}
          ${ev ? `<div style="margin-top:6px"><b>Evidencias</b>${ev}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  return `<section class="stage" id="st_${i}">
    <h2>${esc(stage.nombre)} <span class="badge">${esc(stage.estado||'no_iniciado')}</span></h2>
    ${items || '<div class="muted">Sin requisitos en esta etapa.</div>'}
  </section>`;
}

// -------------------- Settings --------------------
function viewSettings(){
  const el = document.createElement('div');
  const ov = safeParse(localStorage.getItem(LS.dsOverride), null);

  el.innerHTML = `
    <div class="h1">Configuración</div>
    <div class="muted">Pegar override de dataset o volver al dataset en /data.</div>

    <div class="row" style="margin-top:12px">
      <div class="card">
        <div class="hd"><b>Dataset override (LocalStorage)</b><div class="muted" style="font-size:12px;margin-top:4px">law + rules</div></div>
        <div class="bd">
          <div class="muted" style="font-size:12px;margin-bottom:6px">law (LawDocument)</div>
          <textarea id="lawBox" placeholder="Pega JSON de law…"></textarea>
          <div class="muted" style="font-size:12px;margin:10px 0 6px">rules (Wizard + modalidades + etapas)</div>
          <textarea id="rulesBox" placeholder="Pega JSON de rules…"></textarea>
        </div>
        <div class="bd" style="padding-top:0;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn--danger" id="reset">Reset (volver a /data)</button>
          <button class="btn btn--primary" id="save">Guardar override</button>
        </div>
      </div>
      <div class="card">
        <div class="hd"><b>Estado</b><div class="muted" style="font-size:12px;margin-top:4px">Ley cargada</div></div>
        <div class="bd">
          <div><b>${esc(state.law?.nombre||'—')}</b></div>
          <div class="muted" style="font-size:12px;margin-top:4px">Versión: ${esc(state.law?.version||'—')}</div>
          <div class="muted" style="font-size:12px;margin-top:4px">Vigencia: ${esc(state.law?.fecha_vigencia||'—')}</div>
          <hr class="sep">
          <div class="muted" style="font-size:12px">Fuente URL:</div>
          <div style="word-break:break-all"><span class="badge">${esc(state.law?.fuente_url||'—')}</span></div>
          <hr class="sep">
          <div class="notice">
            <b>Modo B</b><br>
            Modela por sección: <code>texto_resumen</code> + <code>source_url</code> (enlace a fuente oficial).
          </div>
        </div>
      </div>
    </div>
  `;

  if(ov?.law && ov?.rules){
    el.querySelector('#lawBox').value = JSON.stringify(ov.law, null, 2);
    el.querySelector('#rulesBox').value = JSON.stringify(ov.rules, null, 2);
  }

  el.querySelector('#save').addEventListener('click', ()=>{
    try{
      const law = JSON.parse(el.querySelector('#lawBox').value);
      const rules = JSON.parse(el.querySelector('#rulesBox').value);
      const errs = validateDataset(law, rules);
      if(errs.length){ toast('JSON inválido', errs.slice(0,6).join(' | ')); return; }
      localStorage.setItem(LS.dsOverride, JSON.stringify({ law, rules, saved_at:new Date().toISOString() }));
      toast('Guardado', 'Recarga la página para aplicar el override.');
    }catch(e){
      toast('Error', 'No se pudo parsear JSON: ' + e.message);
    }
  });

  el.querySelector('#reset').addEventListener('click', ()=>{
    localStorage.removeItem(LS.dsOverride);
    toast('Reset', 'Override eliminado. Recarga para usar /data.');
  });

  return el;
}

// -------------------- Boot --------------------
async function boot(){
  loadProjects();
  const { law, rules } = await loadDataset();
  state.law = law; state.rules = rules;
  buildSearchIndex();
  bindSearch();
  go();
}

boot().catch(err=>{
  console.error(err);
  elApp().innerHTML = `<div class="card"><div class="hd"><b>Error de carga</b></div><div class="bd"><div class="notice bad"><b>Detalle:</b><pre style="white-space:pre-wrap">${esc(err.message||String(err))}</pre></div><div class="muted" style="font-size:12px;margin-top:10px">Usa un servidor (Live Server / python -m http.server) o GitHub Pages.</div></div></div>`;
  toast('Error', 'Revisa el JSON del dataset y la consola.');
});
