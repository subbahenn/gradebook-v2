import { roundToLabel, average, colorForAverage } from '../logic/grades.js';
import { secure } from '../data/db.js';

async function loadSeatPlan(classId) {
  if (!classId) return null;
  try { return await secure.get('seatPlans', classId); }
  catch { return null; }
}

async function loadStudentsByClass(classId) {
  const all = await secure.all('students');
  return all.filter(s => s.classId === classId);
}

async function loadContribByClassTerm(classId, term) {
  const all = await secure.all('contributions');
  return all.filter(c => c.classId === classId && c.term === term);
}

function buildAvgMap(contribs) {
  const map = new Map();
  for (const c of contribs) {
    if (!map.has(c.studentId)) map.set(c.studentId, []);
    map.get(c.studentId).push(c.valueNumeric);
  }
  const avg = new Map();
  for (const [sid, vals] of map.entries()) {
    avg.set(sid, average(vals));
  }
  return avg;
}

function studentLabel(stu) {
  return `${stu.lastName}, ${stu.firstName}`;
}

function closeAnyDialogs() {
  document.querySelectorAll('.dialog').forEach(d => d.remove());
}

function openGradeDialog(anchorEl, student, classId, term, onSaved) {
  closeAnyDialogs();
  const dlg = document.createElement('div'); dlg.className = 'dialog';
  const rect = anchorEl.getBoundingClientRect();
  dlg.style.left = `${rect.left}px`;
  dlg.style.top = `${rect.bottom + 6}px`;

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
  setTimeout(() => {
    document.addEventListener('click', onDocClick, { once: true });
  });
  function onDocClick(ev) { if (!dlg.contains(ev.target)) closeAnyDialogs(); }
}

export async function renderSeatplanView(container, state) {
  if (!state.selectedClassId) {
    container.innerHTML = `<div style="padding:12px">Bitte zuerst eine Klasse wählen.</div>`;
    return;
  }

  const plan = await loadSeatPlan(state.selectedClassId);
  if (!plan) {
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

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '12px';

  const room = document.createElement('div');
  room.textContent = plan.roomName ? `Raum: ${plan.roomName}` : '';
  room.style.color = 'var(--muted)';

  const grid = document.createElement('div');
  grid.className = 'seat-grid';
  grid.style.gridTemplateColumns = `repeat(${plan.cols}, 120px)`;
  grid.style.rowGap = '32px';
  grid.style.columnGap = '16px';
  grid.style.alignSelf = 'start';
  grid.style.userSelect = 'none';

  const byPos = new Map();
  for (const p of placements) {
    byPos.set(`${p.row}-${p.col}`, p.studentId);
  }

  for (let r = 1; r <= plan.rows; r++) {
    for (let c = 1; c <= plan.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'seat-cell';
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      const sid = byPos.get(`${r}-${c}`);
      if (sid && byId.has(sid)) {
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
        tile.onclick = (e) => openGradeDialog(tile, stu, state.selectedClassId, state.selectedTerm, async () => {
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
