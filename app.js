/* ============================================================
   EduStream AI — Single-Page Application
   All UI rendering lives here. PHP is only ever called via
   fetch() to api/*.php endpoints which return JSON.
   ============================================================ */

const API = 'api';                    // base path for PHP endpoints
let   currentUser = null;            // cached after login/me check

// ── Utility: fetch wrapper ────────────────────────────────
async function apiFetch(url, options = {}) {
  const res  = await fetch(url, { credentials: 'same-origin', ...options });
  const data = await res.json();
  return data;                        // { ok, data } or { ok, error }
}

async function apiGet(endpoint, params = {}) {
  const qs  = new URLSearchParams(params).toString();
  const url = `${API}/${endpoint}${qs ? '?' + qs : ''}`;
  return apiFetch(url);
}

async function apiPost(endpoint, body = {}, params = {}) {
  const qs  = new URLSearchParams(params).toString();
  const url = `${API}/${endpoint}${qs ? '?' + qs : ''}`;
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Toast notifications ───────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `es-toast ${type}`;
  el.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Spinner ────────────────────────────────────────────────
function spinner(msg = 'Loading…') {
  return `<div class="es-spinner">
    <div class="spinner-border" role="status"></div>
    <p>${msg}</p>
  </div>`;
}

// ── Difficulty badge ───────────────────────────────────────
function diffBadge(level) {
  const cls = { Beginner: 'badge-beginner', Intermediate: 'badge-intermediate', Advanced: 'badge-advanced' };
  return `<span class="badge ${cls[level] || 'bg-secondary'}">${level}</span>`;
}

// ── Render helper: set #app content & scroll top ──────────
function render(html) {
  const app = document.getElementById('app');
  app.innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Nav state ──────────────────────────────────────────────
function setActiveNav(page) {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

// ── Auth guard ─────────────────────────────────────────────
function showNav(visible) {
  document.getElementById('navbar').style.display = visible ? '' : 'none';
  document.getElementById('footer').style.display = visible ? '' : 'none';
}

// ══════════════════════════════════════════════════════════
//  PAGES
// ══════════════════════════════════════════════════════════

// ── LOGIN ──────────────────────────────────────────────────
function renderLogin() {
  showNav(false);
  render(`
    <div class="auth-wrap fade-up">
      <div class="text-center mb-4">
        <div class="es-brand" style="font-size:1.4rem;display:block;margin-bottom:.5rem;">EduStream<span>_AI</span></div>
        <p class="es-heading mb-1">Welcome <span class="accent">Back</span></p>
        <p class="text-muted" style="font-size:.9rem;">Sign in to continue learning</p>
      </div>
      <div id="login-error"></div>
      <div class="es-card no-hover">
        <div class="mb-3">
          <label class="form-label">Email Address</label>
          <div class="input-group">
            <span class="input-group-text"><i class="bi bi-envelope"></i></span>
            <input type="email" id="l-email" class="form-control" placeholder="you@example.com" />
          </div>
        </div>
        <div class="mb-4">
          <label class="form-label">Password</label>
          <div class="input-group">
            <span class="input-group-text"><i class="bi bi-lock"></i></span>
            <input type="password" id="l-pass" class="form-control" placeholder="••••••••" />
          </div>
        </div>
        <button class="btn-es w-100" style="padding:.7rem;" id="btn-login">
          <i class="bi bi-box-arrow-in-right me-2"></i>Sign In
        </button>
      </div>
      <p class="text-center mt-3" style="font-size:.875rem;color:var(--es-muted);">
        Don't have an account? <a href="#" id="go-register">Create one</a>
      </p>
    </div>
  `);

  document.getElementById('go-register').addEventListener('click', e => { e.preventDefault(); renderRegister(); });

  const doLogin = async () => {
    const btn   = document.getElementById('btn-login');
    const email = document.getElementById('l-email').value.trim();
    const pass  = document.getElementById('l-pass').value;
    const errEl = document.getElementById('login-error');

    errEl.innerHTML = '';
    if (!email || !pass) { errEl.innerHTML = alert_html('Email and password are required.'); return; }

    btn.disabled = true; btn.textContent = 'Signing in…';
    const res = await apiPost('auth.php', { email, password: pass }, { action: 'login' });
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In';

    if (res.ok) {
      currentUser = res.data;
      toast(`Welcome back, ${currentUser.username}!`);
      showNav(true);
      renderDashboard();
    } else {
      errEl.innerHTML = alert_html(res.error);
    }
  };

  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

// ── REGISTER ───────────────────────────────────────────────
function renderRegister() {
  showNav(false);
  render(`
    <div class="auth-wrap fade-up">
      <div class="text-center mb-4">
        <div class="es-brand" style="font-size:1.4rem;display:block;margin-bottom:.5rem;">EduStream<span>_AI</span></div>
        <p class="es-heading mb-1">Create Your <span class="accent">Account</span></p>
        <p class="text-muted" style="font-size:.9rem;">Join thousands of learners</p>
      </div>
      <div id="reg-error"></div>
      <div class="es-card no-hover">
        <div class="row g-3 mb-3">
          <div class="col-12">
            <label class="form-label">Username</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-person"></i></span>
              <input type="text" id="r-user" class="form-control" placeholder="Jane Doe" />
            </div>
            <div class="form-text" style="color:var(--es-muted);font-size:.75rem;">3–60 chars, letters/numbers/hyphens</div>
          </div>
          <div class="col-12">
            <label class="form-label">Email Address</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-envelope"></i></span>
              <input type="email" id="r-email" class="form-control" placeholder="you@example.com" />
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label">Password</label>
            <input type="password" id="r-pass" class="form-control" placeholder="Min 8 chars + uppercase + number" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Confirm Password</label>
            <input type="password" id="r-conf" class="form-control" placeholder="Repeat password" />
          </div>
          <div class="col-12">
            <label class="form-label">Preferred Difficulty</label>
            <select id="r-diff" class="form-select">
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
            <div class="form-text" style="color:var(--es-muted);font-size:.75rem;">Used for AI recommendations</div>
          </div>
        </div>
        <button class="btn-es w-100" style="padding:.7rem;" id="btn-register">
          <i class="bi bi-person-plus me-2"></i>Create Account
        </button>
      </div>
      <p class="text-center mt-3" style="font-size:.875rem;color:var(--es-muted);">
        Already have an account? <a href="#" id="go-login">Sign in</a>
      </p>
    </div>
  `);

  document.getElementById('go-login').addEventListener('click', e => { e.preventDefault(); renderLogin(); });

  document.getElementById('btn-register').addEventListener('click', async () => {
    const btn    = document.getElementById('btn-register');
    const errEl  = document.getElementById('reg-error');
    const body   = {
      username:   document.getElementById('r-user').value.trim(),
      email:      document.getElementById('r-email').value.trim(),
      password:   document.getElementById('r-pass').value,
      confirm:    document.getElementById('r-conf').value,
      difficulty: document.getElementById('r-diff').value,
    };

    errEl.innerHTML = '';
    btn.disabled = true; btn.textContent = 'Creating account…';
    const res = await apiPost('auth.php', body, { action: 'register' });
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Create Account';

    if (res.ok) {
      currentUser = res.data;
      toast(`Account created! Welcome, ${currentUser.username}!`);
      showNav(true);
      renderDashboard();
    } else {
      const msgs = res.error.split(' | ');
      errEl.innerHTML = `<div class="alert alert-danger"><ul class="error-list mb-0">${msgs.map(m=>`<li>${m}</li>`).join('')}</ul></div>`;
    }
  });
}

// ── DASHBOARD ──────────────────────────────────────────────
async function renderDashboard() {
  setActiveNav('dashboard');
  render(`<div class="container">${spinner('Loading your dashboard…')}</div>`);

  const [statsRes, recentRes, recRes] = await Promise.all([
    apiGet('dashboard.php', { action: 'stats' }),
    apiGet('dashboard.php', { action: 'recent' }),
    apiGet('resources.php', { action: 'recommend' }),
  ]);

  const stats  = statsRes.data  || { Saved: 0, 'In Progress': 0, Completed: 0 };
  const recent = recentRes.data || [];
  const recs   = recRes.data    || [];
  const total  = (stats.Saved || 0) + (stats['In Progress'] || 0) + (stats.Completed || 0);
  const pct    = total ? Math.round((stats.Completed / total) * 100) : 0;

  const statCards = [
    { label: 'Saved',       val: stats.Saved || 0,          icon: 'bi-bookmark',       color: 'var(--es-accent)'  },
    { label: 'In Progress', val: stats['In Progress'] || 0, icon: 'bi-hourglass-split', color: 'var(--es-warn)'   },
    { label: 'Completed',   val: stats.Completed || 0,      icon: 'bi-check-circle',   color: 'var(--es-success)' },
    { label: 'Total',       val: total,                      icon: 'bi-lightning',       color: 'var(--es-accent2)' },
  ];

  render(`
    <div class="container fade-up">

      <!-- Header -->
      <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h1 class="es-heading mb-1">Hey, <span class="accent">${esc(currentUser.username)}</span> 👋</h1>
          <p class="text-muted mb-0" style="font-size:.9rem;">
            Your personalised hub — level: ${diffBadge(currentUser.preferred_difficulty)}
          </p>
        </div>
        <button class="btn-es" onclick="renderCatalogue()">
          <i class="bi bi-search me-2"></i>Browse Catalogue
        </button>
      </div>

      <!-- Stats grid -->
      <div class="row g-3 mb-4">
        ${statCards.map(s => `
          <div class="col-6 col-md-3">
            <div class="es-card h-100 d-flex align-items-center gap-3">
              <div style="font-size:1.6rem;color:${s.color};flex-shrink:0;"><i class="bi ${s.icon}"></i></div>
              <div>
                <div style="font-family:var(--font-display);font-size:1.6rem;line-height:1;color:${s.color};">${s.val}</div>
                <div style="font-size:.75rem;color:var(--es-muted);text-transform:uppercase;letter-spacing:.5px;">${s.label}</div>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <!-- Progress bar -->
      ${total > 0 ? `
      <div class="es-card no-hover mb-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span style="font-size:.85rem;font-weight:600;">My Progress</span>
          <span style="font-size:.8rem;color:var(--es-muted);">${stats.Completed || 0} of ${total} completed</span>
        </div>
        <div class="progress" style="height:8px;">
          <div class="progress-bar" style="width:${pct}%;"></div>
        </div>
        <div class="text-end mt-1" style="font-size:.75rem;color:var(--es-muted);">${pct}% complete</div>
      </div>` : ''}

      <div class="glow-line"></div>

      <!-- AI Recommendations -->
      <div class="mb-4">
        <h2 class="es-heading mb-1" style="font-size:1.15rem;">
          <i class="bi bi-stars" style="color:var(--es-accent2);"></i>
          AI <span class="accent">Recommendations</span>
        </h2>
        <p class="text-muted mb-3" style="font-size:.85rem;">
          Curated for your <strong style="color:var(--es-text);">${esc(currentUser.preferred_difficulty)}</strong> level — refreshed every session.
        </p>
        ${recs.length === 0
          ? `<div class="alert alert-info">No recommendations yet. <a href="#" onclick="renderCatalogue()">Browse the catalogue</a>.</div>`
          : `<div class="row g-3">${recs.map(rec => recCard(rec)).join('')}</div>`
        }
      </div>

      <div class="glow-line"></div>

      <!-- Recent activity -->
      <div>
        <h2 class="es-heading mb-3" style="font-size:1.15rem;">
          <i class="bi bi-clock-history" style="color:var(--es-muted);"></i>
          Recent <span class="accent">Activity</span>
        </h2>
        ${recent.length === 0
          ? `<div class="es-card text-center py-4">
               <i class="bi bi-inbox" style="font-size:2rem;color:var(--es-muted);"></i>
               <p class="mt-2 mb-0" style="color:var(--es-muted);font-size:.9rem;">No activity yet. <a href="#" onclick="renderCatalogue()">Explore resources!</a></p>
             </div>`
          : `<div class="es-card no-hover p-0" style="overflow:hidden;">
               <table class="es-table">
                 <thead><tr>
                   <th>Resource</th><th>Category</th><th>Level</th><th>Status</th><th>Date</th>
                 </tr></thead>
                 <tbody>${recent.map(r => `
                   <tr>
                     <td><a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--es-text);font-weight:500;">${esc(r.title)} <i class="bi bi-arrow-up-right-circle" style="font-size:.7rem;color:var(--es-muted);"></i></a></td>
                     <td style="color:var(--es-muted);">${esc(r.cat_icon)} ${esc(r.cat_name)}</td>
                     <td>${diffBadge(r.difficulty_level)}</td>
                     <td><span style="font-size:.75rem;color:${statusColor(r.status)};font-weight:600;">${esc(r.status)}</span></td>
                     <td style="color:var(--es-muted);font-size:.8rem;">${formatDate(r.saved_at)}</td>
                   </tr>`).join('')}
                 </tbody>
               </table>
             </div>`
        }
      </div>

    </div>
  `);
}

// ── CATALOGUE ──────────────────────────────────────────────
let catState = { q: '', difficulty: '', category: 0, page: 1 };

async function renderCatalogue(state = null) {
  if (state) catState = { ...catState, ...state };
  setActiveNav('catalogue');
  render(`<div class="container">${spinner('Fetching resources…')}</div>`);

  const [catRes, resRes] = await Promise.all([
    apiGet('resources.php', { action: 'categories' }),
    apiGet('resources.php', { action: 'list', q: catState.q, difficulty: catState.difficulty, category: catState.category, page: catState.page }),
  ]);

  const categories = catRes.data  || [];
  const resources  = resRes.data?.resources || [];
  const total      = resRes.data?.total || 0;
  const totalPages = resRes.data?.total_pages || 1;

  render(`
    <div class="container fade-up">

      <!-- Header -->
      <div class="mb-4">
        <h1 class="es-heading mb-1">Resource <span class="accent">Catalogue</span></h1>
        <p class="text-muted" style="font-size:.9rem;">${total.toLocaleString()} resource${total !== 1 ? 's' : ''} found${catState.q ? ` for "<em>${esc(catState.q)}</em>"` : ''}</p>
      </div>

      <!-- Filters -->
      <div class="es-card no-hover mb-4">
        <div class="row g-3 align-items-end">
          <div class="col-md-5">
            <label class="form-label">Search</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input type="text" id="f-q" class="form-control" placeholder="Search title, author, category…" value="${esc(catState.q)}" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label">Difficulty</label>
            <select id="f-diff" class="form-select">
              <option value="">All Levels</option>
              ${['Beginner','Intermediate','Advanced'].map(d => `<option value="${d}" ${catState.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label">Category</label>
            <select id="f-cat" class="form-select">
              <option value="0">All Categories</option>
              ${categories.map(c => `<option value="${c.id}" ${catState.category == c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-1">
            <button class="btn-es w-100" id="btn-filter" style="padding:.55rem;" title="Apply filters">
              <i class="bi bi-funnel"></i>
            </button>
          </div>
        </div>
        ${(catState.q || catState.difficulty || catState.category) ? `
        <div class="mt-2">
          <a href="#" id="btn-clear" style="font-size:.8rem;color:var(--es-muted);">
            <i class="bi bi-x-circle me-1"></i>Clear filters
          </a>
        </div>` : ''}
      </div>

      <!-- Resource grid -->
      ${resources.length === 0
        ? `<div class="text-center py-5">
             <i class="bi bi-journal-x" style="font-size:3rem;color:var(--es-muted);"></i>
             <p class="mt-3" style="color:var(--es-muted);">No resources match your search.</p>
             <button class="btn-es-outline" onclick="renderCatalogue({q:'',difficulty:'',category:0,page:1})">Reset Search</button>
           </div>`
        : `<div class="row g-3" id="resource-grid">
             ${resources.map(r => resourceCard(r)).join('')}
           </div>`
      }

      <!-- Pagination -->
      ${totalPages > 1 ? `
      <nav class="mt-4 d-flex justify-content-center" aria-label="pagination">
        <div class="d-flex gap-1">
          ${Array.from({length: totalPages}, (_, i) => i + 1).map(p => `
            <button class="btn-es${p === catState.page ? '' : '-outline'} btn-es-sm" data-goto="${p}" style="min-width:36px;">${p}</button>
          `).join('')}
        </div>
      </nav>` : ''}

    </div>
  `);

  // Filter events
  document.getElementById('btn-filter').addEventListener('click', () => {
    renderCatalogue({ q: document.getElementById('f-q').value.trim(), difficulty: document.getElementById('f-diff').value, category: parseInt(document.getElementById('f-cat').value), page: 1 });
  });
  document.getElementById('f-q').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-filter').click();
  });
  document.getElementById('btn-clear')?.addEventListener('click', e => { e.preventDefault(); renderCatalogue({ q: '', difficulty: '', category: 0, page: 1 }); });

  // Pagination
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => renderCatalogue({ page: parseInt(btn.dataset.goto) }));
  });

  // Progress buttons
  document.querySelectorAll('[data-progress]').forEach(btn => {
    btn.addEventListener('click', () => handleProgress(btn));
  });
}

// ── FEEDBACK ───────────────────────────────────────────────
function renderFeedback() {
  setActiveNav('feedback');
  render(`
    <div class="container fade-up" style="max-width:660px;">
      <div class="mb-4">
        <h1 class="es-heading mb-1">Share Your <span class="accent">Feedback</span></h1>
        <p class="text-muted" style="font-size:.9rem;">We read every submission and use it to improve EduStream AI.</p>
      </div>
      <div id="fb-result"></div>
      <div class="es-card no-hover" id="fb-form-wrap">
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <label class="form-label">Your Name</label>
            <input type="text" id="fb-name" class="form-control" value="${esc(currentUser.username)}" placeholder="Jane Doe" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Email Address</label>
            <input type="email" id="fb-email" class="form-control" value="${esc(currentUser.email)}" placeholder="jane@example.com" />
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label">Subject</label>
          <input type="text" id="fb-subject" class="form-control" placeholder="e.g. Great resource, Bug report…" />
        </div>
        <div class="mb-3">
          <label class="form-label">Message</label>
          <textarea id="fb-msg" class="form-control" rows="5" placeholder="Tell us what you think… (min 20 characters)"></textarea>
          <div class="d-flex justify-content-end mt-1">
            <span id="fb-char" style="font-size:.75rem;color:var(--es-muted);">0 characters</span>
          </div>
        </div>
        <div class="mb-4">
          <label class="form-label d-block">Overall Rating</label>
          <div class="d-flex gap-2" id="stars">
            ${[1,2,3,4,5].map(i => `<button type="button" class="star-btn" data-val="${i}" title="${i} star${i>1?'s':''}">★</button>`).join('')}
          </div>
          <div id="rating-label" style="font-size:.8rem;color:var(--es-muted);margin-top:.3rem;">Click a star to rate</div>
          <input type="hidden" id="fb-rating" value="0" />
        </div>
        <button class="btn-es" style="padding:.65rem 2rem;" id="btn-submit-fb">
          <i class="bi bi-send me-2"></i>Submit Feedback
        </button>
      </div>
    </div>
  `);

  // Char counter
  const ta = document.getElementById('fb-msg');
  const cc = document.getElementById('fb-char');
  ta.addEventListener('input', () => {
    const n = ta.value.length;
    cc.textContent = `${n} character${n !== 1 ? 's' : ''}`;
    cc.style.color = n < 20 ? 'var(--es-danger)' : 'var(--es-success)';
  });

  // Star rating
  const ratingTexts = ['','Terrible 😣','Poor 😕','Okay 😐','Good 😊','Excellent 🤩'];
  const stars = document.querySelectorAll('.star-btn');
  let selectedRating = 0;

  stars.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const v = +btn.dataset.val;
      stars.forEach((s, i) => s.classList.toggle('active', i < v));
    });
    btn.addEventListener('mouseleave', () => {
      stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
    });
    btn.addEventListener('click', () => {
      selectedRating = +btn.dataset.val;
      document.getElementById('fb-rating').value = selectedRating;
      document.getElementById('rating-label').textContent = ratingTexts[selectedRating];
      stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
    });
  });

  // Submit
  document.getElementById('btn-submit-fb').addEventListener('click', async () => {
    const btn    = document.getElementById('btn-submit-fb');
    const errEl  = document.getElementById('fb-result');
    const body   = {
      name:    document.getElementById('fb-name').value.trim(),
      email:   document.getElementById('fb-email').value.trim(),
      subject: document.getElementById('fb-subject').value.trim(),
      message: document.getElementById('fb-msg').value.trim(),
      rating:  parseInt(document.getElementById('fb-rating').value),
    };

    errEl.innerHTML = '';
    btn.disabled = true; btn.textContent = 'Submitting…';
    const res = await apiPost('feedback.php', body, { action: 'submit' });
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i>Submit Feedback';

    if (res.ok) {
      document.getElementById('fb-form-wrap').remove();
      document.getElementById('fb-result').innerHTML = `
        <div class="es-card no-hover text-center py-5">
          <div style="font-size:3.5rem;margin-bottom:1rem;">🎉</div>
          <h2 style="font-family:var(--font-display);font-size:1.2rem;color:var(--es-success);">Thank you for your feedback!</h2>
          <p style="color:var(--es-muted);font-size:.9rem;max-width:360px;margin:1rem auto;">
            Your response has been recorded and will help improve EduStream AI.
          </p>
          <div class="d-flex gap-2 justify-content-center mt-3">
            <button class="btn-es" onclick="renderDashboard()">Back to Dashboard</button>
            <button class="btn-es-outline" onclick="renderCatalogue()">Browse Resources</button>
          </div>
        </div>`;
    } else {
      const msgs = res.error.split(' | ');
      errEl.innerHTML = `<div class="alert alert-danger mb-3"><ul class="error-list mb-0">${msgs.map(m=>`<li>${m}</li>`).join('')}</ul></div>`;
    }
  });
}

// ══════════════════════════════════════════════════════════
//  COMPONENT BUILDERS
// ══════════════════════════════════════════════════════════

function recCard(rec) {
  return `
    <div class="col-md-4">
      <div class="es-card h-100 d-flex flex-column" style="padding:1.25rem;">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span style="font-size:1.5rem;">${esc(rec.category_icon || '📚')}</span>
          ${diffBadge(rec.difficulty_level)}
        </div>
        <div style="font-size:.7rem;color:var(--es-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem;">${esc(rec.category_name || '')}</div>
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.5rem;flex-grow:1;">${esc(rec.title)}</h3>
        ${rec.description ? `<p style="font-size:.8rem;color:var(--es-muted);margin-bottom:.8rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(rec.description)}</p>` : ''}
        <div class="d-flex gap-2 mt-auto">
          <a href="${esc(rec.url)}" target="_blank" rel="noopener" class="btn-es btn-es-sm" style="flex:1;text-align:center;">
            <i class="bi bi-box-arrow-up-right me-1"></i>Start Learning
          </a>
          <button class="btn-es-outline btn-es-sm" data-progress data-id="${rec.id}" data-status="Saved" title="Save resource">
            <i class="bi bi-bookmark"></i>
          </button>
        </div>
      </div>
    </div>`;
}

function resourceCard(r) {
  const statusMap = { 'Saved': 'bi-bookmark-fill', 'In Progress': 'bi-hourglass-split', 'Completed': 'bi-check-circle-fill' };
  const nextStatus = { null: 'Saved', 'Saved': 'In Progress', 'In Progress': 'Completed', 'Completed': 'Saved' };
  const next = nextStatus[r.user_status] || 'Saved';
  const icon = statusMap[r.user_status] || 'bi-bookmark';
  const btnColor = r.user_status === 'Completed' ? 'color:var(--es-success);border-color:var(--es-success);'
                 : r.user_status === 'In Progress' ? 'color:var(--es-warn);border-color:var(--es-warn);' : '';

  return `
    <div class="col-md-6 col-lg-4">
      <div class="es-card h-100 d-flex flex-column" style="padding:1.25rem;">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span style="font-size:.8rem;color:var(--es-muted);">${esc(r.cat_icon)} ${esc(r.cat_name)}</span>
          ${diffBadge(r.difficulty_level)}
        </div>
        <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.4rem;flex-grow:1;">
          <a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--es-text);">${esc(r.title)}</a>
        </h3>
        ${r.description ? `<p style="font-size:.8rem;color:var(--es-muted);margin-bottom:.6rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(r.description)}</p>` : ''}
        <div class="d-flex gap-3 mb-3" style="font-size:.75rem;color:var(--es-muted);">
          ${r.author ? `<span><i class="bi bi-person me-1"></i>${esc(r.author)}</span>` : ''}
          ${r.duration_minutes ? `<span><i class="bi bi-clock me-1"></i>${Math.round(r.duration_minutes / 60 * 10) / 10}h</span>` : ''}
          <span><i class="bi bi-tag me-1"></i>${esc(r.resource_type)}</span>
        </div>
        <div class="d-flex gap-2 mt-auto">
          <a href="${esc(r.url)}" target="_blank" rel="noopener" class="btn-es btn-es-sm" style="flex:1;text-align:center;">
            <i class="bi bi-box-arrow-up-right me-1"></i>Open
          </a>
          <button class="btn-es-outline btn-es-sm" data-progress data-id="${r.id}" data-status="${next}" style="${btnColor}" title="Status: ${r.user_status || 'Not saved'}">
            <i class="bi ${icon}"></i>
          </button>
        </div>
      </div>
    </div>`;
}

// ── Progress button handler ────────────────────────────────
async function handleProgress(btn) {
  const id     = parseInt(btn.dataset.id);
  const status = btn.dataset.status;
  btn.disabled = true;
  const res = await apiPost('resources.php', { resource_id: id, status }, { action: 'progress' });
  btn.disabled = false;
  if (res.ok) { toast(`Marked as "${status}"`); }
  else        { toast(res.error, 'error'); }
}

// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function alert_html(msg) {
  return `<div class="alert alert-danger mb-3">${esc(msg)}</div>`;
}
function statusColor(s) {
  return { Saved: 'var(--es-accent)', 'In Progress': 'var(--es-warn)', Completed: 'var(--es-success)' }[s] || 'var(--es-muted)';
}
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ══════════════════════════════════════════════════════════
//  ROUTER / BOOT
// ══════════════════════════════════════════════════════════

// Nav click delegation
document.addEventListener('click', e => {
  const link = e.target.closest('[data-page]');
  if (!link) return;
  e.preventDefault();
  const page = link.dataset.page;
  if (page === 'dashboard') renderDashboard();
  else if (page === 'catalogue') renderCatalogue();
  else if (page === 'feedback') renderFeedback();
});

// Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
  await apiPost('auth.php', {}, { action: 'logout' });
  currentUser = null;
  toast('Logged out successfully.');
  showNav(false);
  renderLogin();
});

// Boot: check if session already active
(async () => {
  const res = await apiGet('auth.php', { action: 'me' });
  if (res.ok && res.data) {
    currentUser = res.data;
    showNav(true);
    renderDashboard();
  } else {
    renderLogin();
  }
})();
