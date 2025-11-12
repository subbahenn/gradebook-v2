import { secure } from '../data/db.js';
import { exportClassCSV, exportClassPDF } from '../logic/export.js';

export function renderAdmin(container, state) {
  container.innerHTML = `
    <h3>Verwaltung</h3>
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
      <label>Schuljahresbeginn</label><input id="syStart" type="date" style="padding:8px"/>
      <label>Beginn 2. Halbjahr</label><input id="term2" type="date" style="padding:8px"/>
      <label>Ende Schuljahr</label><input id="syEnd" type="date" style="padding:8px"/>
      <button id="saveSY" class="button primary">Übernehmen</button>
    </div>

    <h4 style="margin-top:16px">Klasse anlegen/bearbeiten</h4>
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
      <label>Klassenname</label><input id="clsName" style="padding:8px; min-width:160px"/>
      <label>Fach</label><input id="clsSubj" style="padding:8px; min-width:120px"/>
      <label>Klassenlehrkraft</label><input id="clsT" style="padding:8px; min-width:160px"/>
      <label>Beginn</label><input id="clsStart" type="date" style="padding:8px"/>
      <label>2. Halbjahr</label><input id="clsTerm2" type="date" style="padding:8px"/>
      <label>Ende</label><input id="clsEnd" type="date" style="padding:8px"/>
    </div>
    <div style="display:flex; gap:12px; margin-top:8px">
      <input id="studentAdd" placeholder="Vorname Nachname" style="flex:1; padding:8px"/>
      <button id="addStu" class="button">Schüler hinzufügen</button>
      <input id="csvFile" type="file" accept=".csv" />
      <button id="importCsv" class="button">CSV importieren</button>
      <button id="expCsv" class="button">CSV exportieren</button>
      <button id="expPdf" class="button">PDF exportieren</button>
    </div>

    <div id="classList" style="margin-top:16px"></div>
  `;

  document.getElementById('importCsv').onclick = () => importCSV(document.getElementById('csvFile').files?.[0]);
  document.getElementById('expCsv').onclick = () => exportClassCSV(state.selectedClassId);
  document.getElementById('expPdf').onclick = () => exportClassPDF(state.selectedClassId);
}

async function importCSV(file) {
  if (!file) return alert('Bitte CSV auswählen.');
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  alert(`Importiert: ${lines.length} Zeilen (Demo).`);
}
