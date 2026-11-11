/* ===========================================================
   ParkFlow — settings page (Admin only)
   Changes preview instantly; Save keeps them for every page.
   =========================================================== */
const Settings = (() => {
  const DEFAULTS = { theme: 'dark', primary: '#2f7cf6', accent: '#28d9f5', glass: 72, preset: 'Midnight' };

  const PRESETS = [
    { name: 'Midnight', primary: '#2f7cf6', accent: '#28d9f5' },
    { name: 'Aurora',   primary: '#8b5cf6', accent: '#2fe39a' },
    { name: 'Ember',    primary: '#ff7a45', accent: '#ffb84d' },
    { name: 'Emerald',  primary: '#10b981', accent: '#22d3ee' }
  ];

  const $ = id => document.getElementById(id);
  const pick = s => ({ theme: s.theme, primary: s.primary, accent: s.accent, glass: s.glass, preset: s.preset });
  let draft;

  const isDirty = () => JSON.stringify(draft) !== JSON.stringify(pick(Store.state.settings));

  function apply() {
    UI.applyTheme(draft);                                   // whole interface, live

    // preview box
    const pv = $('pv');
    pv.setAttribute('data-theme', draft.theme);
    pv.style.setProperty('--primary', draft.primary);
    pv.style.setProperty('--accent', draft.accent);
    pv.style.setProperty('--glass', draft.glass / 100);

    // theme buttons
    document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('active', b.dataset.theme === draft.theme));

    // colors
    $('swPrimary').style.background = draft.primary; $('hexPrimary').textContent = draft.primary;
    $('swAccent').style.background  = draft.accent;  $('hexAccent').textContent  = draft.accent;
    $('inPrimary').value = draft.primary; $('inAccent').value = draft.accent;

    // slider
    $('glass').value = draft.glass;
    $('glass').style.setProperty('--fill', ((draft.glass - 40) / 60 * 100) + '%');
    $('glassVal').textContent = draft.glass + '%';

    // presets
    document.querySelectorAll('.preset').forEach(p => p.classList.toggle('active', p.dataset.name === draft.preset));

    // status + buttons
    const dirty = isDirty();
    const st = $('savedState');
    st.className = 'saved-state' + (dirty ? ' dirty' : '');
    st.innerHTML = `<i class="dot"></i>${dirty ? 'Unsaved changes' : 'All changes saved'}`;
    $('saveBtn').disabled = !dirty;
    $('resetBtn').disabled = JSON.stringify(draft) === JSON.stringify(DEFAULTS);
  }

  function init() {
    draft = pick(Store.state.settings);

    // build preset buttons
    $('presetList').innerHTML = PRESETS.map(p => `
      <button class="preset" data-name="${p.name}" data-p="${p.primary}" data-a="${p.accent}">
        <i style="background:linear-gradient(135deg,${p.primary},${p.accent})"></i>${p.name}
      </button>`).join('');

    // theme
    $('themeSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      draft.theme = b.dataset.theme; apply();
    });

    // colors
    $('inPrimary').addEventListener('input', e => { draft.primary = e.target.value; draft.preset = 'Custom'; apply(); });
    $('inAccent').addEventListener('input',  e => { draft.accent  = e.target.value; draft.preset = 'Custom'; apply(); });

    // slider
    $('glass').addEventListener('input', e => { draft.glass = Number(e.target.value); apply(); });

    // presets
    $('presetList').addEventListener('click', e => {
      const b = e.target.closest('.preset'); if (!b) return;
      draft.primary = b.dataset.p; draft.accent = b.dataset.a; draft.preset = b.dataset.name; apply();
    });

    // reset + save
    $('resetBtn').addEventListener('click', () => { draft = { ...DEFAULTS }; apply(); });
    $('saveBtn').addEventListener('click', () => {
      Store.updateSettings({ ...draft });
      apply();
      UI.toast('info', 'Settings saved', 'Your appearance will be kept for the next session.');
    });

    // reset demo data
    $('wipeBtn').addEventListener('click', () => {
      if (confirm('Reset all parking data (slots, records, notifications) back to the demo data?')) {
        Store.reset();
        UI.toast('info', 'Data reset', 'Demo data has been restored.');
      }
    });

    // the sensor simulator updates the store every few seconds; keep the unsaved draft on screen
    Store.subscribe(() => apply());

    apply();
  }

  return { init };
})();