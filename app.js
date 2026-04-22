/**
 * EduStream AI — app.js  (v4 — admin panel)
 * Auth guard · dynamic username · logout · categories · admin controls
 */

'use strict';

const API = 'api.php';

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
const state = {
  resources:         [],
  categories:        [],
  progress:          {},
  activeCat:         '',
  searchQuery:       '',
  totalRes:          0,
  ratings:           { content: 0, tag: 0 },
  pendingResourceId: null,
  isAdmin:           false,
};

/* ═══════════════════════════════════════════════════════════════
   DOM HELPERS
   ═══════════════════════════════════════════════════════════════ */
const $  = id => document.getElementById(id);
const $grid       = () => $('resourceGrid');
const $empty      = () => $('emptyState');
const $count      = () => $('resultCount');
const $completedN = () => $('completedCount');
const $barFill    = () => $('statBarFill');
const $catList    = () => $('categoryList');
const $overlay    = () => $('modalOverlay');
const $modalTitle = () => $('modalTitle');
const $modalSub   = () => $('modalSub');
const $comment    = () => $('feedbackComment');
const $submitBtn  = () => $('submitBtn');
const $toast      = () => $('toastEl');

/* ── Auth guard ─────────────────────────────────────────────── */
(async function authGuard() {
  let user = null;

  try {
    const stored = sessionStorage.getItem('edu_user');
    if (stored) user = JSON.parse(stored);
  } catch (_) {}

  if (!user) {
    try {
      const res = await fetch(`${API}?action=whoami`);
      if (res.status === 401) { window.location.replace('login.html'); return; }
      const data = await res.json();
      if (data.error) { window.location.replace('login.html'); return; }
      user = { id: data.user_id, username: data.username, is_admin: data.is_admin };
      sessionStorage.setItem('edu_user', JSON.stringify(user));
    } catch (_) {
      window.location.replace('login.html');
      return;
    }
  } else {
    // Refresh is_admin from server in case it changed
    try {
      const res  = await fetch(`${API}?action=whoami`);
      const data = await res.json();
      if (data.user_id) {
        user.is_admin = data.is_admin;
        sessionStorage.setItem('edu_user', JSON.stringify(user));
      }
    } catch (_) {}
  }

  state.isAdmin = !!user.is_admin;

  document.body.classList.add('authed');
  const name = user.username || 'User';
  const el   = $('usernameDisplay');
  const av   = $('userAvatar');
  if (el) el.textContent = name;
  if (av) av.textContent = name.charAt(0).toUpperCase();

  // Inject admin button into topbar if admin
  if (state.isAdmin) injectAdminButton();

  bootApp();
})();

/* ── Inject Admin Panel button ──────────────────────────────── */
function injectAdminButton() {
  const chip = $('userChip') || document.querySelector('.user-chip');
  if (!chip) return;
  const btn = document.createElement('button');
  btn.className   = 'btn-admin-panel';
  btn.title       = 'Admin Panel';
  btn.onclick     = () => openAdminPanel();
  btn.innerHTML   = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/>
    </svg>
    <span class="d-none d-md-inline">Admin</span>`;
  chip.insertBefore(btn, chip.firstChild);
}

/* ── Logout ─────────────────────────────────────────────────── */
function logout() {
  sessionStorage.removeItem('edu_user');
  fetch('auth.php?action=logout', { method: 'GET' })
    .finally(() => { window.location.replace('login.html'); });
}

/* ═══════════════════════════════════════════════════════════════
   RESOURCE TYPE ICONS
   ═══════════════════════════════════════════════════════════════ */
const TYPE_ICONS = {
  Article: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  Video:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
  Course:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  Book:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  Tool:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
};

const LINK_ICON  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const SEND_ICON  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const EDIT_ICON  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;


/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
async function bootApp() {
  showSkeletons(6);
  await Promise.all([loadCategories(), loadProgress()]);
  await loadResources();
  bindSearch();
  bindModal();
}

/* ═══════════════════════════════════════════════════════════════
   CATEGORIES
   ═══════════════════════════════════════════════════════════════ */
async function loadCategories() {
  try {
    const res = await fetch(`${API}?action=categories`, { credentials: 'include' });
    if (res.status === 401) { window.location.replace('login.html'); return; }
    const data = await res.json();
    state.categories = data.categories || [];
    renderCategories();
  } catch (e) {
    console.error('Fetch Error (Categories):', e);
  }
}

function renderCategories() {
  const list = $catList();
  if (!list) return;
  list.innerHTML = state.categories.map(c => `
    <button class="cat-btn ${state.activeCat == c.id ? 'active' : ''}"
            data-cat="${c.id}"
            onclick="filterCategory(this, ${c.id})">
      <span class="cat-icon"><i class="bi ${c.icon}"></i></span>
      ${esc(c.name)}
    </button>
  `).join('');
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESS
   ═══════════════════════════════════════════════════════════════ */
async function loadProgress() {
  try {
    const res  = await fetch(`${API}?action=progress`, { credentials: 'include' });
    const data = await res.json();
    state.progress = data.progress || {};
    updateProgressStat();
  } catch (e) {
    console.error('Fetch Error (Progress):', e);
  }
}

function updateProgressStat() {
  const n  = Object.values(state.progress).filter(s => s === 'Completed').length;
  const el = $completedN();
  if (el) el.textContent = n;
  const fill = $barFill();
  if (fill && state.totalRes > 0) {
    fill.style.width = Math.round((n / state.totalRes) * 100) + '%';
  }
}

/* ═══════════════════════════════════════════════════════════════
   RESOURCES
   ═══════════════════════════════════════════════════════════════ */
async function loadResources() {
  showSkeletons(6);
  const params = new URLSearchParams();
  if (state.activeCat)   params.set('category_id', state.activeCat);
  if (state.searchQuery) params.set('q', state.searchQuery);
  const url = params.toString() ? `${API}?${params}` : API;

  try {
    const res  = await fetch(url, { credentials: 'include' });
    if (res.status === 401) { window.location.replace('login.html'); return; }
    const data = await res.json();
    state.resources = data.resources || [];
    state.totalRes  = state.resources.length;
    renderGrid();
    updateProgressStat();
  } catch (e) {
    $grid().innerHTML =
      '<p style="color:#c0392b;padding:20px;grid-column:1/-1">⚠️ Failed to load resources. Is api.php reachable?</p>';
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER GRID
   ═══════════════════════════════════════════════════════════════ */
function renderGrid() {
  const grid  = $grid();
  const empty = $empty();
  const count = $count();

  if (!state.resources.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    if (count) count.textContent = '';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (count) {
    const n = state.resources.length;
    count.textContent = `${n} resource${n !== 1 ? 's' : ''}`;
  }

  grid.innerHTML = state.resources.map((r, i) => buildCard(r, i)).join('');
}

function buildCard(r, idx) {
  const done     = state.progress[r.id] === 'Completed';
  const typeIcon = TYPE_ICONS[r.resource_type] || TYPE_ICONS.Article;
  const tagChips = (r.tags_array || [])
    .filter(t => t)
    .map(t => `<span class="tag-chip">${esc(t)}</span>`)
    .join('');

  const footerBtn = done
    ? `<button class="btn-complete done" id="btn-${r.id}" disabled>${CHECK_ICON} Completed</button>`
    : `<button class="btn-complete" id="btn-${r.id}" onclick="openModal(${r.id})">${CHECK_ICON} Mark as Complete</button>`;

  const adminActions = state.isAdmin ? `
    <div class="card-admin-actions">
      <button class="btn-card-admin edit"  onclick="openResourceForm(${r.id})" title="Edit resource">${EDIT_ICON} Edit</button>
      <button class="btn-card-admin trash" onclick="deleteResource(${r.id}, '${esc(r.title)}')" title="Delete resource">${TRASH_ICON} Delete</button>
    </div>` : '';

  return `
  <article class="resource-card${done ? ' is-completed' : ''}${state.isAdmin ? ' admin-view' : ''}"
           id="card-${r.id}"
           style="animation-delay:${idx * 55}ms"
           role="listitem">
    ${adminActions}
    <div class="card-header-row">
      <div class="card-type-icon">${typeIcon}</div>
      <span class="diff-badge diff-${r.difficulty_level}">${esc(r.difficulty_level)}</span>
    </div>
    <h2 class="card-title">
      <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>
    </h2>
    <div class="card-meta">
      <span class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${esc(r.author || 'Unknown')}
      </span>
      <span class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        ${esc(r.resource_type)}
      </span>
      <span class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        ${esc(r.category_name)}
      </span>
    </div>
    <p class="card-desc">${esc(r.description)}</p>
    <div class="tags-row">${tagChips}</div>
    <div class="card-footer-row">
      ${footerBtn}
      <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="btn-open-link">
        Open ${LINK_ICON}
      </a>
    </div>
  </article>`;
}

function showSkeletons(n = 6) {
  $grid().innerHTML = Array.from({ length: n }, (_, i) => `
    <div class="skeleton-card" style="animation-delay:${i * 70}ms">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <div class="skel" style="height:38px;width:38px;border-radius:8px;"></div>
        <div class="skel" style="height:22px;width:80px;border-radius:999px;"></div>
      </div>
      <div class="skel" style="height:15px;width:80%;margin-bottom:8px;"></div>
      <div class="skel" style="height:15px;width:60%;margin-bottom:12px;"></div>
      <div class="skel" style="height:10px;width:95%;margin-bottom:6px;"></div>
      <div class="skel" style="height:10px;width:85%;margin-bottom:6px;"></div>
      <div class="skel" style="height:10px;width:70%;margin-bottom:12px;"></div>
      <div style="display:flex;gap:6px;">
        <div class="skel" style="height:20px;width:64px;border-radius:999px;"></div>
        <div class="skel" style="height:20px;width:52px;border-radius:999px;"></div>
        <div class="skel" style="height:20px;width:72px;border-radius:999px;"></div>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR FILTER
   ═══════════════════════════════════════════════════════════════ */
function filterCategory(btn, catId) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.activeCat   = catId;
  state.searchQuery = '';
  $('searchInput').value = '';
  $('searchClear').classList.remove('visible');
  loadResources();
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH
   ═══════════════════════════════════════════════════════════════ */
function bindSearch() {
  const input = $('searchInput');
  const clear = $('searchClear');
  let timer;

  input.addEventListener('input', e => {
    const val = e.target.value.trim();
    clear.classList.toggle('visible', val.length > 0);
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.searchQuery = val;
      state.activeCat   = '';
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      const allBtn = document.querySelector('.cat-btn[data-cat=""]');
      if (allBtn) allBtn.classList.add('active');
      loadResources();
    }, 300);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    clear.classList.remove('visible');
    state.searchQuery = '';
    loadResources();
    input.focus();
  });
}

/* ═══════════════════════════════════════════════════════════════
   FEEDBACK MODAL
   ═══════════════════════════════════════════════════════════════ */
function bindModal() {
  $overlay().addEventListener('click', e => {
    if (e.target === $overlay()) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function openModal(resourceId) {
  state.pendingResourceId = resourceId;
  state.ratings = { content: 0, tag: 0 };
  resetStars('content');
  resetStars('tag');
  $comment().value = '';
  $submitBtn().disabled = true;

  const res = state.resources.find(r => r.id === resourceId);
  if (res) {
    $modalTitle().textContent = res.title;
    $modalSub().textContent   = `${res.resource_type} · ${res.category_name}`;
  }
  $overlay().classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $overlay().classList.remove('open');
  document.body.style.overflow = '';
}

function handleStar(btn, group) {
  const val = parseInt(btn.dataset.val, 10);
  state.ratings[group] = val;
  document.getElementById(`stars-${group}`)
    .querySelectorAll('.star-btn').forEach(s => {
      const v = parseInt(s.dataset.val, 10);
      s.classList.toggle('lit',    v <= val);
      s.classList.toggle('active', v === val);
    });
  $submitBtn().disabled = !(state.ratings.content > 0 && state.ratings.tag > 0);
}

function resetStars(group) {
  state.ratings[group] = 0;
  document.getElementById(`stars-${group}`)
    ?.querySelectorAll('.star-btn')
    .forEach(s => s.classList.remove('lit', 'active'));
}

async function submitFeedback() {
  const btn     = $submitBtn();
  btn.disabled  = true;
  btn.innerHTML = '<span style="opacity:.6">Saving…</span>';
  const resourceId = state.pendingResourceId;

  try {
    const res = await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action:            'feedback',
        resource_id:       resourceId,
        content_relevance: state.ratings.content,
        tag_relevance:     state.ratings.tag,
        comment:           $comment().value.trim(),
      }),
    });

    if (res.status === 401) { window.location.replace('login.html'); return; }
    const data = await res.json();

    if (data.success) {
      state.progress[resourceId] = 'Completed';
      updateProgressStat();
      const cardBtn = $(`btn-${resourceId}`);
      if (cardBtn) cardBtn.outerHTML =
        `<button class="btn-complete done" id="btn-${resourceId}" disabled>${CHECK_ICON} Completed</button>`;
      $(`card-${resourceId}`)?.classList.add('is-completed');
      closeModal();
      showToast('🎉 Marked complete! Thanks for your feedback.', 'success');
    } else {
      showToast(data.error || 'Something went wrong.', 'error');
      btn.disabled  = false;
      btn.innerHTML = `${SEND_ICON} Submit &amp; Mark Complete`;
    }
  } catch (e) {
    showToast('Network error — please try again.', 'error');
    btn.disabled  = false;
    btn.innerHTML = `${SEND_ICON} Submit &amp; Mark Complete`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN — RESOURCE FORM (Add / Edit)
   ═══════════════════════════════════════════════════════════════ */
function openResourceForm(resourceId = null) {
  const res = resourceId ? state.resources.find(r => r.id === resourceId) : null;
  const isEdit = !!res;

  const catOptions = state.categories.map(c =>
    `<option value="${c.id}" ${res && res.category_id == c.id ? 'selected' : ''}>${esc(c.name)}</option>`
  ).join('');

  const diffOptions = ['Beginner','Intermediate','Advanced'].map(d =>
    `<option value="${d}" ${res && res.difficulty_level === d ? 'selected' : ''}>${d}</option>`
  ).join('');

  const typeOptions = ['Article','Video','Course','Book','Tool'].map(t =>
    `<option value="${t}" ${res && res.resource_type === t ? 'selected' : ''}>${t}</option>`
  ).join('');

  showAdminModal(`
    <div class="adm-form-head">
      <h2>${isEdit ? 'Edit Resource' : 'Add New Resource'}</h2>
      <p>${isEdit ? `Editing: ${esc(res.title)}` : 'Add a new learning resource to the platform'}</p>
    </div>
    <div class="adm-form-body">
      <div class="adm-field-row">
        <div class="adm-field">
          <label>Title *</label>
          <input id="af-title" type="text" placeholder="e.g. The Modern JavaScript Tutorial" value="${esc(res?.title || '')}">
        </div>
      </div>
      <div class="adm-field-row">
        <div class="adm-field">
          <label>URL *</label>
          <input id="af-url" type="url" placeholder="https://..." value="${esc(res?.url || '')}">
        </div>
      </div>
      <div class="adm-field-row two-col">
        <div class="adm-field">
          <label>Category *</label>
          <select id="af-category">${catOptions}</select>
        </div>
        <div class="adm-field">
          <label>Difficulty *</label>
          <select id="af-difficulty">${diffOptions}</select>
        </div>
      </div>
      <div class="adm-field-row two-col">
        <div class="adm-field">
          <label>Type *</label>
          <select id="af-type">${typeOptions}</select>
        </div>
        <div class="adm-field">
          <label>Author</label>
          <input id="af-author" type="text" placeholder="e.g. John Doe" value="${esc(res?.author || '')}">
        </div>
      </div>
      <div class="adm-field-row">
        <div class="adm-field">
          <label>Tags <span>(comma-separated)</span></label>
          <input id="af-tags" type="text" placeholder="JavaScript, React, Beginner" value="${esc(res?.tags || '')}">
        </div>
      </div>
      <div class="adm-field-row">
        <div class="adm-field">
          <label>Description</label>
          <textarea id="af-desc" rows="3" placeholder="Describe this resource…">${esc(res?.description || '')}</textarea>
        </div>
      </div>
    </div>
    <div class="adm-form-foot">
      <button class="adm-btn-cancel" onclick="closeAdminModal()">Cancel</button>
      <button class="adm-btn-submit" onclick="submitResourceForm(${resourceId || 'null'})">
        ${isEdit ? `${EDIT_ICON} Save Changes` : '+ Save Resource'}
      </button>
    </div>
  `);
}

async function submitResourceForm(resourceId) {
  const body = {
    action:           resourceId ? 'edit_resource' : 'add_resource',
    id:               resourceId,
    category_id:      parseInt($('af-category').value),
    title:            $('af-title').value.trim(),
    url:              $('af-url').value.trim(),
    difficulty_level: $('af-difficulty').value,
    resource_type:    $('af-type').value,
    author:           $('af-author').value.trim(),
    tags:             $('af-tags').value.trim(),
    description:      $('af-desc').value.trim(),
  };

  const btn = document.querySelector('.adm-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      closeAdminModal();
      showToast(resourceId ? '✅ Resource updated!' : '✅ Resource added!', 'success');
      await loadCategories();
      await loadResources();
    } else {
      showToast(data.error || 'Save failed.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
  } catch (e) {
    showToast('Network error.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}

async function deleteResource(resourceId, title) {
  if (!confirm(`Delete "${title}"?\n\nThis will also remove all user progress for this resource. This cannot be undone.`)) return;

  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'delete_resource', resource_id: resourceId }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('🗑️ Resource deleted.', 'success');
      await loadResources();
    } else {
      showToast(data.error || 'Delete failed.', 'error');
    }
  } catch (e) {
    showToast('Network error.', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN — PANEL (Users + Add Resource button)
   ═══════════════════════════════════════════════════════════════ */
async function openAdminPanel() {
  showAdminModal(`<div class="adm-loading">Loading…</div>`);

  try {
    const res  = await fetch(`${API}?action=admin_users`, { credentials: 'include' });
    const data = await res.json();
    if (data.error) { closeAdminModal(); showToast(data.error, 'error'); return; }
    renderAdminPanel(data.users || []);
  } catch (e) {
    closeAdminModal();
    showToast('Failed to load admin panel.', 'error');
  }
}

function renderAdminPanel(users) {
  const totalResources = state.totalRes;
  const userRows = users.map(u => `
    <tr>
      <td>
        <div class="adm-user-name">
          <div class="adm-user-avatar">${u.username.charAt(0).toUpperCase()}</div>
          <div>
            <div class="adm-user-uname">${esc(u.username)} ${u.is_admin ? '<span class="adm-badge-admin">Admin</span>' : ''}</div>
            <div class="adm-user-email">${esc(u.email)}</div>
          </div>
        </div>
      </td>
      <td><span class="diff-badge diff-${u.preferred_difficulty}">${esc(u.preferred_difficulty)}</span></td>
      <td>
        <div class="adm-progress-wrap">
          <span class="adm-progress-num">${u.completed_count} / ${totalResources}</span>
          <div class="adm-progress-bar">
            <div class="adm-progress-fill" style="width:${totalResources ? Math.round((u.completed_count/totalResources)*100) : 0}%"></div>
          </div>
        </div>
      </td>
      <td>
        <div class="adm-row-actions">
          <button class="adm-btn-sm view"  onclick="openUserDetail(${u.id})">View</button>
          <button class="adm-btn-sm edit"  onclick="openUserEdit(${u.id}, '${esc(u.email)}', '${u.preferred_difficulty}', ${u.is_admin})">Edit</button>
        </div>
      </td>
    </tr>
  `).join('');

  const content = `
    <div class="adm-panel-head">
      <div>
        <h2>Admin Panel</h2>
        <p>${users.length} user${users.length !== 1 ? 's' : ''} · ${totalResources} resource${totalResources !== 1 ? 's' : ''}</p>
      </div>
      <div class="adm-panel-head-actions">
        <button class="adm-btn-primary" onclick="closeAdminModal(); openResourceForm()">+ Add Resource</button>
        <button class="adm-btn-primary secondary" onclick="openAddCategoryForm()">+ Category</button>
      </div>
    </div>
    <div class="adm-panel-body">
      <div class="adm-section-title">Users</div>
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>User</th><th>Level</th><th>Progress</th><th>Actions</th></tr></thead>
          <tbody>${userRows}</tbody>
        </table>
      </div>
    </div>
    <div class="adm-panel-foot">
      <button class="adm-btn-cancel" onclick="closeAdminModal()">Close</button>
    </div>
  `;
  updateAdminModalContent(content);
}

async function openUserDetail(userId) {
  updateAdminModalContent(`<div class="adm-loading">Loading user…</div>`);
  try {
    const res  = await fetch(`${API}?action=admin_user_detail&user_id=${userId}`, { credentials: 'include' });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }

    const { user, progress, feedback } = data;
    const progressRows = progress.length
      ? progress.map(p => `
          <tr>
            <td>${esc(p.title)}</td>
            <td><span class="tag-chip">${esc(p.resource_type)}</span></td>
            <td><span class="tag-chip">${esc(p.category_name)}</span></td>
            <td><span class="diff-badge diff-${p.status.replace(' ','-')}">${esc(p.status)}</span></td>
            <td style="font-size:.75rem;color:var(--c-muted)">${new Date(p.updated_at).toLocaleDateString()}</td>
          </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:var(--c-muted);padding:20px">No progress yet</td></tr>`;

    const feedbackRows = feedback.length
      ? feedback.map(f => `
          <tr>
            <td>${esc(f.title)}</td>
            <td>⭐ ${f.content_relevance}/5</td>
            <td>🏷️ ${f.tag_relevance}/5</td>
            <td style="font-size:.78rem">${esc(f.comment || '—')}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--c-muted);padding:20px">No feedback yet</td></tr>`;

    updateAdminModalContent(`
      <div class="adm-panel-head">
        <div>
          <h2>${esc(user.username)} ${user.is_admin ? '<span class="adm-badge-admin">Admin</span>' : ''}</h2>
          <p>${esc(user.email)} · Joined ${new Date(user.created_at).toLocaleDateString()}</p>
        </div>
        <div class="adm-panel-head-actions">
          <button class="adm-btn-primary secondary" onclick="openAdminPanel()">← Back</button>
        </div>
      </div>
      <div class="adm-panel-body">
        <div class="adm-section-title">Learning Progress (${progress.length} resources)</div>
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead><tr><th>Resource</th><th>Type</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${progressRows}</tbody>
          </table>
        </div>
        <div class="adm-section-title" style="margin-top:24px">Feedback Submitted (${feedback.length})</div>
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead><tr><th>Resource</th><th>Content</th><th>Tags</th><th>Comment</th></tr></thead>
            <tbody>${feedbackRows}</tbody>
          </table>
        </div>
      </div>
      <div class="adm-panel-foot">
        <button class="adm-btn-danger" onclick="confirmResetProgress(${user.id}, '${esc(user.username)}')">Reset All Progress</button>
        <button class="adm-btn-cancel" onclick="closeAdminModal()">Close</button>
      </div>
    `);
  } catch (e) {
    showToast('Failed to load user detail.', 'error');
  }
}

function openUserEdit(userId, email, difficulty, isAdmin) {
  const diffOptions = ['Beginner','Intermediate','Advanced'].map(d =>
    `<option value="${d}" ${difficulty === d ? 'selected' : ''}>${d}</option>`
  ).join('');

  showAdminModal(`
    <div class="adm-form-head">
      <h2>Edit User</h2>
      <p>Update user settings and permissions</p>
    </div>
    <div class="adm-form-body">
      <div class="adm-field-row">
        <div class="adm-field">
          <label>Email</label>
          <input id="ue-email" type="email" value="${esc(email)}" placeholder="user@example.com">
        </div>
      </div>
      <div class="adm-field-row">
        <div class="adm-field">
          <label>Preferred Difficulty</label>
          <select id="ue-difficulty">${diffOptions}</select>
        </div>
      </div>
      <div class="adm-field-row">
        <div class="adm-field adm-field-check">
          <label class="adm-check-label">
            <input type="checkbox" id="ue-admin" ${isAdmin ? 'checked' : ''}>
            <span>Admin privileges</span>
          </label>
          <p class="adm-field-hint">Grants access to admin panel, resource management, and user controls.</p>
        </div>
      </div>
    </div>
    <div class="adm-form-foot">
      <button class="adm-btn-cancel" onclick="closeAdminModal()">Cancel</button>
      <button class="adm-btn-submit" onclick="submitUserEdit(${userId})">${EDIT_ICON} Save Changes</button>
    </div>
  `);
}

async function submitUserEdit(userId) {
  const body = {
    action:               'edit_user',
    user_id:              userId,
    email:                $('ue-email').value.trim(),
    preferred_difficulty: $('ue-difficulty').value,
    is_admin:             $('ue-admin').checked,
  };

  const btn = document.querySelector('.adm-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      closeAdminModal();
      showToast('✅ User updated!', 'success');
    } else {
      showToast(data.error || 'Update failed.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    }
  } catch (e) {
    showToast('Network error.', 'error');
    if (btn) { btn.disabled = false; }
  }
}

async function confirmResetProgress(userId, username) {
  if (!confirm(`Reset ALL progress and feedback for "${username}"?\n\nThis cannot be undone.`)) return;
  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'reset_progress', user_id: userId }),
    });
    const data = await res.json();
    if (data.success) {
      closeAdminModal();
      showToast(`🗑️ ${username}'s progress reset.`, 'success');
    } else {
      showToast(data.error || 'Reset failed.', 'error');
    }
  } catch (e) {
    showToast('Network error.', 'error');
  }
}

function openAddCategoryForm() {
  showAdminModal(`
    <div class="adm-form-head">
      <h2>Add New Category</h2>
      <p>Create a new category for resources</p>
    </div>
    <div class="adm-form-body">
      <div class="adm-field-row">
        <div class="adm-field">
          <label>Name *</label>
          <input id="ac-name" type="text" placeholder="e.g. Data Science">
        </div>
      </div>
      <div class="adm-field-row two-col">
        <div class="adm-field">
          <label>Slug * <span>(URL-friendly)</span></label>
          <input id="ac-slug" type="text" placeholder="e.g. data-science">
        </div>
        <div class="adm-field">
          <label>Bootstrap Icon <span>(bi-xxx)</span></label>
          <input id="ac-icon" type="text" placeholder="bi-graph-up" value="bi-folder">
        </div>
      </div>
      <p style="font-size:.78rem;color:var(--c-muted);margin-top:-6px">
        Browse icons at <a href="https://icons.getbootstrap.com" target="_blank">icons.getbootstrap.com</a>
      </p>
    </div>
    <div class="adm-form-foot">
      <button class="adm-btn-cancel" onclick="closeAdminModal()">Cancel</button>
      <button class="adm-btn-submit" onclick="submitAddCategory()">+ Save Category</button>
    </div>
  `);

  // Auto-slug from name
  $('ac-name').addEventListener('input', e => {
    const slug = e.target.value.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    $('ac-slug').value = slug;
  });
}

async function submitAddCategory() {
  const body = {
    action: 'add_category',
    name:   $('ac-name').value.trim(),
    slug:   $('ac-slug').value.trim(),
    icon:   $('ac-icon').value.trim() || 'bi-folder',
  };

  const btn = document.querySelector('.adm-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      closeAdminModal();
      showToast('✅ Category added!', 'success');
      await loadCategories();
    } else {
      showToast(data.error || 'Save failed.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '+ Save Category'; }
    }
  } catch (e) {
    showToast('Network error.', 'error');
    if (btn) { btn.disabled = false; }
  }
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN MODAL SHELL
   ═══════════════════════════════════════════════════════════════ */
let _adminModalEl = null;

function showAdminModal(innerHtml) {
  if (!_adminModalEl) {
    _adminModalEl = document.createElement('div');
    _adminModalEl.id = 'adminModalOverlay';
    _adminModalEl.className = 'admin-modal-overlay';
    _adminModalEl.addEventListener('click', e => {
      if (e.target === _adminModalEl) closeAdminModal();
    });
    document.body.appendChild(_adminModalEl);
  }
  _adminModalEl.innerHTML = `<div class="admin-modal-box">${innerHtml}</div>`;
  _adminModalEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateAdminModalContent(innerHtml) {
  if (_adminModalEl) {
    _adminModalEl.innerHTML = `<div class="admin-modal-box">${innerHtml}</div>`;
  }
}

function closeAdminModal() {
  if (_adminModalEl) _adminModalEl.classList.remove('open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const t   = $toast();
  const ico = type === 'success'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  t.className  = `show ${type}`;
  t.innerHTML  = `${ico}<span>${msg}</span>`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = type; }, 3500);
}

/* ═══════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════ */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}