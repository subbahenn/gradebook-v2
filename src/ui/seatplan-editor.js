import { secure } from '../data/db.js';
import { roundToLabel, average, colorForAverage } from '../logic/grades.js';

export async function renderSeatplanEditor(container, state) {
  if (!state.selectedClassId) {
    container.innerHTML = `<div style="padding:12px">Bitte zuerst eine Klasse wählen.</div>`;
    return;
  }

  const [students, existingPlan] = await Promise.all([
    loadStudentsByClass(state.selectedClassId),
    loadSeatPlan(state.selectedClassId)
  ]);

  const plan = existingPlan || {
    classId: state.selectedClassId,
    roomName: '',
    layoutType: 'grid',
    rows: 4,
    cols: 6,
    aislesCols: [],
    aislesRows: [],
    placements: []
  };

  container.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
      <label>Form</label>
      <select id="form" style="padding:8px">
        <option value="grid">Reihen</option>
        <option value="u">U-Form</option>
      </select>
      <label>Reihen</label><input id="rows" type="number" value="${plan.rows}" style="width:80px; padding:8px"/>
      <label>Sitze/Reihe</label><input id="cols" type="number" value="${plan.cols}" style="width:80px; padding:8px"/>
      <label>Gänge (Spalten, CSV)</label><input id="aislesCols" value="${(plan.aislesCols || []).join(',')}" placeholder="z.B. 3" style="width:140px; padding:8px"/>
      <label>Raum</label><input id="room" value="${plan.roomName || ''}" placeholder="Raumname" style="width:180px; padding:8px"/>
    </div>
    <div style="display:flex; gap:12px; margin-top:8px">
      <button id="apply" class="button primary">Raster aktualisieren</button>
      <button id="save" class="button">Speichern</button>
      <button id="pdf" class="button">PDF exportieren</button>
      <button id="reset" class="button">Zurücksetzen</button>
    </div>
    <div id="gridWrap" style="margin-top:16px; overflow:auto">
      <div id="grid" class="seat-grid"></div>
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
    grid: container.querySelector('#grid')
  };

  dom.form.value = plan.layoutType;

  function drawGrid() {
    const rows = +dom.rows.value;
    const cols = +dom.cols.value;
    const aislesC = parseCSV(dom.aislesCols.value);

    dom.grid.innerHTML = '';
    dom.grid.style.gridTemplateColumns = `repeat(${cols}, 120px)`;
    dom.grid.style.rowGap = '32px';
    dom.grid.style.columnGap = '16px';
    dom.grid.style.alignSelf = 'start';
    dom.grid.style.userSelect = 'none';

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'seat-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        const hasAisleAfterCol = aislesC.includes(c);
        cell.style.marginRight = hasAisleAfterCol ? '16px' : '0';
        dom.grid.appendChild(cell);
      }
    }
  }

  function parseCSV(s) {
    return (s || '')
      .split(',')
      .map(x => parseInt(x.trim(), 10))
      .filter(n => Number.isFinite(n) && n > 0);
  }

  async function savePlan() {
    const toSave = {
      classId: state.selectedClassId,
      roomName: dom.room.value.trim(),
      layoutType: dom.form.value,
      rows: +dom.rows.value,
      cols: +dom.cols.value,
      aislesCols: parseCSV(dom.aislesCols.value),
      aislesRows: [],
      placements: plan.placements
    };
    await secure.put('seatPlans', toSave);
    alert('Sitzplan gespeichert.');
  }

  async function exportPDF() {
    const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');
    const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js')).default;

    const clone = dom.grid.cloneNode(true);
    clone.style.background = 'transparent';
    const tmp = document.createElement('div');
    tmp.style.position = 'fixed'; tmp.style.left = '-99999px'; tmp.style.top = '0';
    tmp.appendChild(clone);
    document.body.appendChild(tmp);

    const canvas = await html2canvas(clone, { scale: 2, backgroundColor: null });
    document.body.removeChild(tmp);

    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio, h = canvas.height * ratio;
    pdf.setFontSize(12);
    if (dom.room.value) pdf.text(`Raum: ${dom.room.value}`, 40, 36);
    pdf.addImage(img, 'PNG', (pageW - w) / 2, (pageH - h) / 2 + 12, w, h);
    pdf.save('sitzplan.pdf');
  }

  // Events
  dom.apply.onclick = drawGrid;
  dom.save.onclick = savePlan;
  dom.pdf.onclick = exportPDF;
  dom.reset.onclick = () => {
    dom.form.value = 'grid';
    dom.rows.value = 4; dom.cols.value = 6;
    dom.aislesCols.value = '';
    dom.room.value = '';
    plan.placements = [];
    drawGrid();
  };

  drawGrid();
}
