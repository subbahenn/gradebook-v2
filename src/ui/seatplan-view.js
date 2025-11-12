// /src/ui/seatplan-view.js
import { gradeOptions, average, roundToLabel, colorForAverage } from '../logic/grades.js';
import { secure } from '../data/db.js';

// =============== Hilfsfunktionen ===============

async function loadSeatPlan(classId){
  if (!classId) return null;
  try { return await secure.get('seatPlans', classId); }
  catch { return null; }
}

async function loadStudentsByClass(classId){
  const all = await secure.all('students');
  return all.filter(s => s.classId === classId);
}

async function loadContribByClassTerm(classId, term){
  const all = await secure.all('contributions');
  return all.filter(c => c.classId === classId && c.term === term);
}

function buildAvgMap(contribs){
  const map = new Map();
  for (const c of contribs){
    if (!map.has(c.studentId)) map.set(c.studentId, []);
    map.get(c.studentId).push(c.valueNumeric);
  }
  const avg = new Map();
  for (const [sid, vals] of map.entries()){
    avg.set(sid, average(vals));
  }
  return avg;
}

function studentLabel(stu){
  return `${stu.lastName}, ${stu.firstName}`;
}

function closeAnyDialogs(){
  document.querySelectorAll('.dialog').forEach(d=>d.remove());
}

function openGradeDialog(anchorEl, student, classId, term, onSaved){
  closeAnyDialogs();
  const dlg = document.createElement('div'); dlg.className = 'dialog';
  const rect = anchorEl.getBoundingClientRect();
  dlg.style.left = `${Math.max(8, rect.left)}px`;
  dlg.style.top  = `${rect.bottom + 6}px`;

  dlg.innerHTML = `
    <div style="font-weight:600; margin-bottom:8px">${studentLabel(student)}</div>
    <div class="options"></div>
  `;

  const opts = dlg.querySelector('.options');
  gradeOptions.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'option' + (i < 2 ? ' primary' : '');
    b.textContent = `${opt.label} (${opt.value})`;
    b.onclick = async () => {
      const record = {
        id: crypto.randomUUID(),
        studentId: student.id,
        classId,
        dateISO: new Date().toISOString(),
        valueNumeric: opt.value,
        term
      };
      await secure.put('contributions', record);
      closeAnyDialogs();
      onSaved?.();
    };
    opts.appendChild(b);
  });

  document.body.appendChild(dlg);
  setTimeout(()=> document.addEventListener('click', onDocClick, { once:true }));
  function onDocClick(ev){ if (!dlg.contains(ev.target)) closeAnyDialogs(); }
}

// =============== Ansicht: Sitzplan in Tab 1 (Erfassen) ===============

export async function renderSeatplanView(container, state){
  // Wenn kein Klasse gewählt, Hinweis anzeigen
  if (!state.selectedClassId){
    container.innerHTML = `<div style="padding:12px">Bitte zuerst eine Klasse wählen.</div>`;
    return;
  }

  const plan = await loadSeatPlan(state.selectedClassId);
  if (!plan){
    container.innerHTML = `
      <div style="padding:12px">
        Kein Sitzplan vorhanden. Erstelle einen Sitzplan im Tab „Sitzplan“.
      </div>`;
    return;
  }

  const [students, contribs] = await Promise.all([
    loadStudentsByClass(state.selectedClassId),
    loadContribByClassTerm(state.selectedClassId, state.selectedTerm)
  ]);
  const avgMap = buildAvgMap(contribs);

  const byId = new Map(students.map(s => [s.id, s]));
  const placements = plan.placements || [];

  // Aufbau
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '12px';

  const room = document.createElement('div');
  room.textContent = plan.roomName ? `Raum: ${plan.roomName}` : '';
  room.style.color = 'var(--muted)';

  const grid = document.createElement('div');
  grid.className = 'seat-grid';
  // Dynamische Spaltenzahl inklusive Gänge: Wir verwenden Basis-Gap 16px und fügen
  // an Gang-Grenzen pro Sitz eine zusätzliche rechte Innenmarge hinzu, um insgesamt 32px zu erreichen.
  grid.style.gridTemplateColumns = `repeat(${plan.cols}, 120px)`;
  grid.style.rowGap = '32px';        // Vorgabe: Reihenabstand 32px
  grid.style.columnGap = '16px';     // Standardspalten-Gap
  grid.style.alignSelf = 'start';    // nicht strecken
  grid.style.userSelect = 'none';

  // Lookup: studentId -> placement
  const byPos = new Map();
  for (const p of placements){
    byPos.set(`${p.row}-${p.col}`, p.studentId);
  }

  for (let r = 1; r <= plan.rows; r++){
    for (let c = 1; c <= plan.cols; c++){
      const cell = document.createElement('div');
      cell.className = 'seat-cell';
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      // Zusätzliche Innenmarge an Gang-Grenzen
      const hasAisleAfterCol = Array.isArray(plan.aislesCols) && plan.aislesCols.includes(c);
      cell.style.marginRight = hasAisleAfterCol ? '16px' : '0';

      const sid = byPos.get(`${r}-${c}`);
      if (sid && byId.has(sid)){
        const stu = byId.get(sid);
        const avg = avgMap.get(sid) ?? null;
        const tile = document.createElement('div');
        tile.className = 'student-tile';
        tile.style.background = colorForAverage(avg);
        tile.style.width = '100%';
        tile.style.height = '100%';
        tile.style.fontSize = '0.95rem';
        tile.textContent = `${studentLabel(stu)}${avg != null ? ` (${roundToLabel(avg)})` : ''}`;
        tile.title = 'Antippen, um Beitrag zu erfassen';
        tile.onclick = (e)=> openGradeDialog(tile, stu, state.selectedClassId, state.selectedTerm, async ()=>{
          // Nach Speichern Durchschnitt neu berechnen und Kachel aktualisieren
          const newContribs = await loadContribByClassTerm(state.selectedClassId, state.selectedTerm);
          const newAvgMap = buildAvgMap(newContribs);
          const newAvg = newAvgMap.get(sid) ?? null;
          tile.style.background = colorForAverage(newAvg);
          tile.textContent = `${studentLabel(stu)}${newAvg != null ? ` (${roundToLabel(newAvg)})` : ''}`;
        });
        cell.innerHTML = '';
        cell.appendChild(tile);
      } else {
        cell.textContent = `R${r} S${c}`;
        cell.style.color = 'var(--muted)';
      }
      grid.appendChild(cell);
    }
  }

  wrap.appendChild(room);
  wrap.appendChild(grid);
  container.innerHTML = '';
  container.appendChild(wrap);
}

// =============== Editor: Tab 3 (Sitzplan erstellen/bearbeiten) ===============

export async function renderSeatplanEditor(container, state){
  if (!state.selectedClassId){
    container.innerHTML = `<div style="padding:12px">Bitte zuerst eine Klasse wählen.</div>`;
    return;
  }

  const [students, existingPlan] = await Promise.all([
    loadStudentsByClass(state.selectedClassId),
    loadSeatPlan(state.selectedClassId)
  ]);

  // Defaults
  const plan = existingPlan || {
    classId: state.selectedClassId,
    roomName: '',
    layoutType: 'grid',
    rows: 4,
    cols: 6,
    aislesCols: [],
    aislesRows: [], // für Vollständigkeit, rowGap ist global 32px
    placements: []  // { studentId, row, col }
  };

  // UI Grundgerüst
  container.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
      <label>Form</label>
      <select id="form" style="padding:8px">
        <option value="grid">Reihen</option>
        <option value="u">U-Form</option>
      </select>
      <label>Reihen</label><input id="rows" type="number" min="1" value="${plan.rows}" style="width:80px; padding:8px"/>
      <label>Sitze/Reihe</label><input id="cols" type="number" min="1" value="${plan.cols}" style="width:80px; padding:8px"/>
      <label>Gänge (Spalten, CSV)</label><input id="aislesCols" value="${(plan.aislesCols||[]).join(',')}" placeholder="z.B. 3" style="width:140px; padding:8px"/>
      <label>Raum</label><input id="room" value="${plan.roomName||''}" placeholder="Raumname" style="width:180px; padding:8px"/>
    </div>
    <div style="display:flex; gap:12px; margin-top:8px">
      <button id="apply" class="button primary">Raster aktualisieren</button>
      <button id="save" class="button">Speichern</button>
      <button id="pdf" class="button">PDF exportieren</button>
      <button id="reset" class="button">Zurücksetzen</button>
    </div>

    <div style="display:grid; grid-template-columns: 280px 1fr; gap:16px; margin-top:16px; min-height:400px">
      <div id="palette" style="border:1px solid rgba(0,0,0,.1); border-radius:12px; padding:12px; overflow:auto">
        <div style="font-weight:600; margin-bottom:8px">Schüler</div>
        <div id="palList" style="display:grid; gap:8px"></div>
      </div>
      <div id="gridWrap" style="overflow:auto">
        <div id="grid" class="seat-grid"></div>
      </div>
    </div>
  `;

  const dom = {
    form: container.querySelector('#form'),
    rows: container.querySelector('#rows'),
    cols: container.querySelector('#cols'),
    aislesCols: container.querySelector('#aislesCols'),
    room: container.querySelector('#room'),
    apply: container.querySelector('#apply'),
    save: container.querySelector('#save'),
    pdf: container.querySelector('#pdf'),
    reset: container.querySelector('#reset'),
    palette: container.querySelector('#palList'),
    grid: container.querySelector('#grid')
  };

  dom.form.value = plan.layoutType;

  // Palette aufbauen
  function renderPalette(){
    dom.palette.innerHTML = '';
    const placedIds = new Set(plan.placements.map(p => p.studentId));
    students
      .slice()
      .sort((a,b)=> a.lastName.localeCompare(b.lastName, 'de'))
      .forEach(stu => {
        const item = document.createElement('div');
        item.textContent = studentLabel(stu);
        item.className = 'student-tile';
        item.style.minHeight = '48px';
        item.style.minWidth = 'unset';
        item.style.cursor = 'grab';
        item.draggable = true;

        // Bereits gesetzte Schüler in der Palette farbig hinterlegen (Sekundärfarbe)
        if (placedIds.has(stu.id)){
          item.style.background = 'var(--primary-2)';
          item.style.color = '#fff';
          item.title = 'Bereits im Raster platziert';
        }

        item.addEventListener('dragstart', (e)=>{
          e.dataTransfer.setData('text/plain', stu.id);
          e.dataTransfer.effectAllowed = 'move';
        });

        dom.palette.appendChild(item);
      });
  }

  // Raster zeichnen
  function drawGrid(){
    const rows = +dom.rows.value;
    const cols = +dom.cols.value;
    const aislesC = parseCSV(dom.aislesCols.value);

    dom.grid.innerHTML = '';
    dom.grid.style.gridTemplateColumns = `repeat(${cols}, 120px)`;
    dom.grid.style.rowGap = '32px';      // Vorgabe: 32px zwischen Reihen
    dom.grid.style.columnGap = '16px';   // Basis-Gap
    dom.grid.style.alignSelf = 'start';
    dom.grid.style.userSelect = 'none';

    // Für jede Zelle leere Sitzfläche rendern
    for (let r=1; r<=rows; r++){
      for (let c=1; c<=cols; c++){
        const cell = document.createElement('div');
        cell.className = 'seat-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        const hasAisleAfterCol = aislesC.includes(c);
        cell.style.marginRight = hasAisleAfterCol ? '16px' : '0';

        // Drop-Ziele
        cell.addEventListener('dragover', (e)=> {
          e.preventDefault();
          cell.style.borderColor = 'var(--primary)';
          cell.style.background = '#f0fffa';
        });
        cell.addEventListener('dragleave', ()=> {
          cell.style.borderColor = 'rgba(0,0,0,.2)';
          cell.style.background = '#fafafa';
        });
        cell.addEventListener('drop', (e)=> {
          e.preventDefault();
          const sid = e.dataTransfer.getData('text/plain');
          placeStudentAt(sid, r, c);
          cell.style.borderColor = 'rgba(0,0,0,.2)';
          cell.style.background = '#fafafa';
        });

        dom.grid.appendChild(cell);
      }
    }

    // Bereits vorhandene Platzierungen einsetzen (neutral, keine Farbhinterlegung im Raster)
    for (const p of plan.placements){
      if (p.row>=1 && p.row<=rows && p.col>=1 && p.col<=cols){
        const cell = findCell(p.row, p.col);
        if (cell) cell.textContent = ''; // leeren
        const stu = students.find(s => s.id === p.studentId);
        if (stu){
          const tag = document.createElement('div');
          tag.textContent = studentLabel(stu);
          tag.style.fontWeight = '600';
          tag.style.color = '#333';
          tag.style.textAlign = 'center';
          tag.style.padding = '4px';
          tag.style.width = '100%';
          tag.style.height = '100%';
          tag.style.display = 'flex';
          tag.style.alignItems = 'center';
          tag.style.justifyContent = 'center';
          cell.appendChild(tag);
        }
      }
    }
  }

  function findCell(r,c){
    return dom.grid.querySelector(`.seat-cell[data-row="${r}"][data-col="${c}"]`);
  }

  function parseCSV(s){
    return (s||'')
      .split(',')
      .map(x => parseInt(x.trim(),10))
      .filter(n => Number.isFinite(n) && n > 0);
  }

  function placeStudentAt(studentId, r, c){
    // Entferne alte Platzierung dieses Schülers
    plan.placements = plan.placements.filter(p => p.studentId !== studentId);
    // Entferne ggf. Schüler, der bereits auf diesem Platz sitzt
    plan.placements = plan.placements.filter(p => !(p.row===r && p.col===c));
    // Füge neue Platzierung ein
    plan.placements.push({ studentId, row:r, col:c });
    drawGrid();  // neu zeichnen
    renderPalette(); // Palette aktualisieren (Farbmarkierung)
  }

  async function savePlan(){
    const toSave = {
      classId: state.selectedClassId,
      roomName: dom.room.value.trim(),
      layoutType: dom.form.value,
      rows: +dom.rows.value,
      cols: +dom.cols.value,
      aislesCols: parseCSV(dom.aislesCols.value),
      aislesRows: [], // aktuell nicht genutzt; Reihenabstand ist global 32px
      placements: plan.placements
    };
    await secure.put('seatPlans', toSave);
    alert('Sitzplan gespeichert.');
  }

  async function exportPDF(){
    const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');
    const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js')).default;

    // Wir rendern eine Kopie des Grids im gewünschten Zustand, damit Palette/Dropschatten egal sind
    const clone = dom.grid.cloneNode(true);
    clone.style.background = 'transparent';
    const tmp = document.createElement('div');
    tmp.style.position = 'fixed'; tmp.style.left='-99999px'; tmp.style.top='0';
    tmp.appendChild(clone);
    document.body.appendChild(tmp);

    const canvas = await html2canvas(clone, { scale: 2, backgroundColor: null });
    document.body.removeChild(tmp);

    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio, h = canvas.height * ratio;
    pdf.setFontSize(12);
    if (dom.room.value) pdf.text(`Raum: ${dom.room.value}`, 40, 36);
    pdf.addImage(img, 'PNG', (pageW - w)/2, (pageH - h)/2 + 12, w, h);
    pdf.save('sitzplan.pdf');
  }

  // Events
  dom.apply.onclick = ()=>{
    plan.layoutType = dom.form.value;
    plan.rows = +dom.rows.value;
    plan.cols = +dom.cols.value;
    plan.aislesCols = parseCSV(dom.aislesCols.value);
    drawGrid();
  };
  dom.save.onclick = savePlan;
  dom.pdf.onclick = exportPDF;
  dom.reset.onclick = ()=>{
    dom.form.value = 'grid';
    dom.rows.value = 4; dom.cols.value = 6;
    dom.aislesCols.value = '';
    dom.room.value = '';
    plan.placements = [];
    drawGrid(); renderPalette();
  };

  // Initial
  renderPalette();
  drawGrid();
}
