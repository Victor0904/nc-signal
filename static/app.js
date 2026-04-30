/* ================================================
   NC Signal — version statique (localStorage)
   ================================================ */

const STORE = 'nc-signal';

// ─── Données exemples au premier chargement ───
function seed() {
  const n = Date.now();
  return {
    ncs: [
      { id:1, title:"Machine à café non nettoyée", location:"Salle de pause 2ème étage", reporter:"Marie",
        photo:null, status:"pending", takenBy:null, resolvedBy:null,
        createdAt: new Date(n - 5400000).toISOString(), takenAt:null, resolvedAt:null },
      { id:2, title:"Bureau non rangé", location:"Open space",  reporter:"Thomas",
        photo:null, status:"taken",   takenBy:"Lucas", resolvedBy:null,
        createdAt: new Date(n - 7200000).toISOString(), takenAt: new Date(n - 3600000).toISOString(), resolvedAt:null },
      { id:3, title:"Tasse sale sur l'imprimante", location:"Couloir RDC", reporter:"Sophie",
        photo:null, status:"resolved", takenBy:"Marc", resolvedBy:"Marc",
        createdAt: new Date(n - 86400000).toISOString(), takenAt: new Date(n - 43200000).toISOString(), resolvedAt: new Date(n - 3600000).toISOString() },
    ],
    next: 4
  };
}

// ─── LocalStorage CRUD ────────────────────────
function getData()     { try { return JSON.parse(localStorage.getItem(STORE)) || seed(); } catch { return seed(); } }
function setData(d)    { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch { showToast('Stockage plein', 'err'); } }

function getAll()      { return [...getData().ncs].reverse(); }

function createNC({ title, location, reporter, photo }) {
  const data = getData();
  const nc = { id: data.next++, title, location, reporter, photo: photo||null,
    status:'pending', takenBy:null, resolvedBy:null,
    createdAt: new Date().toISOString(), takenAt:null, resolvedAt:null };
  data.ncs.push(nc);
  setData(data);
  return nc;
}

function takeNC(id, name) {
  const data = getData();
  const nc = data.ncs.find(n => n.id === id);
  if (!nc || nc.status !== 'pending') throw new Error('NC déjà prise en charge');
  nc.status = 'taken'; nc.takenBy = name; nc.takenAt = new Date().toISOString();
  setData(data); return nc;
}

function resolveNC(id, name) {
  const data = getData();
  const nc = data.ncs.find(n => n.id === id);
  if (!nc || nc.status === 'resolved') throw new Error('NC déjà résolue');
  nc.status = 'resolved'; nc.resolvedBy = name; nc.resolvedAt = new Date().toISOString();
  setData(data); return nc;
}

// ─── État UI ──────────────────────────────────
let filter     = 'all';
let pendingAct = null;

// ─── DOM ──────────────────────────────────────
const feed         = document.getElementById('feed');
const headerBadge  = document.getElementById('headerBadge');
const fab          = document.getElementById('fab');
const addOverlay   = document.getElementById('addOverlay');
const addForm      = document.getElementById('addForm');
const closeAdd     = document.getElementById('closeAdd');
const photoZone    = document.getElementById('photoZone');
const photoInput   = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const photoEmpty   = document.getElementById('photoEmpty');
const changePhoto  = document.getElementById('changePhoto');
const fTitle       = document.getElementById('fTitle');
const fLocation    = document.getElementById('fLocation');
const fReporter    = document.getElementById('fReporter');
const submitAdd    = document.getElementById('submitAdd');
const submitText   = document.getElementById('submitText');
const actionOverlay = document.getElementById('actionOverlay');
const dialogIcon   = document.getElementById('dialogIcon');
const dialogTitle  = document.getElementById('dialogTitle');
const dialogSub    = document.getElementById('dialogSub');
const actionName   = document.getElementById('actionName');
const cancelAction = document.getElementById('cancelAction');
const confirmAction= document.getElementById('confirmAction');
const confirmText  = document.getElementById('confirmText');
const toast        = document.getElementById('toast');

// ─── Boot ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  render();
  renderBadge();
  wireEvents();
});

// ─── Rendu ────────────────────────────────────
function render() {
  const list = filter === 'all' ? getAll() : getAll().filter(n => n.status === filter);

  if (!list.length) {
    const msgs = {
      all:      ['✅','Aucune non-conformité','Tout est en ordre !'],
      pending:  ['🎉','Aucune NC en attente','Tout est pris en charge !'],
      taken:    ['👌','Aucune NC en cours',''],
      resolved: ['📋','Aucune NC résolue',''],
    };
    const [icon, title, sub] = msgs[filter];
    feed.innerHTML = `<div class="empty"><div class="empty-icon">${icon}</div><h3>${title}</h3>${sub?`<p>${sub}</p>`:''}</div>`;
    return;
  }
  feed.innerHTML = list.map((nc, i) => cardHTML(nc, i)).join('');
}

function renderBadge() {
  const active = getAll().filter(n => n.status !== 'resolved').length;
  headerBadge.textContent = active === 0 ? 'Tout est résolu ✓' : `${active} active${active>1?'s':''}`;
}

function cardHTML(nc, i) {
  const STATUS = {
    pending:  { label:'En attente', cls:'badge-pending'  },
    taken:    { label:'En cours',   cls:'badge-taken'    },
    resolved: { label:'Résolu',     cls:'badge-resolved' },
  };
  const s = STATUS[nc.status] || STATUS.pending;
  const delay = `animation-delay:${Math.min(i*.05,.3)}s`;

  const photoEl = nc.photo
    ? `<img class="card-photo" src="${nc.photo}" alt="${esc(nc.title)}" loading="lazy">`
    : `<div class="card-photo-ph">📷</div>`;

  let byLine = '';
  if (nc.status==='taken'    && nc.takenBy)    byLine = metaRow(iconPerson(), `Pris en charge par <strong>${esc(nc.takenBy)}</strong>`);
  if (nc.status==='resolved' && nc.resolvedBy) byLine = `<div class="meta-row resolved-by">${iconCheck()}Résolu par <strong>${esc(nc.resolvedBy)}</strong></div>`;

  let action = '';
  if (nc.status==='pending')
    action = `<div class="card-sep"></div><button class="btn-take" onclick="openAction(${nc.id},'take')">${iconHand()} Je m'en occupe</button>`;
  else if (nc.status==='taken')
    action = `<div class="card-sep"></div><button class="btn-take btn-resolve" onclick="openAction(${nc.id},'resolve')">${iconCheck()} C'est fait !</button>`;

  return `
    <article class="card" style="${delay}">
      ${photoEl}
      <div class="card-body">
        <div class="card-top">
          <h2 class="card-title">${esc(nc.title)}</h2>
          <span class="badge ${s.cls}"><span class="badge-dot"></span>${s.label}</span>
        </div>
        <div class="card-meta">
          ${nc.location ? metaRow(iconPin(), esc(nc.location)) : ''}
          ${metaRow(iconClock(), timeAgo(nc.createdAt))}
          ${metaRow(iconUser(), `Signalé par <strong>${esc(nc.reporter||'Anonyme')}</strong>`)}
          ${byLine}
        </div>
        ${action}
      </div>
    </article>`;
}

function metaRow(icon, html) {
  return `<div class="meta-row">${icon}<span>${html}</span></div>`;
}

// ─── Évènements ───────────────────────────────
function wireEvents() {
  document.getElementById('tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    filter = tab.dataset.f;
    render();
  });

  fab.addEventListener('click', openAdd);
  closeAdd.addEventListener('click', closeAdd_);
  addOverlay.addEventListener('click', e => { if (e.target===addOverlay) closeAdd_(); });
  photoZone.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', onPhotoChange);
  addForm.addEventListener('submit', onAddSubmit);
  cancelAction.addEventListener('click', closeAction);
  actionOverlay.addEventListener('click', e => { if (e.target===actionOverlay) closeAction(); });
  confirmAction.addEventListener('click', onConfirm);
  actionName.addEventListener('keydown', e => { if (e.key==='Enter') onConfirm(); });
}

// ─── Modal Ajout ──────────────────────────────
function openAdd() {
  addOverlay.classList.add('open'); fab.classList.add('open');
  lockScroll(true);
  setTimeout(() => fTitle.focus(), 380);
}

function closeAdd_() {
  addOverlay.classList.remove('open'); fab.classList.remove('open');
  lockScroll(false);
  setTimeout(() => {
    addForm.reset();
    photoPreview.hidden = true; photoPreview.src = '';
    photoEmpty.hidden = false; changePhoto.hidden = true;
    photoZone.style.borderStyle = 'dashed'; photoZone.style.borderColor = '';
    photoInput._b64 = null;
    submitAdd.disabled = false; submitText.textContent = 'Signaler';
  }, 300);
}

async function onPhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const blob = await compress(file, 800, .70);
    photoInput._b64 = await blobToB64(blob);
  } catch {
    photoInput._b64 = await blobToB64(file);
  }
  photoPreview.src = photoInput._b64;
  photoPreview.hidden = false; photoEmpty.hidden = true; changePhoto.hidden = false;
  photoZone.style.borderStyle = 'solid'; photoZone.style.borderColor = 'var(--green)';
}

function onAddSubmit(e) {
  e.preventDefault();
  const title = fTitle.value.trim();
  if (!title) { fTitle.focus(); return; }

  submitAdd.disabled = true; submitText.textContent = 'Ajout…';

  const nc = createNC({
    title,
    location: fLocation.value.trim(),
    reporter: fReporter.value.trim() || 'Anonyme',
    photo: photoInput._b64 || null,
  });

  render(); renderBadge();
  closeAdd_();
  showToast('NC signalée avec succès !', 'ok');
}

// ─── Modal Action ─────────────────────────────
function openAction(id, type) {
  pendingAct = { id, type };
  if (type === 'take') {
    dialogIcon.textContent  = '🙋';
    dialogTitle.textContent = "Je m'en occupe";
    dialogSub.textContent   = 'Entrez votre prénom pour confirmer que vous prenez en charge cette NC.';
  } else {
    dialogIcon.textContent  = '✅';
    dialogTitle.textContent = "C'est fait !";
    dialogSub.textContent   = 'Entrez votre prénom pour confirmer que vous avez résolu cette NC.';
  }
  actionName.value = ''; confirmAction.disabled = false; confirmText.textContent = 'Confirmer';
  actionOverlay.classList.add('open');
  lockScroll(true);
  setTimeout(() => actionName.focus(), 350);
}

function closeAction() {
  actionOverlay.classList.remove('open');
  lockScroll(false);
  pendingAct = null;
}

function onConfirm() {
  if (!pendingAct) return;
  const name = actionName.value.trim();
  if (!name) {
    actionName.classList.add('shake');
    actionName.addEventListener('animationend', () => actionName.classList.remove('shake'), { once:true });
    actionName.focus(); return;
  }

  try {
    const updated = pendingAct.type === 'take'
      ? takeNC(pendingAct.id, name)
      : resolveNC(pendingAct.id, name);

    const msg = pendingAct.type === 'take'
      ? `Pris en charge par ${name} 👍`
      : `Résolu par ${name} ✅`;

    render(); renderBadge();
    closeAction();
    showToast(msg, 'ok');
  } catch (err) {
    showToast(err.message, 'err');
  }
}

// ─── Utilitaires ──────────────────────────────
function lockScroll(on) { document.body.style.overflow = on ? 'hidden' : ''; }

function showToast(msg, type='') {
  toast.textContent = msg; toast.className = `toast ${type}`;
  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  });
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function timeAgo(iso) {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60)     return "à l'instant";
  if (d < 3600)   return `il y a ${Math.floor(d/60)} min`;
  if (d < 86400)  return `il y a ${Math.floor(d/3600)} h`;
  if (d < 604800) return `il y a ${Math.floor(d/86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

async function compress(file, maxDim=800, q=.70) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width:w, height:h } = img;
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round(h/w*maxDim); w = maxDim; }
        else        { w = Math.round(w/h*maxDim); h = maxDim; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => b ? resolve(b) : reject(), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}

function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ─── Icônes SVG ───────────────────────────────
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const iconPin    = () => svg('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>');
const iconClock  = () => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>');
const iconUser   = () => svg('<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>');
const iconPerson = () => svg('<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>');
const iconCheck  = () => svg('<polyline points="20 6 9 17 4 12"/>');
const iconHand   = () => svg('<path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0"/><path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2"/><path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/>');
