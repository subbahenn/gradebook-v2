import { openDb, loadUser, initUser, login, secure } from './data/db.js';
import { Header } from './ui/header.js';
import { Tabs } from './ui/tabs.js';
import { renderErfassen } from './ui/student-tile.js';
import { renderOverview } from './ui/overview.js';
import { renderSeatplanView, renderSeatplanEditor } from './ui/seatplan-view.js';
import { renderAdmin } from './ui/admin.js';

export async function initApp(root) {
  await openDb();
  const user = await loadUser();
  const state = {
    route: 'erfassen',
    classes: [],
    students: [],
    contributions: [],
    seatPlans: [],
    selectedClassId: null,
    selectedTerm: 1,
    today: new Date(),
    hasSeatPlan: false,
    viewMode: 'seatplan' // 'lastname' | 'firstname' | 'seatplan'
  };

  async function ensureAuth() {
    if (!user) {
      await presentFirstRun();
    } else {
      await presentLogin(user.username);
    }
  }

  async function presentFirstRun() {
    root.innerHTML = `
      <div style="padding:24px; max-width:480px; margin:0 auto">
        <h3>Willkommen</h3>
        <p>Lege einen Zugang an.</p>
        <label>Nutzername</label><br/>
        <input id="u" style="width:100%; padding:10px; margin:8px 0" />
        <label>Passwort</label><br/>
        <input id="p" type="password" style="width:100%; padding:10px; margin:8px 0" />
        <button id="go" class="button primary" style="width:100%">Anlegen</button>
      </div>`;
    document.getElementById('go').onclick = async () => {
      const u = document.getElementById('u').value.trim();
      const p = document.getElementById('p').value;
      if (!u || !p) return alert('Bitte ausfüllen.');
      await initUser(u, p);
      await navigator.credentials?.store?.(new PasswordCredential({ id: u, password: p }));
      renderApp();
    };
  }

  async function presentLogin(username) {
    root.innerHTML = `
      <div style="padding:24px; max-width:480px; margin:0 auto">
        <h3>Login</h3>
        <p>Angemeldet als ${username}</p>
        <label>Passwort</label><br/>
        <input id="p" type="password" style="width:100%; padding:10px; margin:8px 0" />
        <button id="go" class="button primary" style="width:100%">Login</button>
      </div>`;
    document.getElementById('go').onclick = async () => {
      const p = document.getElementById('p').value;
      try {
        await login(p);
        renderApp();
      } catch (e) { alert('Falsches Passwort.'); }
    };
  }

  function renderApp() {
    root.innerHTML = '';
    const headerEl = Header(state, onHeaderAction);
    const tabsEl = Tabs(state, onTabChange);
    const content = document.createElement('div'); content.className = 'content';

    root.appendChild(headerEl);
    root.appendChild(tabsEl);
    root.appendChild(content);
    renderRoute(content);
  }

  function onHeaderAction(action, payload) {
    if (action === 'selectClass') { state.selectedClassId = payload; renderRoute(root.querySelector('.content')); }
    if (action === 'selectTerm') { state.selectedTerm = payload; renderRoute(root.querySelector('.content')); }
    if (action === 'viewMode') { state.viewMode = payload; renderRoute(root.querySelector('.content')); }
  }

  function onTabChange(tab) {
    state.route = tab;
    const c = root.querySelector('.content');
    renderRoute(c);
  }

  function renderRoute(container) {
    container.innerHTML = '';
    if (state.route === 'erfassen') renderErfassen(container, state);
    if (state.route === 'uebersicht') renderOverview(container, state);
    if (state.route === 'sitzplan') renderSeatplanEditor(container, state); // Editor in Tab 3
    if (state.route === 'verwaltung') renderAdmin(container, state);
    // Titel aktualisieren
    root.querySelector('.title').textContent = titleForRoute(state);
  }

  function titleForRoute(s) {
    const cls = s.classes.find(c => c.id === s.selectedClassId);
    const cname = cls ? cls.name : '–';
    if (s.route === 'erfassen') return `Mündliche Noten der Klasse ${cname}`;
    if (s.route === 'uebersicht') return `Übersicht der Klasse ${cname}`;
    if (s.route === 'sitzplan') return `Sitzplan der Klasse ${cname}`;
    if (s.route === 'verwaltung') return 'Verwaltung';
    return 'Mündliche Noten';
  }

  await ensureAuth();
}
