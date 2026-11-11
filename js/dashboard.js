/* ===========================================================
   ParkFlow — dashboard logic (Admin + Security)
   =========================================================== */
const Dashboard = (() => {

  /* ---------- stat cards ---------- */
  function animateNumber(el, to) {
    const from = Number(el.dataset.value ?? 0);
    if (from === to) { el.textContent = to; el.dataset.value = to; return; }
    const start = performance.now(), dur = 600;
    const step = now => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.dataset.value = to;
    };
    requestAnimationFrame(step);
  }

  function renderStats() {
    const s = Store.stats();
    animateNumber(document.getElementById('statTotal'), s.total);
    animateNumber(document.getElementById('statAvailable'), s.available);
    animateNumber(document.getElementById('statOccupied'), s.occupied);

    document.getElementById('noteTotal').textContent = '100% sensors active';
    document.getElementById('noteAvailable').textContent =
      `${Math.round((s.available / s.total) * 100)}% availability`;
    document.getElementById('noteOccupied').textContent =
      s.occupied === 0 ? 'No cars parked' : s.occupied === s.total ? 'Parking full' : 'Currently occupied';
  }

  /* ---------- 3D slots ---------- */
  const COLORS = ['#2f7cf6', '#e5484d', '#f5a524', '#7c5cff', '#e6e9f2', '#2fbf8f', '#ff7a45', '#27c4d9'];
  const view = {};            // remembers what each slot looked like last render

  function colorFor(plate) {
    let h = 0;
    for (const c of plate) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  }

  const cuboid = (cls, w, l, h, x, y, z) =>
    `<div class="cb ${cls}" style="--w:${w}px;--l:${l}px;--h:${h}px;left:${x}px;top:${y}px;transform:translateZ(${z}px)">` +
    `<i class="top"></i><i class="fr"></i><i class="bk"></i><i class="lf"></i><i class="rt"></i></div>`;

  function carHTML(plate, animClass) {
    return `
      <div class="car ${animClass}" style="--car:${colorFor(plate)}">
        <div class="shadow"></div>
        ${cuboid('wheel', 8, 20, 14, -3, 14, 0)}
        ${cuboid('wheel', 8, 20, 14, 65, 14, 0)}
        ${cuboid('wheel', 8, 20, 14, -3, 88, 0)}
        ${cuboid('wheel', 8, 20, 14, 65, 88, 0)}
        ${cuboid('body', 70, 120, 18, 0, 0, 7)}
        ${cuboid('cabin', 58, 58, 17, 6, 38, 25)}
        ${cuboid('head', 14, 2, 6, 6, -1, 14)}
        ${cuboid('head', 14, 2, 6, 50, -1, 14)}
        ${cuboid('tail', 14, 2, 6, 6, 119, 14)}
        ${cuboid('tail', 14, 2, 6, 50, 119, 14)}
      </div>`;
  }

  function slotShell(s) {
    return `
      <div class="slot ${s.occupied ? 'occupied' : ''}" data-id="${s.id}">
        <div class="slot-top">
          <span class="slot-id">${s.id}</span>
          <span class="slot-status">${s.occupied ? 'Occupied' : 'Vacant'}</span>
        </div>
        <div class="slot-view">
          <div class="scene">
            <div class="stage">
              <div class="floor"><span class="p-mark">P</span></div>
              <div class="ring"></div>
              <div class="car-holder">${s.occupied ? carHTML(s.plate, '') : ''}</div>
            </div>
          </div>
        </div>
        <div class="slot-foot">
          <span class="plate">${s.occupied ? s.plate : '—'}</span>
          <span class="since">${s.occupied ? 'In ' + Store.fmtTime(s.entry) : 'Available'}</span>
        </div>
      </div>`;
  }

  function mountCar(el, s) {
    const holder = el.querySelector('.car-holder');
    holder.querySelectorAll('.car:not(.leave)').forEach(c => c.remove());
    holder.insertAdjacentHTML('beforeend', carHTML(s.plate, 'enter'));
    const car = holder.lastElementChild;
    car.addEventListener('animationend', e => { if (e.target === car) car.classList.remove('enter'); });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 3200);
  }

  function removeCar(el) {
    el.querySelectorAll('.car:not(.leave)').forEach(car => {
      car.classList.remove('enter');
      car.classList.add('leave');
      const kill = () => car.remove();
      car.addEventListener('animationend', e => { if (e.target === car) kill(); });
      setTimeout(kill, 2200);
    });
  }

  function renderSlots() {
    const grid = document.getElementById('slotGrid');
    if (!grid) return;

    /* first time: build the 8 slots (already-parked cars appear without animation) */
    if (!grid.querySelector('.slot')) {
      grid.className = 'slot-grid';
      grid.innerHTML = Store.state.slots.map(slotShell).join('');
      Store.state.slots.forEach(s => { view[s.id] = { occ: s.occupied, plate: s.plate }; });
      return;
    }

    /* later: animate only what changed */
    Store.state.slots.forEach(s => {
      const el = grid.querySelector(`[data-id="${s.id}"]`);
      if (!el) return;
      const prev = view[s.id] || { occ: false, plate: null };
      const occ = !!s.occupied;
      const statusEl = el.querySelector('.slot-status');

      if (occ && (!prev.occ || prev.plate !== s.plate)) {          // car arrives
        mountCar(el, s);
        el.classList.add('occupied');
        statusEl.textContent = 'Arriving…';
        setTimeout(() => { if (view[s.id]?.occ) statusEl.textContent = 'Occupied'; }, 1100);
      } else if (!occ && prev.occ) {                                // car leaves
        removeCar(el);
        el.classList.remove('occupied');
        statusEl.textContent = 'Vacant';
      }

      el.querySelector('.plate').textContent = occ ? s.plate : '—';
      el.querySelector('.since').textContent = occ ? 'In ' + Store.fmtTime(s.entry) : 'Available';
      view[s.id] = { occ, plate: s.plate };
    });
  }

  /* ---------- Step 6: activity / gate / warnings ---------- */
  const isAdmin = () => Auth.current()?.role === 'admin';

  const span = ms => {
    const m = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(m / 60);
    return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
  };
  const ago = ts => {
    const m = Math.floor((Date.now() - ts) / 60000);
    return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
  };

  function buildPanels() {
    document.getElementById('activityCard').innerHTML = `
      <div class="panel-head">
        <div>
          <div class="card-title">Current Parking Activity</div>
          <div class="card-sub">Entry time of every car inside the facility</div>
        </div>
        <span class="count-chip" id="actCount"></span>
      </div>
      <div class="act-list" id="actList"></div>`;

    const gateBox = (key, label, hint) => `
      <div class="gate-box" data-gate="${key}">
        <div class="gate-label">${label}<span>${hint}</span></div>
        <div class="gate-row">
          <div class="gate-visual"><div class="gate-post"></div><div class="gate-arm"></div></div>
          <div class="gate-info">
            <div class="gate-state"></div>
            <div class="gate-by"></div>
          </div>
        </div>
        <button class="btn gate-btn" data-toggle="${key}"></button>
      </div>`;

    document.getElementById('gateCard').innerHTML = `
      <div class="panel-head">
        <div>
          <div class="card-title">Gate Control</div>
          <div class="card-sub">Manually open or close the entrance and exit gates</div>
        </div>
      </div>
      <div class="gate-pair">
        ${gateBox('entrance', 'Entrance Gate', 'Cars coming in')}
        ${gateBox('exit', 'Exit Gate', 'Cars going out')}
      </div>`;

    document.getElementById('alertsCard').innerHTML = `
      <div class="panel-head">
        <div>
          <div class="card-title">Warnings &amp; Notifications</div>
          <div class="card-sub">Time-limit alerts and gate activity</div>
        </div>
        <button class="link-btn" id="clearAlerts">Clear all</button>
      </div>
      <div class="hours-row">
        <span>Parking hours end at</span>
        <input type="time" id="closingInput" />
      </div>
      <div class="alert-list" id="alertList"></div>`;

    /* gate button */
    document.getElementById('gateCard').addEventListener('click', e => {
      const b = e.target.closest('[data-toggle]');
      if (b) Store.toggleGate(b.dataset.toggle, Auth.current().name);
    });

    /* clear + dismiss */
    document.getElementById('clearAlerts').addEventListener('click', () => Store.clearNotifications());
    document.getElementById('alertList').addEventListener('click', e => {
      const x = e.target.closest('[data-dismiss]');
      if (x) Store.dismissNotification(x.dataset.dismiss);
    });

    /* closing time (admin edits, security only sees it) */
    const input = document.getElementById('closingInput');
    input.disabled = !isAdmin();
    input.addEventListener('change', () => {
      if (!input.value) return;
      Store.state.records.forEach(r => { r.warned = false; r.overstayed = false; });
      Store.updateSettings({ closingTime: input.value });
      Store.checkTimeLimits();
    });
  }

  function renderActivity() {
    const list = document.getElementById('actList');
    if (!list) return;
    const now = Date.now();
    const closing = Store.closingTimestamp();
    const warnAt = closing - Store.state.settings.warnMinutes * 60000;

    const cars = Store.state.slots.filter(s => s.occupied).sort((a, b) => b.entry - a.entry);
    document.getElementById('actCount').textContent = `${cars.length} car${cars.length === 1 ? '' : 's'} inside`;

    if (!cars.length) {
      list.innerHTML = '<div class="empty">No cars are parked right now.</div>';
      return;
    }

    list.innerHTML = cars.map(s => {
      let state = '', label = 'On time', note = `Closes in ${span(closing - now)}`;
      if (now >= closing)      { state = 'danger'; label = 'Over limit'; note = `${span(now - closing)} past closing`; }
      else if (now >= warnAt)  { state = 'warn';   label = 'Leave soon'; }
      const badge = state === 'danger' ? 'danger' : state === 'warn' ? 'warn' : 'parked';

      return `
        <div class="act-row ${state}">
          <div class="act-slot">${s.id}</div>
          <div class="act-main">
            <strong>${s.plate}</strong>
            <span><span class="entry-time">Entered ${Store.fmtTime(s.entry)}</span> · Parked ${span(now - s.entry)}</span>
          </div>
          <div class="act-right">
            <span class="badge ${badge}">${label}</span>
            <small>${note}</small>
          </div>
        </div>`;
    }).join('');
  }

  function renderGate() {
    ['entrance', 'exit'].forEach(key => {
      const g = Store.state.gates[key];
      const box = document.querySelector(`[data-gate="${key}"]`);
      if (!box) return;

      box.querySelector('.gate-visual').classList.toggle('open', g.open);

      const st = box.querySelector('.gate-state');
      st.textContent = g.open ? 'Open' : 'Closed';
      st.className = 'gate-state ' + (g.open ? 'open' : 'closed');

      box.querySelector('.gate-by').textContent = `${g.by} · ${Store.fmtTime(g.at)}`;

      const btn = box.querySelector('.gate-btn');
      btn.textContent = g.open ? 'Close gate' : 'Open gate';
      btn.className = 'btn gate-btn ' + (g.open ? 'btn-danger' : 'btn-success');
    });
  }

  function renderAlerts() {
    const list = document.getElementById('alertList');
    if (!list) return;

    const input = document.getElementById('closingInput');
    if (document.activeElement !== input) input.value = Store.state.settings.closingTime;

    const items = Store.state.notifications;
    document.getElementById('clearAlerts').style.visibility = items.length ? 'visible' : 'hidden';

    if (!items.length) {
      list.innerHTML = '<div class="empty">No warnings. Everything looks good.</div>';
      return;
    }
    const icon = { warn: '!', danger: '!', info: 'i' };
    list.innerHTML = items.map(n => `
      <div class="alert ${n.type}">
        <div class="alert-ico">${icon[n.type] || 'i'}</div>
        <div class="alert-body">
          <strong>${n.title}</strong>
          <span>${n.message}</span>
          <small>${ago(n.time)}</small>
        </div>
        <button class="alert-x" data-dismiss="${n.id}" title="Dismiss">×</button>
      </div>`).join('');
  }

  /* ---------- main ---------- */
  function render() {
    renderStats();
    renderSlots();
    renderActivity();
    renderGate();
    renderAlerts();
  }

  function init() {
    buildPanels();
    render();
    Store.subscribe(render);
    setInterval(() => { renderActivity(); renderAlerts(); }, 20000);  // keep timers fresh
  }

  return { init, render, animateNumber };
})();