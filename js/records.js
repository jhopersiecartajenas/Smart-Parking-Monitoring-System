/* ===========================================================
   ParkFlow — records page (Admin + Security) + sessions chart
   =========================================================== */
const Records = (() => {
  const PER_PAGE = 10;
  const filters = { q: '', date: '', status: 'all' };
  let sort = { key: 'entry', dir: 'desc' };
  let page = 1;
  let knownIds = null;

  const $ = id => document.getElementById(id);

  /* ---------- helpers ---------- */
  const recNum = r => parseInt(r.id.replace(/\D/g, ''), 10);
  const durMs  = r => (r.exit || Date.now()) - r.entry;

  const sorters = {
    id:       r => recNum(r),
    plate:    r => r.plate,
    slot:     r => r.slot,
    entry:    r => r.entry,
    exit:     r => r.exit || Number.MAX_SAFE_INTEGER,
    duration: r => durMs(r),
    status:   r => r.status
  };

  function filtered() {
    const q = filters.q.trim().toLowerCase();
    let list = Store.state.records.filter(r => {
      if (q && !(`${r.plate} ${r.id} ${r.slot}`.toLowerCase().includes(q))) return false;
      if (filters.date && Store.dayKey(r.entry) !== filters.date) return false;
      if (filters.status !== 'all' && r.status.toLowerCase() !== filters.status) return false;
      return true;
    });
    const get = sorters[sort.key], dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const x = get(a), y = get(b);
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
    return list;
  }

  /* ---------- stat cards ---------- */
  function renderStats() {
    const s = Store.stats();
    const gateOpen = Store.state.gates.entrance.open;

    $('statToday').textContent = s.vehiclesToday;

    const st = $('statStatus');
    let label = 'Open', cls = 'ok', note = 'Gate open · accepting cars';
    if (!gateOpen)               { label = 'Closed'; cls = 'bad';  note = 'Gate closed manually'; }
    else if (s.available === 0)  { label = 'Full';   cls = 'full'; note = 'No free slots left'; }
    st.textContent = label;
    st.className = 'stat-value txt ' + cls;
    $('noteStatus').textContent = note;

    $('statSlots').textContent = s.slotStatus;
    $('noteSlots').textContent = `${s.available} slot${s.available === 1 ? '' : 's'} available`;
  }

  /* ---------- table ---------- */
  function renderTable() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (page > pages) page = pages;
    const from = (page - 1) * PER_PAGE;
    const rows = list.slice(from, from + PER_PAGE);

    $('countText').textContent = `${list.length} record${list.length === 1 ? '' : 's'} found`;

    const body = $('recBody');
    if (!rows.length) {
      body.innerHTML = '<tr><td class="no-rows" colspan="8">No records match your filters.</td></tr>';
    } else {
      body.innerHTML = rows.map(r => {
        const parked = r.status === 'Parked';
        const isNew = knownIds && !knownIds.has(r.id);
        return `
          <tr class="${isNew ? 'fresh' : ''}">
            <td><span class="chip">${r.id}</span></td>
            <td><div class="veh"><span class="veh-ico">${UI.icons.car}</span>${r.plate}</div></td>
            <td><span class="chip">${r.slot}</span></td>
            <td class="muted">${Store.fmtDate(r.entry)}</td>
            <td>${Store.fmtTime(r.entry)}</td>
            <td>${parked ? '<span class="still">Still Parked</span>' : Store.fmtTime(r.exit)}</td>
            <td class="muted">${Store.fmtDuration(durMs(r))}</td>
            <td><span class="badge ${parked ? 'parked' : 'exited'}"><i class="dot ${parked ? '' : 'gray'}" style="width:7px;height:7px"></i>${r.status}</span></td>
          </tr>`;
      }).join('');
    }
    knownIds = new Set(Store.state.records.map(r => r.id));

    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === sort.key);
      th.classList.toggle('asc',  th.dataset.sort === sort.key && sort.dir === 'asc');
      th.classList.toggle('desc', th.dataset.sort === sort.key && sort.dir === 'desc');
    });

    const end = Math.min(from + PER_PAGE, list.length);
    $('pagerText').textContent = list.length ? `Showing ${from + 1}–${end} of ${list.length}` : 'Showing 0 of 0';
    $('prevBtn').disabled = page <= 1;
    $('nextBtn').disabled = page >= pages;
  }

  /* ---------- export ---------- */
  function exportCSV() {
    const list = filtered();
    const head = ['Record ID', 'Plate', 'Slot', 'Date', 'Entry Time', 'Exit Time', 'Duration', 'Status'];
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [head.map(q).join(',')];
    list.forEach(r => lines.push([
      r.id, r.plate, r.slot, Store.fmtDate(r.entry), Store.fmtTime(r.entry),
      r.exit ? Store.fmtTime(r.exit) : 'Still Parked', Store.fmtDuration(durMs(r)), r.status
    ].map(q).join(',')));

    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `parkflow-records-${Store.dayKey(Date.now())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    UI.toast('info', 'Export complete', `${list.length} records saved to CSV.`);
  }

  /* ===========================================================
     Total Parking Sessions chart (daily / weekly / monthly)
     =========================================================== */
  let chartMode = 'daily';
  let chartSig = '';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const hash = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const short = d => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

  /* Past days = generated demo history. Today = real live count. */
  function sessionsOn(d, today) {
    if (d > today) return 0;
    if (d.getTime() === today.getTime()) return Store.stats().vehiclesToday;
    const base = (d.getDay() === 0 || d.getDay() === 6) ? 38 : 58;
    return Math.round(base + (hash(Math.floor(d.getTime() / 86400000)) - 0.5) * 24);
  }

  function buildSeries(mode) {
    const today = startOfDay(new Date());
    const out = [];

    if (mode === 'daily') {
      for (let i = 13; i >= 0; i--) {
        const d = addDays(today, -i);
        out.push({
          label: short(d),
          full: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
          value: sessionsOn(d, today)
        });
      }
    } else if (mode === 'weekly') {
      const monday = addDays(today, -((today.getDay() + 6) % 7));
      for (let w = 11; w >= 0; w--) {
        const s = addDays(monday, -7 * w);
        let sum = 0;
        for (let k = 0; k < 7; k++) sum += sessionsOn(addDays(s, k), today);
        out.push({ label: short(s), full: `Week of ${short(s)} – ${short(addDays(s, 6))}`, value: sum });
      }
    } else {
      for (let m = 11; m >= 0; m--) {
        const first = new Date(today.getFullYear(), today.getMonth() - m, 1);
        const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        let sum = 0;
        for (let k = 0; k < days; k++) sum += sessionsOn(addDays(first, k), today);
        out.push({
          label: MONTHS[first.getMonth()],
          full: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          value: sum
        });
      }
    }
    return out;
  }

  function smoothPath(p) {
    let d = `M${p[0].x},${p[0].y}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2, t = 0.18;
      d += ` C${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
    }
    return d;
  }

  function renderChart(animate) {
    const box = $('chartBox');
    if (!box) return;                       // card not on the page -> do nothing

    const data = buildSeries(chartMode);
    const W = Math.max(box.clientWidth, 320), H = 320;
    const sig = chartMode + '|' + W + '|' + data.map(p => p.value).join(',');
    const first = chartSig === '';
    if (!animate && !first && sig === chartSig) return;
    chartSig = sig;
    animate = animate || first;

    const total = data.reduce((a, p) => a + p.value, 0);
    const peak = data.reduce((a, p) => (p.value > a.value ? p : a), data[0]);
    const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[chartMode];
    const range = { daily: 'Last 14 days', weekly: 'Last 12 weeks', monthly: 'Last 12 months' }[chartMode];
    $('sessRange').textContent = range;
    $('sessTotal').textContent = total.toLocaleString();
    $('sessTotalNote').textContent = `in the ${range.toLowerCase()}`;
    $('sessAvgLabel').textContent = `Average per ${unit}`;
    $('sessAvg').textContent = Math.round(total / data.length).toLocaleString();
    $('sessPeak').textContent = peak.value.toLocaleString();
    $('sessPeakNote').textContent = peak.label;

    const pad = { l: 52, r: 26, t: 22, b: 40 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const raw = Math.max(...data.map(p => p.value), 1) * 1.1 / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
    const yMax = step * 4;

    const stepX = iw / (data.length - 1);
    const pts = data.map((p, i) => ({ ...p, x: pad.l + i * stepX, y: pad.t + (1 - p.value / yMax) * ih }));
    const base = pad.t + ih;
    const line = smoothPath(pts);
    const area = `${line} L${pts[pts.length - 1].x},${base} L${pts[0].x},${base} Z`;

    let grid = '';
    for (let g = 0; g <= 4; g++) {
      const y = pad.t + ih - (g / 4) * ih;
      grid += `<line class="s-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/>
               <text class="s-txt" x="${pad.l - 14}" y="${y + 4}" text-anchor="end">${Math.round(step * g).toLocaleString()}</text>`;
    }
    const skip = Math.ceil(data.length / Math.max(2, Math.floor(iw / 80)));
    const xlabels = pts.map((p, i) =>
      (data.length - 1 - i) % skip === 0
        ? `<text class="s-txt" x="${p.x}" y="${H - 10}" text-anchor="middle">${p.label}</text>` : ''
    ).join('');

    box.innerHTML = `
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="${animate ? 'anim' : ''}">
        <defs>
          <linearGradient id="sessFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style="stop-color:var(--primary);stop-opacity:.35"/>
            <stop offset="1" style="stop-color:var(--primary);stop-opacity:0"/>
          </linearGradient>
          <linearGradient id="sessStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style="stop-color:var(--accent)"/>
            <stop offset="1" style="stop-color:var(--primary)"/>
          </linearGradient>
        </defs>
        ${grid}${xlabels}
        <path class="s-area" d="${area}" fill="url(#sessFill)"/>
        <path class="s-line" d="${line}" pathLength="1" stroke="url(#sessStroke)"/>
        ${pts.map(p => `<circle class="s-dot" cx="${p.x}" cy="${p.y}" r="4.5"/>`).join('')}
        <line class="s-cursor" y1="${pad.t}" y2="${base}"/>
        <circle class="s-hover" r="7"/>
        <rect class="s-hit" x="${pad.l - 10}" y="0" width="${iw + 20}" height="${H}"/>
      </svg>
      <div class="s-tip" id="sessTip"></div>`;

    const hit = box.querySelector('.s-hit'), cur = box.querySelector('.s-cursor'),
          hov = box.querySelector('.s-hover'), tip = $('sessTip');
    hit.addEventListener('mousemove', e => {
      const mx = e.clientX - box.getBoundingClientRect().left;
      const i = Math.min(pts.length - 1, Math.max(0, Math.round((mx - pad.l) / stepX)));
      const p = pts[i];
      cur.setAttribute('x1', p.x); cur.setAttribute('x2', p.x); cur.style.opacity = 1;
      hov.setAttribute('cx', p.x); hov.setAttribute('cy', p.y); hov.style.opacity = 1;
      tip.innerHTML = `<b>${p.value.toLocaleString()}</b> sessions<span>${p.full}</span>`;
      tip.style.left = Math.min(Math.max(p.x, 90), W - 90) + 'px';
      tip.style.top = p.y + 'px';
      tip.classList.add('show');
    });
    hit.addEventListener('mouseleave', () => {
      cur.style.opacity = 0; hov.style.opacity = 0; tip.classList.remove('show');
    });
  }

  /* ---------- init ---------- */
  function render() {
    renderStats();
    renderTable();
    try { renderChart(false); } catch (e) { console.error('Chart error:', e); }
  }

  function init() {
    $('searchInput').addEventListener('input', e => { filters.q = e.target.value; page = 1; renderTable(); });
    $('dateInput').addEventListener('change', e => { filters.date = e.target.value; page = 1; renderTable(); });
    $('statusInput').addEventListener('change', e => { filters.status = e.target.value; page = 1; renderTable(); });
    $('resetBtn').addEventListener('click', () => {
      filters.q = ''; filters.date = ''; filters.status = 'all'; page = 1;
      $('searchInput').value = ''; $('dateInput').value = ''; $('statusInput').value = 'all';
      renderTable();
    });

    document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      const key = th.dataset.sort;
      sort = { key, dir: sort.key === key && sort.dir === 'desc' ? 'asc' : 'desc' };
      page = 1; renderTable();
    }));

    $('prevBtn').addEventListener('click', () => { page--; renderTable(); });
    $('nextBtn').addEventListener('click', () => { page++; renderTable(); });
    $('exportBtn').addEventListener('click', exportCSV);

    /* chart tabs (only if the card exists on this page) */
    const tabs = $('sessTabs');
    if (tabs) {
      tabs.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        chartMode = b.dataset.range;
        tabs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        renderChart(true);
      });
      window.addEventListener('resize', () => renderChart(false));
    }

    render();
    Store.subscribe(render);
    setInterval(() => { renderTable(); renderStats(); }, 30000);
  }

  return { init };
})();