// ui/seatplan-view.js
export function renderSeatplanEditor(container, state){
  container.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
      <label>Form</label>
      <select id="form" style="padding:8px">
        <option value="grid">Reihen</option>
        <option value="u">U-Form</option>
      </select>
      <label>Reihen</label><input id="rows" type="number" value="4" style="width:80px; padding:8px" />
      <label>Sitze/ Reihe</label><input id="cols" type="number" value="6" style="width:80px; padding:8px" />
      <label>Gänge (Spalten, CSV)</label><input id="aislesCols" placeholder="z.B. 3" style="width:120px; padding:8px"/>
      <label>Gänge (Reihen, CSV)</label><input id="aislesRows" placeholder="z.B. 2" style="width:120px; padding:8px"/>
      <label>Raum</label><input id="room" placeholder="Raumname" style="width:150px; padding:8px"/>
    </div>
    <div style="display:flex; gap:12px; margin-top:8px">
      <button id="apply" class="button primary">Raster aktualisieren</button>
      <button id="pdf" class="button">PDF exportieren</button>
      <button id="reset" class="button">Zurücksetzen</button>
    </div>
    <div id="gridWrap" style="margin-top:16px; overflow:auto">
      <div id="grid" class="seat-grid"></div>
    </div>
  `;

  const grid = container.querySelector('#grid');
  function draw(){
    const rows = +container.querySelector('#rows').value;
    const cols = +container.querySelector('#cols').value;
    const aislesC = parseCSVIndices(container.querySelector('#aislesCols').value);
    const aislesR = parseCSVIndices(container.querySelector('#aislesRows').value);

    // CSS Grid with dynamic gaps (32px at aisles)
    // Approach: build CSS columns with variable gap by inserting "gap columns" as empty.
    const totalCols = cols + aislesC.length;
    grid.style.gridTemplateColumns = `repeat(${totalCols}, 120px)`;
    grid.style.gridAutoRows = '70px';
    grid.style.columnGap = '16px';
    grid.style.rowGap = '16px';

    grid.innerHTML = '';
    for (let r=0; r<rows; r++){
      let cIdx = 0;
      for (let c=0; c<totalCols; c++){
        const isAisle = aislesC.includes(c+1); // 1-based pos after seat
        if (isAisle){
          const gap = document.createElement('div');
          gap.style.width='32px'; gap.style.height='1px'; // spacer via extra column + CSS gap remains 16
          grid.appendChild(gap);
        } else {
          const cell = document.createElement('div');
          cell.className='seat-cell';
          cell.textContent = `R${r+1} S${++cIdx}`;
          grid.appendChild(cell);
        }
      }
    }
    // Row aisles: simulate by adding extra row gaps via margins (simpler: increase rowGap -> 32px applies globally)
    // To get 32px at certain rows: we may split grid into sections; for brevity, use uniform 32px rowGap if any aisles
    grid.style.rowGap = aislesR.length ? '32px' : '16px';
    grid.style.columnGap = aislesC.length ? '32px' : '16px';
  }

  function parseCSVIndices(s){ 
    return (s||'').split(',').map(x=>parseInt(x.trim(),10)).filter(n=>Number.isFinite(n) && n>0);
  }

  draw();
  container.querySelector('#apply').onclick = draw;
  container.querySelector('#pdf').onclick = ()=> exportSeatplanPDF(grid);
  container.querySelector('#reset').onclick = ()=> { container.querySelector('#rows').value=4; container.querySelector('#cols').value=6; container.querySelector('#aislesCols').value=''; container.querySelector('#aislesRows').value=''; draw(); };
}

async function exportSeatplanPDF(gridEl){
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');
  const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js')).default;
  const canvas = await html2canvas(gridEl, { scale:2 });
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  // Fit image preserving aspect ratio
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * ratio, h = canvas.height * ratio;
  pdf.addImage(img, 'PNG', (pageW - w)/2, (pageH - h)/2, w, h);
  pdf.save('sitzplan.pdf');
}

export function renderSeatplanView(container, state){
  // In Tab 1 „Erfassen“ kann diese Darstellung eingebettet werden, um Schülerkacheln in ihrer Position anzuzeigen.
}
