export function Header(state, onAction) {
  const el = document.createElement('div');
  el.className = 'header';
  el.innerHTML = `
    <div class="title">Mündliche Noten</div>
    <div class="controls">
      <select id="classSel" title="Klasse" style="min-width:160px; padding:8px">
        <option value="">Klasse wählen</option>
      </select>
      <div class="segment" role="tablist" aria-label="Halbjahr">
        <button id="t1" class="${state.selectedTerm === 1 ? 'active' : ''}">1. Halbjahr</button>
        <button id="t2" class="${state.selectedTerm === 2 ? 'active' : ''}">2. Halbjahr</button>
      </div>
      <div class="segment" role="tablist" aria-label="Ansicht">
        <button id="v1" class="${state.viewMode === 'lastname' ? 'active' : ''}">Nachname</button>
        <button id="v2" class="${state.viewMode === 'firstname' ? 'active' : ''}">Vorname</button>
        <button id="v3" class="${state.viewMode === 'seatplan' ? 'active' : ''}">Sitzplan</button>
      </div>
    </div>
    <div class="right" id="today"></div>
  `;
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  el.querySelector('#today').textContent = `${dd}.${mm}.${yyyy}`;

  el.querySelector('#t1').onclick = () => onAction('selectTerm', 1);
  el.querySelector('#t2').onclick = () => onAction('selectTerm', 2);
  el.querySelector('#v1').onclick = () => onAction('viewMode', 'lastname');
  el.querySelector('#v2').onclick = () => onAction('viewMode', 'firstname');
  el.querySelector('#v3').onclick = () => onAction('viewMode', 'seatplan');

  // Klassenoptionen (Platzhalter, später aus State füllen)
  const sel = el.querySelector('#classSel');
  // ...fülle Optionen aus state.classes wenn verfügbar...
  sel.onchange = () => onAction('selectClass', sel.value || null);

  return el;
}
