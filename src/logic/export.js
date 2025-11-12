import { secure } from '../data/db.js';
import { average, roundToLabel } from './grades.js';

export async function exportClassCSV(classId) {
  const students = await secure.all('students');
  const contributions = await secure.all('contributions');
  const rows = [['Schüler', 'Durchschnitt 1. Hj', 'Durchschnitt 2. Hj']];
  
  const classContribs = contributions.filter(c => c.classId === classId);
  const studentIds = new Set(students.map(s => s.id));

  for (const student of students) {
    if (student.classId !== classId) continue;
    const studentContribs = classContribs.filter(c => c.studentId === student.id);
    const avg1 = average(studentContribs.filter(c => c.term === 1).map(c => c.valueNumeric));
    const avg2 = average(studentContribs.filter(c => c.term === 2).map(c => c.valueNumeric));
    rows.push([studentLabel(student), roundToLabel(avg1), roundToLabel(avg2)]);
  }

  const csv = rows.map(r => r.map(s => `"${s.replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  download(blob, 'noten.csv');
}

export async function exportClassPDF(classId) {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  pdf.setFontSize(14);
  pdf.text('Notenübersicht', 40, 40);
  // TODO: Tabelle mit Schülern / Hj1 / Hj2 + Einzellisten danach
  pdf.save('noten.pdf');
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
