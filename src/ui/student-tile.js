import { openGradeDialog } from './grade-dialog.js';
import { roundToLabel, colorForAverage } from '../logic/grades.js';
import { secure } from '../data/db.js';

export function renderErfassen(container, state) {
  const students = demoStudents(state); // sortiere je nach viewMode
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';

  students.forEach(stu => {
    const tile = document.createElement('div');
    tile.className = 'student-tile';
    const avg = stu.avg; // computeAvg(stu.id, state.selectedTerm)
    tile.style.background = colorForAverage(avg);
    tile.textContent = `${stu.lastName}, ${stu.firstName} ${avg ? `(${roundToLabel(avg)})` : ''}`;
    tile.onclick = (e) => openGradeDialog(tile, stu, { classId: stu.classId, term: state.selectedTerm }, {
      onSaved: () => {
        // Optional: UI aktualisieren
      }
    });
    grid.appendChild(tile);
  });

  container.appendChild(grid);
}

// Platzhalter
function demoStudents(state) {
  return [
    { id: 's1', classId: 'c1', firstName: 'Anna', lastName: 'Becker', avg: 2.1 },
    { id: 's2', classId: 'c1', firstName: 'Ben', lastName: 'Dorf', avg: 4.0 },
    { id: 's3', classId: 'c1', firstName: 'Carla', lastName: 'Ein', avg: 1.7 }
  ];
}
