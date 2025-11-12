// /src/ui/grade-dialog.js
import { gradeOptions } from '../logic/grades.js';
import { secure } from '../data/db.js';

let openEl = null;

export function closeGradeDialogs(){
  document.querySelectorAll('.dialog.grade-dialog').forEach(d => d.remove());
  openEl = null;
}

/**
 * Öffnet den Noten-Dialog am angegebenen Element.
 * @param {HTMLElement} anchorEl - Element, an dem der Dialog erscheinen soll
 * @param {Object} student - { id, firstName, lastName, classId? }
 * @param {Object} context - { classId, term }
 * @param {Object} [opts] - { onSaved?: Function }
 */
export function openGradeDialog(anchorEl, student, context, opts = {}){
  closeGradeDialogs();

  const dlg = document.createElement('div');
  dlg.className = 'dialog grade-dialog';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.style.minWidth = '280px';

  dlg.innerHTML = `
    <div style="font-weight:600; margin-bottom:8px">
      ${student.lastName}, ${student.firstName}
    </div>
    <div class="options" role="group" aria-label="Bewertung">
    </div>
  `;

  // Buttons hinzufügen
  const optionsWrap = dlg.querySelector('.options');
  gradeOptions.forEach((opt, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option' + (i < 2 ? ' primary' : '');
    b.textContent = `${opt.label} (${opt.value})`;
    b.style.minHeight = '56px'; // Touch-Ziel
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const record = {
        id: crypto.randomUUID(),
        studentId: student.id,
        classId: context.classId ?? student.classId,
        dateISO: new Date().toISOString(),
        valueNumeric: opt.value,
        term: context.term
      };
      await secure.put('contributions', record);
      closeGradeDialogs();
      opts.onSaved?.(record);
    });
    optionsWrap.appendChild(b);
  });

  document.body.appendChild(dlg);
  positionDialogNear(anchorEl, dlg);

  // Schließen bei Klick außerhalb / Escape
  setTimeout(() => {
    const onDocClick = (ev) => {
      if (!dlg.contains(ev.target)) {
        closeGradeDialogs();
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onKey);
      }
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        closeGradeDialogs();
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
  });

  openEl = dlg;
}

function positionDialogNear(anchorEl, dlg){
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Erstmal unterhalb platzieren
  dlg.style.left = `${rect.left}px`;
  dlg.style.top  = `${rect.bottom + 6}px`;

  // Nach dem Einfügen: ggf. an den Viewport anpassen
  const drect = dlg.getBoundingClientRect();
  let left = drect.left;
  let top  = drect.top;

  if (drect.right > vw - 8) left = Math.max(8, vw - drect.width - 8);
  if (drect.left < 8) left = 8;

  // Wenn unten kein Platz, oberhalb anzeigen
  if (drect.bottom > vh - 8) {
    top = Math.max(8, rect.top - drect.height - 6);
  }
  dlg.style.left = `${left}px`;
  dlg.style.top  = `${top}px`;
}
