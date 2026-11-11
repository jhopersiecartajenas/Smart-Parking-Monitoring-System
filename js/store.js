/* ===========================================================
   ParkFlow — shared data store (localStorage)
   Used by BOTH Admin and Security accounts
   =========================================================== */
const Store = (() => {
  const KEY = 'parkflow_state_v1';
  const MAX_SLOTS = 8;
  const listeners = new Set();
  const myId = Math.random().toString(36).slice(2);
  let state = null;

  /* ---------- helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

  function makePlate() {
    let p = '';
    for (let i = 0; i < 3; i++) p += LETTERS[rand(0, LETTERS.length - 1)];
    return `${p} ${rand(1000, 9999)}`;
  }

  const fmtTime = ts => {
    const d = new Date(ts);
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
  };

  const fmtDate = ts =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const fmtDuration = ms => {
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'Just now';
    const h = Math.floor(m / 60);
    return h ? `${h}h ${pad(m % 60)}m` : `${m}m`;
  };

  const dayKey = ts => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  /* ---------- default / seed data ---------- */
  function seed() {
    const now = Date.now();
    const slots = Array.from({ length: MAX_SLOTS }, (_, i) => ({
      id: `P${pad(i + 1)}`, occupied: false, plate: null, entry: null, recordId: null
    }));

    const records = [];
    for (let i = 0; i < 20; i++) {
      const num = 1058 - i;
      const entry = now - (i * 22 + 10) * 60000;
      const rec = {
        id: `REC-${num}`, plate: makePlate(), slot: `P${pad((i % MAX_SLOTS) + 1)}`,
        entry, exit: null, status: 'Exited', warned: false, overstayed: false
      };
      if (i < 3) {
        rec.slot = `P${pad(i + 1)}`;
        rec.status = 'Parked';
        const s = slots[i];
        s.occupied = true; s.plate = rec.plate; s.entry = entry; s.recordId = rec.id;
      } else {
        rec.exit = Math.min(entry + rand(40, 150) * 60000, now - 60000);
      }
      records.push(rec);
    }

    return {
      slots, records,
      nextRecord: 1059,
      gates: {
        entrance: { open: true, by: 'System', at: now },
        exit:     { open: true, by: 'System', at: now }
      },
      notifications: [],
      settings: {
        closingTime: '22:00',     // parking hours end (10:00 PM)
        warnMinutes: 30,          // warn this many minutes before closing
        simulator: true,          // auto-generates test cars (sensors)
        theme: 'dark', primary: '#2f7cf6', accent: '#28d9f5', glass: 72, preset: 'Midnight'
      }
    };
  }

  /* ---------- load / save / events ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : seed();
    } catch { state = seed(); }
    if (!state.gates) {
      const old = state.gate || { open: true, by: 'System', at: Date.now() };
      state.gates = { entrance: { ...old }, exit: { ...old } };
      delete state.gate;
    }
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    emit();
  }

  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  window.addEventListener('storage', e => {
    if (e.key === KEY) { load(); emit(); }
  });

  /* ---------- notifications ---------- */
  function notify(type, title, message, red) {
    state.notifications.unshift({
      id: 'N' + Date.now() + rand(10, 99), type, title, message, time: Date.now(), read: false,
      full: red !== undefined ? red : state.slots.every(s => s.occupied)   // true = red, false = green
    });
    state.notifications = state.notifications.slice(0, 50);
  }

  function markAllRead() { state.notifications.forEach(n => n.read = true); save(); }
  function clearNotifications() { state.notifications = []; save(); }
  function dismissNotification(id) {
    state.notifications = state.notifications.filter(n => n.id !== id); save();
  }

  /* ---------- gates (entrance + exit) ---------- */
  const GATE_NAMES = { entrance: 'Entrance gate', exit: 'Exit gate' };

  function setGate(which, open, by) {
    const g = state.gates[which];
    if (!g || g.open === open) return;
    state.gates[which] = { open, by, at: Date.now() };
    notify('info', `${GATE_NAMES[which]} ${open ? 'opened' : 'closed'}`,
      `Manually ${open ? 'opened' : 'closed'} by ${by}.`);
    save();
  }
  const toggleGate = (which, by) => setGate(which, !state.gates[which].open, by);

  /* ---------- parking actions ---------- */
  function enterCar(plate, slotId) {
    if (!state.gates.entrance.open) return { ok: false, reason: 'Entrance gate is closed' };
    const slot = slotId
      ? state.slots.find(s => s.id === slotId && !s.occupied)
      : state.slots.filter(s => !s.occupied)[0];
    if (!slot) return { ok: false, reason: 'Parking is full' };

    const now = Date.now();
    const rec = {
      id: `REC-${state.nextRecord++}`, plate: plate || makePlate(), slot: slot.id,
      entry: now, exit: null, status: 'Parked', warned: false, overstayed: false
    };
    slot.occupied = true; slot.plate = rec.plate; slot.entry = now; slot.recordId = rec.id;
    state.records.unshift(rec);

    if (state.slots.every(s => s.occupied)) notify('danger', 'Parking is full', `All ${MAX_SLOTS} slots are occupied.`, true);
    else notify('info', 'Car entered', `${rec.plate} parked in ${slot.id} at ${fmtTime(now)}.`, false);
    save();
    return { ok: true, slot: slot.id, record: rec };
  }

  function exitCar(slotId) {
    if (!state.gates.exit.open) return { ok: false, reason: 'Exit gate is closed' };
    const slot = state.slots.find(s => s.id === slotId && s.occupied);
    if (!slot) return { ok: false };

    const wasFull = state.slots.every(s => s.occupied);
    const plate = slot.plate;
    const rec = state.records.find(r => r.id === slot.recordId);
    if (rec) { rec.exit = Date.now(); rec.status = 'Exited'; }
    slot.occupied = false; slot.plate = null; slot.entry = null; slot.recordId = null;

    if (wasFull) notify('info', 'Car exited', `${plate} left ${slotId}. Parking has a free slot again.`, true);
    else notify('info', 'Car exited', `${plate} left ${slotId}.`, true);
    save();
    return { ok: true };
  }
  /* ---------- time-limit warnings ---------- */
  function closingTimestamp() {
    const [h, m] = state.settings.closingTime.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.getTime();
  }

  function checkTimeLimits() {
    const now = Date.now();
    const closing = closingTimestamp();
    const warnAt = closing - state.settings.warnMinutes * 60000;
    let changed = false;

    state.slots.forEach(s => {
      if (!s.occupied) return;
      const rec = state.records.find(r => r.id === s.recordId);
      if (!rec) return;

      if (now >= closing && !rec.overstayed) {
        rec.overstayed = true; changed = true;
        notify('danger', 'Time limit exceeded',
          `${s.plate} in ${s.id} is still parked past ${fmtTime(closing)}.`);
      } else if (now >= warnAt && now < closing && !rec.warned) {
        rec.warned = true; changed = true;
        const left = Math.max(1, Math.ceil((closing - now) / 60000));
        notify('warn', 'Parking hours ending soon',
          `${s.plate} in ${s.id} must leave in ${left} min (closes ${fmtTime(closing)}).`);
      }
    });
    if (changed) save();
  }

  /* ---------- stats ---------- */
  function stats() {
    const today = dayKey(Date.now());
    const todays = state.records.filter(r => dayKey(r.entry) === today);
    const occupied = state.slots.filter(s => s.occupied).length;
    return {
      total: MAX_SLOTS,
      occupied,
      available: MAX_SLOTS - occupied,
      slotStatus: `${occupied}/${MAX_SLOTS}`,
      vehiclesToday: todays.length,
      exitedToday: todays.filter(r => r.status === 'Exited').length,
      unread: state.notifications.filter(n => !n.read).length
    };
  }

  /* ---------- sensor simulator (replaces the old buttons) ---------- */
  function simTick() {
    if (!state.settings.simulator) return;
    const lock = Number(localStorage.getItem('parkflow_sim_lock') || 0);
    const owner = localStorage.getItem('parkflow_sim_owner');
    if (owner !== myId && Date.now() - lock < 20000) return; // another tab runs it
    localStorage.setItem('parkflow_sim_owner', myId);
    localStorage.setItem('parkflow_sim_lock', String(Date.now()));

    load();
    const occupied = state.slots.filter(s => s.occupied);
    const free = state.slots.filter(s => !s.occupied);
    const goIn = free.length && (!occupied.length || Math.random() < 0.55);
    if (goIn) enterCar();
    else if (occupied.length) exitCar(occupied[rand(0, occupied.length - 1)].id);
  }

  function setSimulator(on) { state.settings.simulator = on; save(); }

  function updateSettings(patch) { Object.assign(state.settings, patch); save(); }

  function reset() { localStorage.removeItem(KEY); load(); emit(); }

  /* ---------- init ---------- */
  function init() {
    load();
    checkTimeLimits();
    setInterval(checkTimeLimits, 15000);
    const loop = () => { simTick(); setTimeout(loop, rand(9000, 16000)); };
    setTimeout(loop, 6000);
    return state;
  }

  return {
    MAX_SLOTS, init, subscribe,
    get state() { return state; },
    save, enterCar, exitCar, setGate, toggleGate,
    notify, markAllRead, clearNotifications, dismissNotification,
    checkTimeLimits, closingTimestamp, stats,
    setSimulator, updateSettings, reset,
    fmtTime, fmtDate, fmtDuration, dayKey, makePlate
  };
})();
