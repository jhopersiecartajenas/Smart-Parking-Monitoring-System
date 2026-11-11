/* ===========================================================
   ParkFlow — shared UI (sidebar, topbar, toasts, theme)
   =========================================================== */
const UI = (() => {
  const I = {
    logo: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M6 20V11M12 20V5M18 20V14"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
    records: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11l1.6-4.4A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.6L19 11"/><rect x="3" y="11" width="18" height="6" rx="2.5"/><path d="M6 17v2M18 17v2"/><circle cx="7.5" cy="14" r=".8" fill="currentColor"/><circle cx="16.5" cy="14" r=".8" fill="currentColor"/></svg>'
  };

  /* ---------- theme ---------- */
  function applyTheme(s) {
    const root = document.documentElement;
    root.setAttribute('data-theme', s.theme || 'dark');
    root.style.setProperty('--primary', s.primary || '#2f7cf6');
    root.style.setProperty('--accent', s.accent || '#28d9f5');
    root.style.setProperty('--glass', (s.glass ?? 72) / 100);
  }

  function hydrateIcons(scope = document) {
    scope.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = I[el.dataset.icon] || ''; });
  }

  /* ---------- toasts ---------- */
  function toast(type, title, message, full) {
    let stack = document.getElementById('toasts');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toasts'; stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (full ? 'full' : 'ok');
    t.innerHTML = `<i class="toast-bar"></i><div><strong>${title}</strong><span>${message}</span></div>`;
    stack.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'all .5s'; t.style.opacity = '0'; t.style.transform = 'translateY(-20px)';
      setTimeout(() => t.remove(), 500);
    }, 6000);
  }
  /* ---------- mount sidebar + topbar ---------- */
  function mount({ page, title }) {
    const user = Auth.current();
    Store.init();
    applyTheme(Store.state.settings);

    const nav = user.role === 'admin'
      ? [
          { key: 'dashboard', label: 'Dashboard', href: 'admin-dashboard.html', icon: 'grid' },
          { key: 'records',   label: 'Records',   href: 'admin-records.html',   icon: 'records' },
          { key: 'settings',  label: 'Settings',  href: 'admin-settings.html',  icon: 'settings' }
        ]
      : [
          { key: 'dashboard', label: 'Dashboard', href: 'security-dashboard.html', icon: 'grid' },
          { key: 'records',   label: 'Records',   href: 'security-records.html',   icon: 'records' }
        ];

    document.getElementById('sidebar').innerHTML = `
      <div class="brand">
        <div class="brand-logo">${I.logo}</div>
        <span class="brand-name">ParkFlow</span>
      </div>

      <div class="facility">
        <div class="avatar">PF</div>
        <div><strong>Central Facility</strong><span>Smart Parking Hub</span></div>
      </div>

      <div class="nav-label">Workspace</div>
      <nav class="nav">
        ${nav.map(n => `<a href="${n.href}" class="${n.key === page ? 'active' : ''}">${I[n.icon]}<span>${n.label}</span></a>`).join('')}
      </nav>

      <div class="sidebar-bottom">
        <div class="sys-status">
          <span class="dot"></span>
          <div><strong>System Online</strong><span>${Store.MAX_SLOTS} test sensors connected</span></div>
        </div>
        <div class="user-box">
          <div class="avatar">${user.initials}</div>
          <div class="info"><strong>${user.name}</strong><span>${user.title}</span></div>
          <button class="logout-btn" id="logoutBtn" title="Sign out">${I.logout}</button>
        </div>
      </div>`;

    document.getElementById('topbar').innerHTML = `
      <div>
        <small>Smart Parking System</small>
        <h2>${title}</h2>
      </div>
      <div class="topbar-right">
        <div class="pill"><span class="dot"></span>Live updates</div>
        <div class="bell-wrap" id="bellWrap" data-state="ok">
          <button class="icon-btn" id="bellBtn" title="Notifications">${I.bell}<span class="badge-count" id="bellCount"></span></button>
          <div class="notif-panel" id="notifPanel">
            <div class="np-head"><strong>Notifications</strong><button id="npClear">Clear all</button></div>
            <div class="np-list" id="npList"></div>
          </div>
        </div>
        <div class="date-box"><strong id="dateMain"></strong><span id="dateYear"></span></div>
      </div>`;

    document.getElementById('logoutBtn').addEventListener('click', Auth.logout);

    /* date */
    const tickDate = () => {
      const d = new Date();
      document.getElementById('dateMain').textContent =
        d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      document.getElementById('dateYear').textContent = d.getFullYear();
    };
    tickDate(); setInterval(tickDate, 30000);

    /* bell: red dot + jump to alerts card (added in Step 6) */
    /* ---------- notification center (bell) ---------- */
    const wrap = document.getElementById('bellWrap');
    const bell = document.getElementById('bellBtn');
    const countEl = document.getElementById('bellCount');
    const panel = document.getElementById('notifPanel');
    const list = document.getElementById('npList');

    const ago = ts => {
      const m = Math.floor((Date.now() - ts) / 60000);
      return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
    };

    function renderBell() {
      const s = Store.state;
      const full = s.notifications.length ? s.notifications[0].full : false;
      const unread = s.notifications.filter(n => !n.read).length;

      wrap.dataset.state = full ? 'full' : 'ok';
      countEl.textContent = unread > 9 ? '9+' : unread;
      bell.classList.toggle('has-alert', unread > 0);

      document.getElementById('npClear').style.visibility = s.notifications.length ? 'visible' : 'hidden';

      list.innerHTML = s.notifications.length
        ? s.notifications.map(n => `
            <div class="np-item ${n.full ? 'full' : 'ok'} ${n.read ? '' : 'unread'}">
              <i class="np-bar"></i>
              <div class="np-body">
                <strong>${n.title}</strong>
                <span>${n.message}</span>
                <small>${ago(n.time)}</small>
              </div>
              <button class="np-x" data-dismiss="${n.id}" title="Dismiss">×</button>
            </div>`).join('')
        : '<div class="np-empty">No notifications yet.</div>';
    }

    bell.addEventListener('click', e => {
      e.stopPropagation();
      const open = panel.classList.toggle('open');
      if (open) Store.markAllRead();
    });
    panel.addEventListener('click', e => {
      e.stopPropagation();
      const x = e.target.closest('[data-dismiss]');
      if (x) Store.dismissNotification(x.dataset.dismiss);
    });
    document.getElementById('npClear').addEventListener('click', () => Store.clearNotifications());
    document.addEventListener('click', () => panel.classList.remove('open'));
    setInterval(renderBell, 30000);

    /* pop-up (top-center) whenever a NEW notification arrives */
    let lastSeen = Store.state.notifications[0]?.id || null;
    renderBell();
    Store.subscribe(s => {
      applyTheme(s.settings);
      renderBell();
      const fresh = [];
      for (const n of s.notifications) { if (n.id === lastSeen) break; fresh.push(n); }
      if (fresh.length) {
        lastSeen = s.notifications[0].id;
        fresh.slice(0, 3).reverse().forEach(n => toast(n.type, n.title, n.message, n.full));
      }
    });


    hydrateIcons();
  }

  return { mount, toast, applyTheme, hydrateIcons, icons: I };
})();