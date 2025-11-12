import { roundToLabel } from '../logic/grades.js';

export function renderOverview(container, state) {
  container.innerHTML = `
    <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap">
      <select id="classSel" style="padding:8px; min-width:200px">
        <option>Klasse wählen</option>
      </select>
      <select id="studentSel" style="padding:8px; min-width:200px">
        <option value="">Alle Schüler</option>
      </select>
    </div>
    <div id="summary" style="margin-top:16px"></div>
    <div id="list" style="margin-top:16px"></div>
  `;
  const sum = container.querySelector('#summary');
  const list = container.querySelector('#list');

  // Beispiel: Klassengesamtübersicht
  const entries = [
    { student: 'Becker, Anna', date: '2025-01-12', val: 2 },
    { student: 'Dorf, Ben', date: '2025-01-13', val: 5 }
  ];
  sum.innerHTML = `<div><strong>Beiträge gesamt:</strong> ${entries.length}</div>`;

  list.innerHTML = entries.map(e => `<div style="padding:8px 0; border-bottom:1px solid rgba(0,0,0,.08)">${e.student} · ${e.date} · ${e.val}</div>`).join('');
}
