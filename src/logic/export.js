import { secure } from '../data/db.js';
import { average, roundToLabel } from './grades.js';

export async function exportClassCSV(classId){
  // Lade Schüler und Beiträge, gruppiere, berechne Durchschnitt je Halbjahr
  const rows = [
    ['Schüler','Durchschnitt 1. Hj','Durchschnitt 2. Hj'],
    ['Becker, Anna','2','1-2'],
  ];
  const csv = rows.map(r=>r.map(s=>`"${s.replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  download(blob, 'noten.csv');
}

export async function exportClassPDF(classId){
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');
  const pdf = new jsPDF({ orientation:'portrait', unit:'pt', format:'a4' });
  pdf.setFontSize(14);
  pdf.text('Notenübersicht', 40, 40);
  // TODO: Tabelle mit Schülern / Hj1 / Hj2 + Einzellisten danach
  pdf.save('noten.pdf');
}

function download(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
}
