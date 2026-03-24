/**
 * EduStream AI — app.js
 * All frontend logic: data fetching, rendering, search,
 * category filter, feedback modal, star ratings, toast.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════════════ */
const API = 'api.php';

/* Resource type → SVG icon map */
const TYPE_ICONS = {
  Article: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  Video:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
  Course:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  Book:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  Tool:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
};

const LINK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const SEND_ICON  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
const state = {
  resources:   [],
  categories:  [],
  progress:    {},      // { [resource_id]: 'Completed' | 'Saved' | ... }
  activeCat:   '',      // '' = All
  searchQuery: '',
  totalRes:    0,
  ratings: { content: 0, tag: 0 },
  pendingResourceId: null,
};

/* ═══════════════════════════════════════════════════════════════
   DOM REFS
   ═══════════════════════════════════════════════════════════════ */
const $grid        = () => document.getElementById('resourceGrid');
const $empty       = () => document.getElementById('emptyState');
const $count       = () => document.getElementById('resultCount');
const $completedN  = () => document.getElementById('completedCount');
const $barFill     = () => document.getElementById('statBarFill');
const $catList     = () => document.getElementById('categoryList');
const $searchInput = () => document.getElementById('searchInput');
const $searchClear = () => document.getElementById('searchClear');
const $overlay     = () => document.getElementById('modalOverlay');
const $modalTitle  = () => document.getElementById('modalTitle');
const $modalSub    = () => document.getElementById('modalSub');
const $comment     = () => document.getElementById('feedbackComment');
const $submitBtn   = () => document.getElementById('submitBtn');
const $toast       = () => document.getElementById('toastEl');

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  showSkeletons();
  await Promise.all([loadCategories(), loadProgress()]);
  await loadResources();
  bindSearch();
  bindModal();
});

/* ═══════════════════════════════════════════════════════════════
   FETCH CATEGORIES  (build sidebar dynamically)
   ═══════════════════════════════════════════════════════════════ */
async function loadCategories() {
  try {
    const res  = await fetch(`${API}?action=categories`);
    const data = await res.json();
    state.categories = data.categories || [];
    renderCategories();
  } catch (e) {
    console.warn('Could not load categories', e);
  }
}

function renderCategories() {
  const list = $catList();
  if (!list) return;
  list.innerHTML = state.categories.map(c => `
    <button class="cat-btn" data-cat="${c.id}" onclick="filterCategory(this, '${c.id}')">
      <span class="cat-icon"><i class="${c.icon}"></i></span>
      ${esc(c.name)}
    </button>
  `).join('');
}

/* ═══════════════════════════════════════════════════════════════
   FETCH PROGRESS
   ═══════════════════════════════════════════════════════════════ */
async function loadProgress() {
  try {
    const res  = await fetch(`${API}?action=progress`);
    const data = await res.json();
    state.progress = data.progress || {};
    updateProgressStat();
  } catch (e) {
    console.warn('Could not load progress', e);
  }
}

function updateProgressStat() {
  const n = Object.values(state.progress).filter(s => s === 'Completed').length;
  const el = $completedN();
  if (el) el.textContent = n;

  const fill = $barFill();
  if (fill && state.totalRes > 0) {
    fill.style.width = Math.round((n / state.totalRes) * 100) + '%';
  }
}

/* ═══════════════════════════════════════════════════════════════
   FETCH RESOURCES
   ═══════════════════════════════════════════════════════════════ */
async function loadResources() {
  showSkeletons();

  const params = new URLSearchParams();
  if (state.activeCat)   params.set('category_id', state.activeCat);
  if (state.searchQuery) params.set('q', state.searchQuery);

  const url = params.toString() ? `${API}?${params}` : API;

  try {
    const res  = await fetch(url);
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
    if (empty)  { empty.style.display = 'flex'; }
    if (count)  { count.textContent = ''; }
    return;
  }

  if (empty) empty.style.display = 'none';
  if (count) {
    const n = state.resources.length;
    count.textContent = `${n} resource${n !== 1 ? 's' : ''}`;
  }

  grid.innerHTML = state.resources
    .map((r, i) => buildCard(r, i))
    .join('');
}

function buildCard(r, idx) {
  const done      = state.progress[r.id] === 'Completed';
  const typeIcon  = TYPE_ICONS[r.resource_type] || TYPE_ICONS.Article;
  const tagChips  = (r.tags_array || [])
    .filter(t => t)
    .map(t => `<span class="tag-chip">${esc(t)}</span>`)
    .join('');

  const footerBtn = done
    ? `<button class="btn-complete done" id="btn-${r.id}" disabled>
         ${CHECK_ICON} Completed
       </button>`
    : `<button class="btn-complete" id="btn-${r.id}"
              onclick="openModal(${r.id})">
         ${CHECK_ICON} Mark as Complete
       </button>`;

  return `
  <article class="resource-card${done ? ' is-completed' : ''}"
           id="card-${r.id}"
           style="animation-delay: ${idx * 55}ms">

    <div class="card-header-row">
      <div class="card-type-icon">${typeIcon}</div>
      <span class="diff-badge diff-${r.difficulty_level}">${esc(r.difficulty_level)}</span>
    </div>

    <h2 class="card-title">
      <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
        ${esc(r.title)}
      </a>
    </h2>

    <div class="card-meta">
      <span class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${esc(r.author || 'Unknown')}
      </span>
      <span class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
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

function showSkeletons(n = 3) {
  const grid = $grid();
  grid.innerHTML = Array.from({ length: n }, (_, i) => `
    <div class="skeleton-card" style="animation-delay:${i*80}ms">
      <div class="skel" style="height:38px;width:38px;border-radius:8px;margin-bottom:4px;"></div>
      <div class="skel" style="height:14px;width:75%;margin-top:8px;"></div>
      <div class="skel" style="height:10px;width:50%;"></div>
      <div class="skel" style="height:10px;width:90%;"></div>
      <div class="skel" style="height:10px;width:80%;"></div>
      <div class="skel" style="height:10px;width:65%;"></div>
      <div style="display:flex;gap:6px;margin-top:4px;">
        <div class="skel" style="height:20px;width:60px;border-radius:999px;"></div>
        <div class="skel" style="height:20px;width:50px;border-radius:999px;"></div>
        <div class="skel" style="height:20px;width:70px;border-radius:999px;"></div>
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
  $searchInput().value = '';
  $searchClear().classList.remove('visible');

  loadResources();
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH
   ═══════════════════════════════════════════════════════════════ */
function bindSearch() {
  const input = $searchInput();
  const clear = $searchClear();
  let timer;

  input.addEventListener('input', e => {
    const val = e.target.value.trim();
    clear.classList.toggle('visible', val.length > 0);

    clearTimeout(timer);
    timer = setTimeout(() => {
      state.searchQuery = val;
      state.activeCat   = '';
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.cat-btn[data-cat=""]')?.classList.add('active');
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
  /* Close on overlay backdrop click */
  $overlay().addEventListener('click', e => {
    if (e.target === $overlay()) closeModal();
  });

  /* ESC key */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function openModal(resourceId) {
  state.pendingResourceId = resourceId;
  state.ratings = { content: 0, tag: 0 };

  const res = state.resources.find(r => r.id === resourceId);

  /* Reset UI */
  resetStars('content');
  resetStars('tag');
  $comment().value = '';
  $submitBtn().disabled = true;

  /* Populate header */
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

/* ── Stars ────────────────────────────────────────────────── */
function handleStar(btn, group) {
  const val = parseInt(btn.dataset.val, 10);
  state.ratings[group] = val;

  const row = document.getElementById(`stars-${group}`);
  row.querySelectorAll('.star-btn').forEach(s => {
    const v = parseInt(s.dataset.val, 10);
    s.classList.toggle('lit', v <= val);
    s.classList.toggle('active', v === val);
  });

  /* Enable submit only when both rated */
  $submitBtn().disabled = !(state.ratings.content > 0 && state.ratings.tag > 0);
}

function resetStars(group) {
  state.ratings[group] = 0;
  document.getElementById(`stars-${group}`)
    ?.querySelectorAll('.star-btn')
    .forEach(s => { s.classList.remove('lit', 'active'); });
}

/* ── Submit ───────────────────────────────────────────────── */
async function submitFeedback() {
  const btn = $submitBtn();
  btn.disabled = true;
  btn.innerHTML = '<span style="opacity:.6">Saving…</span>';

  const resourceId = state.pendingResourceId;

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:            'feedback',
        resource_id:       resourceId,
        content_relevance: state.ratings.content,
        tag_relevance:     state.ratings.tag,
        comment:           $comment().value.trim(),
      }),
    });
    const data = await res.json();

    if (data.success) {
      /* Update local progress */
      state.progress[resourceId] = 'Completed';
      updateProgressStat();

      /* Swap card button */
      const cardBtn = document.getElementById(`btn-${resourceId}`);
      if (cardBtn) {
        cardBtn.outerHTML = `
          <button class="btn-complete done" id="btn-${resourceId}" disabled>
            ${CHECK_ICON} Completed
          </button>`;
      }
      /* Mark card style */
      document.getElementById(`card-${resourceId}`)
        ?.classList.add('is-completed');

      closeModal();
      showToast('🎉 Marked complete! Thanks for your feedback.', 'success');
    } else {
      showToast(data.error || 'Something went wrong.', 'error');
      btn.disabled = false;
      btn.innerHTML = `${SEND_ICON} Submit &amp; Mark Complete`;
    }
  } catch (e) {
    showToast('Network error — please try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = `${SEND_ICON} Submit &amp; Mark Complete`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const t = $toast();
  t.className = `show ${type}`;

  const icon = type === 'success'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  t.innerHTML = `${icon}<span>${msg}</span>`;

  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = type; }, 3500);
}

/* ═══════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════ */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
