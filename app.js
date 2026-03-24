/**
 * EduStream AI — app.js  (v2)
 * Auth guard · dynamic username · logout · 4 categories · all interactions
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

/* ── Auth guard: redirect to login if no session ──────────────
   Uses sessionStorage (set by login.html on success).
   Falls back to a whoami API call to confirm PHP session.   */
(async function authGuard() {
  let user = null;

  /* 1. Check sessionStorage first (fast) */
  try {
    const stored = sessionStorage.getItem('edu_user');
    if (stored) user = JSON.parse(stored);
  } catch (_) {}

  if (!user) {
    /* 2. Confirm with server */
    try {
      const res = await fetch(`${API}?action=whoami`);
      if (res.status === 401) {
        window.location.replace('login.html');
        return;
      }
      const data = await res.json();
      if (data.error) { window.location.replace('login.html'); return; }
      user = { id: data.user_id, username: data.username };
      sessionStorage.setItem('edu_user', JSON.stringify(user));
    } catch (_) {
      window.location.replace('login.html');
      return;
    }
  }

  /* Show body + populate UI */
  document.body.classList.add('authed');
  const name = user.username || 'User';
  const el   = document.getElementById('usernameDisplay');
  const av   = document.getElementById('userAvatar');
  if (el) el.textContent = name;
  if (av) av.textContent = name.charAt(0).toUpperCase();

  /* Boot the rest of the app */
  bootApp();
})();

/* ── Logout ───────────────────────────────────────────────────── */
function logout() {
  sessionStorage.removeItem('edu_user');
  /* Hit the PHP logout endpoint to destroy the server session */
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
    console.log('Categories Status:', res.status); // Should be 200
    
    if (res.status === 401) {
      console.error('Session Expired: Redirecting to login.');
      window.location.replace('login.html');
      return;
    }

    const data = await res.json();
    console.log('Categories Data:', data);
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
    const res = await fetch(`${API}?action=progress`, { credentials: 'include' });
    console.log('Progress Status:', res.status);

    const data = await res.json();
    console.log('Progress Data:', data);
    state.progress = data.progress || {};
    updateProgressStat();
  } catch (e) {
    console.error('Fetch Error (Progress):', e);
  }
}

function updateProgressStat() {
  const n = Object.values(state.progress).filter(s => s === 'Completed').length;
  const el = $completedN();
  if (el) el.textContent = n;

  const fill = $barFill();
  if (fill && state.totalRes > 0) {
    // Ensure the math uses the count of resources currently in the state
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
    const res = await fetch(url, { credentials: 'include' });
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

  return `
  <article class="resource-card${done ? ' is-completed' : ''}"
           id="card-${r.id}"
           style="animation-delay:${idx * 55}ms"
           role="listitem">
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
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('visible');
  loadResources();
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH
   ═══════════════════════════════════════════════════════════════ */
function bindSearch() {
  const input = document.getElementById('searchInput');
  const clear = document.getElementById('searchClear');
  let timer;

  input.addEventListener('input', e => {
    const val = e.target.value.trim();
    clear.classList.toggle('visible', val.length > 0);
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.searchQuery = val;
      state.activeCat   = '';
      // Reset active state on sidebar buttons
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      // Find the "All Resources" button (the one with empty data-cat)
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
   MODAL
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

/* ── Stars ──────────────────────────────────────────────────── */
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

/* ── Submit feedback ────────────────────────────────────────── */
async function submitFeedback() {
  const btn        = $submitBtn();
  btn.disabled     = true;
  btn.innerHTML    = '<span style="opacity:.6">Saving…</span>';
  const resourceId = state.pendingResourceId;

  try {
    const res = await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Add this here too
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

      const cardBtn = document.getElementById(`btn-${resourceId}`);
      if (cardBtn) cardBtn.outerHTML =
        `<button class="btn-complete done" id="btn-${resourceId}" disabled>${CHECK_ICON} Completed</button>`;
      document.getElementById(`card-${resourceId}`)?.classList.add('is-completed');

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
