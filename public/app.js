/* ================================================
   NC Signal — Application
   ================================================ */

let allNCs       = [];
let filter       = 'all';
let pendingAct   = null; // { id, type: 'take' | 'resolve' }

// ─── DOM ──────────────────────────────────────
const feed         = document.getElementById('feed');
const headerBadge  = document.getElementById('headerBadge');
const fab          = document.getElementById('fab');

// Add modal
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

// Action modal
const actionOverlay = document.getElementById('actionOverlay');
const dialogIcon    = document.getElementById('dialogIcon');
const dialogTitle   = document.getElementById('dialogTitle');
const dialogSub     = document.getElementById('dialogSub');
const actionName    = document.getElementById('actionName');
const cancelAction  = document.getElementById('cancelAction');
const confirmAction = document.getElementById('confirmAction');
const confirmText   = document.getElementById('confirmText');

const toast         = document.getElementById('toast');

// ─── Boot ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadNCs();
  wireEvents();
  setInterval(loadNCs, 30_000);
});

// ─── API ──────────────────────────────────────
async function loadNCs() {
  try {
    const r = await fetch('/api/ncs');
    allNCs = await r.json();
    render();
    renderBadge();
  } catch {
    if (feed.querySelector('.loader')) {
      feed.innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠️</div>
          <h3>Connexion impossible</h3>
          <p>Vérifiez que le serveur est lancé.</p>
        </div>`;
    }
  }
}

async function apiPost(url, body, isForm) {
  const opts = isForm
    ? { method: 'POST', body }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const r = await fetch(url, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

async function apiPatch(url, body) {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// ─── Rendu ────────────────────────────────────
function render() {
  const list = filter === 'all' ? allNCs : allNCs.filter(n => n.status === filter);

  if (!list.length) {
    const msgs = {
      all:      ['✅', 'Aucune non-conformité', 'Tout est en ordre !'],
      pending:  ['🎉', 'Aucune NC en attente',  'Tout est pris en charge !'],
      taken:    ['👌', 'Aucune NC en cours',     ''],
      resolved: ['📋', 'Aucune NC résolue',      ''],
    };
    const [icon, title, sub] = msgs[filter];
    feed.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${icon}</div>
        <h3>${title}</h3>
        ${sub ? `<p>${sub}</p>` : ''}
      </div>`;
    return;
  }

  feed.innerHTML = list.map((nc, i) => cardHTML(nc, i)).join('');
}

function renderBadge() {
  const active = allNCs.filter(n => n.status !== 'resolved').length;
  headerBadge.textContent = active === 0
    ? 'Tout est résolu ✓'
    : `${active} active${active > 1 ? 's' : ''}`;
}

function cardHTML(nc, i) {
  const STATUS = {
    pending:  { label: 'En attente', cls: 'badge-pending'  },
    taken:    { label: 'En cours',   cls: 'badge-taken'    },
    resolved: { label: 'Résolu',     cls: 'badge-resolved' },
  };
  const s     = STATUS[nc.status] || STATUS.pending;
  const delay = `animation-delay:${Math.min(i * .045, .3)}s`;

  const photoEl = nc.photo
    ? `<img class="card-photo" src="${nc.photo}" alt="${esc(nc.title)}"
            loading="lazy"
            onerror="this.outerHTML='<div class=card-photo-ph>📷</div>'">`
    : `<div class="card-photo-ph">📷</div>`;

  let byLine = '';
  if (nc.status === 'taken'    && nc.takenBy)    byLine = metaRow(iconPerson(), `Pris en charge par <strong>${esc(nc.takenBy)}</strong>`);
  if (nc.status === 'resolved' && nc.resolvedBy) byLine = `<div class="meta-row resolved-by">${iconCheck()}Résolu par <strong>${esc(nc.resolvedBy)}</strong></div>`;

  let action = '';
  if (nc.status === 'pending') {
    action = `
      <div class="card-sep"></div>
      <button class="btn-take" onclick="openAction(${nc.id},'take')">
        ${iconHand()} Je m'en occupe
      </button>`;
  } else if (nc.status === 'taken') {
    action = `
      <div class="card-sep"></div>
      <button class="btn-take btn-resolve" onclick="openAction(${nc.id},'resolve')">
        ${iconCheck()} C'est fait !
      </button>`;
  }

  return `
    <article class="card" data-id="${nc.id}" style="${delay}">
      ${photoEl}
      <div class="card-body">
        <div class="card-top">
          <h2 class="card-title">${esc(nc.title)}</h2>
          <span class="badge ${s.cls}"><span class="badge-dot"></span>${s.label}</span>
        </div>
        <div class="card-meta">
          ${nc.location ? metaRow(iconPin(),    esc(nc.location)) : ''}
          ${metaRow(iconClock(), timeAgo(nc.createdAt))}
          ${metaRow(iconUser(), `Signalé par <strong>${esc(nc.reporter || 'Anonyme')}</strong>`)}
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
  // Tabs
  document.getElementById('tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    filter = tab.dataset.f;
    render();
  });

  // FAB → ouvrir ajout
  fab.addEventListener('click', openAdd);

  // Fermer ajout
  closeAdd.addEventListener('click', closeAdd_);
  addOverlay.addEventListener('click', e => { if (e.target === addOverlay) closeAdd_(); });

  // Photo
  photoZone.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', onPhotoChange);

  // Formulaire
  addForm.addEventListener('submit', onAddSubmit);

  // Action modal
  cancelAction.addEventListener('click', closeAction);
  actionOverlay.addEventListener('click', e => { if (e.target === actionOverlay) closeAction(); });
  confirmAction.addEventListener('click', onConfirm);
  actionName.addEventListener('keydown', e => { if (e.key === 'Enter') onConfirm(); });
}

// ─── Modal Ajout ──────────────────────────────
function openAdd() {
  addOverlay.classList.add('open');
  fab.classList.add('open');
  lockScroll(true);
  setTimeout(() => fTitle.focus(), 380);
}

function closeAdd_() {
  addOverlay.classList.remove('open');
  fab.classList.remove('open');
  lockScroll(false);
  setTimeout(resetAddForm, 300);
}

function resetAddForm() {
  addForm.reset();
  photoPreview.hidden  = true;
  photoPreview.src     = '';
  photoEmpty.hidden    = false;
  changePhoto.hidden   = true;
  photoZone.style.borderStyle  = 'dashed';
  photoZone.style.borderColor  = '';
  photoInput._blob     = null;
  submitAdd.disabled   = false;
  submitText.textContent = 'Signaler';
}

async function onPhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const blob = await compress(file);
    photoInput._blob  = new File([blob], file.name, { type: 'image/jpeg' });
  } catch {
    photoInput._blob  = file;
  }
  const url = URL.createObjectURL(photoInput._blob || file);
  photoPreview.src     = url;
  photoPreview.hidden  = false;
  photoEmpty.hidden    = true;
  changePhoto.hidden   = false;
  photoZone.style.borderStyle = 'solid';
  photoZone.style.borderColor = 'var(--green)';
}

async function onAddSubmit(e) {
  e.preventDefault();
  const title = fTitle.value.trim();
  if (!title) { fTitle.focus(); return; }

  submitAdd.disabled     = true;
  submitText.textContent = 'Envoi…';

  const fd = new FormData();
  fd.append('title',    title);
  fd.append('location', fLocation.value.trim());
  fd.append('reporter', fReporter.value.trim() || 'Anonyme');
  if (photoInput._blob) fd.append('photo', photoInput._blob);

  try {
    const nc = await apiPost('/api/ncs', fd, true);
    allNCs.unshift(nc);
    render();
    renderBadge();
    closeAdd_();
    showToast('NC signalée avec succès !', 'ok');
  } catch (err) {
    showToast(err.message, 'err');
    submitAdd.disabled     = false;
    submitText.textContent = 'Signaler';
  }
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
  actionName.value         = '';
  confirmAction.disabled   = false;
  confirmText.textContent  = 'Confirmer';
  actionOverlay.classList.add('open');
  lockScroll(true);
  setTimeout(() => actionName.focus(), 350);
}

function closeAction() {
  actionOverlay.classList.remove('open');
  lockScroll(false);
  pendingAct = null;
}

async function onConfirm() {
  if (!pendingAct) return;
  const name = actionName.value.trim();
  if (!name) {
    actionName.classList.add('shake');
    actionName.addEventListener('animationend', () => actionName.classList.remove('shake'), { once: true });
    actionName.focus();
    return;
  }

  confirmAction.disabled  = true;
  confirmText.textContent = '…';

  try {
    const url     = `/api/ncs/${pendingAct.id}/${pendingAct.type === 'take' ? 'take' : 'resolve'}`;
    const updated = await apiPatch(url, { name });

    const idx = allNCs.findIndex(n => n.id === updated.id);
    if (idx !== -1) allNCs[idx] = updated;

    const msg = pendingAct.type === 'take'
      ? `Pris en charge par ${name} 👍`
      : `Résolu par ${name} ✅`;

    render();
    renderBadge();
    closeAction();
    showToast(msg, 'ok');
  } catch (err) {
    showToast(err.message, 'err');
    confirmAction.disabled  = false;
    confirmText.textContent = 'Confirmer';
  }
}

// ─── Utilitaires ──────────────────────────────
function lockScroll(on) {
  document.body.style.overflow = on ? 'hidden' : '';
}

function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
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
  const d    = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60)     return "à l'instant";
  if (d < 3600)   return `il y a ${Math.floor(d/60)} min`;
  if (d < 86400)  return `il y a ${Math.floor(d/3600)} h`;
  if (d < 604800) return `il y a ${Math.floor(d/86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

async function compress(file, maxDim = 1280, q = .82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
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

// ─── Icônes SVG ───────────────────────────────
const svg = (d, vb='0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const iconPin   = () => svg('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>');
const iconClock = () => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>');
const iconUser  = () => svg('<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>');
const iconPerson= () => svg('<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>');
const iconCheck = () => svg('<polyline points="20 6 9 17 4 12"/>');
const iconHand  = () => svg('<path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0"/><path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2"/><path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/>');
