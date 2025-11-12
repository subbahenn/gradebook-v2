export function Tabs(state, onChange) {
  const el = document.createElement('div');
  el.className = 'tabs';
  el.setAttribute('role', 'tablist');
  el.setAttribute('aria-label', 'Hauptnavigation');

  const tabs = [
    { id: 'erfassen', label: 'Erfassen' },
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'sitzplan', label: 'Sitzplan' },
    { id: 'verwaltung', label: 'Verwaltung' }
  ];

  const buttons = tabs.map((t, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t.label;
    btn.dataset.tab = t.id;
    btn.setAttribute('role', 'tab');
    btn.className = (state.route === t.id ? 'active' : '');
    btn.setAttribute('aria-selected', state.route === t.id ? 'true' : 'false');
    btn.tabIndex = state.route === t.id ? 0 : -1;

    btn.addEventListener('click', () => {
      if (state.route !== t.id) {
        setActive(t.id);
        onChange(t.id);
      }
    });

    // Tastatur-Navigation (Links/Rechts)
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        let next = (idx + dir + tabs.length) % tabs.length;
        const nextBtn = el.querySelectorAll('button')[next];
        nextBtn.focus();
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });

    el.appendChild(btn);
    return btn;
  });

  function setActive(id) {
    buttons.forEach(b => {
      const active = b.dataset.tab === id;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.tabIndex = active ? 0 : -1;
    });
    state.route = id; // optional: Local sync
  }

  return el;
}
