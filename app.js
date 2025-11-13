// ===== Noten-Mapping =====
const SYMBOL_TO_VALUE = { "+++":1, "++":2, "+":3, "o":4, "-":5, "--":6, "−":5, "−−":6 };
const DISPLAY_MINUS = s => s.replaceAll("-", "−");
const NORM_SYMBOL = s => s.replaceAll("−", "-");

// ===== Anzeige-Stufen (Label) =====
const GRADE_STEPS = [
  [1.00, "1"],   [1.25, "1−"],  [1.50, "1-2"], [1.75, "2+"],
  [2.00, "2"],   [2.25, "2−"],  [2.50, "2-3"], [2.75, "3+"],
  [3.00, "3"],   [3.25, "3−"],  [3.50, "3-4"], [3.75, "4+"],
  [4.00, "4"],   [4.25, "4−"],  [4.50, "4-5"], [4.75, "5+"],
  [5.00, "5"],   [5.25, "5−"],  [5.50, "5-6"], [5.75, "6+"],
  [6.00, "6"]
];
function nearestGradeLabel(avg){
  if (avg==null) return "—";
  let best = GRADE_STEPS[0], dist = Math.abs(avg-best[0]);
  for (const st of GRADE_STEPS){
    const d = Math.abs(avg - st[0]);
    if (d < dist || (d===dist && st[0] < best[0])){ best = st; dist = d; }
  }
  return best[1];
}

// ===== Krypto/IndexedDB (AES-GCM-Vault) =====
const DB_NAME = "oralGradesDB_secure_v9";
const DB_VERSION = 1;

function toB64(ab){ return btoa(String.fromCharCode(...new Uint8Array(ab))); }
function fromB64(b64){ const bin=atob(b64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); return u8.buffer; }
function randBytes(n){ const a=new Uint8Array(n); crypto.getRandomValues(a); return a; }

async function pbkdf2Key(pass, saltBytes){
  const enc=new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt: saltBytes, iterations: 250000, hash:"SHA-256" },
    baseKey,
    { name:"AES-GCM", length:256 },
    true, ["encrypt","decrypt"]
  );
}
async function aesGcmEncrypt(key, dataObj){
  const iv = randBytes(12);
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(dataObj));
  const ct = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, data);
  return { iv: btoa(String.fromCharCode(...iv)), data: btoa(String.fromCharCode(...new Uint8Array(ct))) };
}
async function aesGcmDecrypt(key, payload){
  const iv = new Uint8Array(atob(payload.iv).split("").map(c=>c.charCodeAt(0)));
  const ct = new Uint8Array(atob(payload.data).split("").map(c=>c.charCodeAt(0)));
  const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
async function importRawAesKey(bytes){ return crypto.subtle.importKey("raw", bytes, "AES-GCM", true, ["encrypt","decrypt"]); }

// IDB helpers
function openDB(){
  return new Promise((res, rej)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if (!db.objectStoreNames.contains("users")){
        const s = db.createObjectStore("users", { keyPath:"id" });
        s.createIndex("by_username","username",{unique:true});
      }
      if (!db.objectStoreNames.contains("vault")){
        const v = db.createObjectStore("vault", { keyPath:"id" });
        v.createIndex("by_user","userId");
      }
    };
    req.onerror = ()=> rej(req.error);
    req.onsuccess = ()=> res(req.result);
  });
}
function os(db, store, mode="readonly"){ return db.transaction(store, mode).objectStore(store); }
function dbGetByIndex(db, store, index, key){
  return new Promise((res, rej)=>{
    const req = os(db, store).index(index).get(key);
    req.onsuccess = ()=> res(req.result || null);
    req.onerror = ()=> rej(req.error);
  });
}
function dbGetAllByUser(db, store, userId){
  return new Promise((res, rej)=>{
    const idx = os(db, store).index("by_user");
    const req = idx.openCursor(IDBKeyRange.only(userId));
    const out=[]; req.onsuccess = e=>{ const c=e.target.result; if (c){ out.push(c.value); c.continue(); } else res(out); };
    req.onerror = ()=> rej(req.error);
  });
}
function dbPut(db, store, val){ return new Promise((res, rej)=>{ const r=os(db,store,"readwrite").put(val); r.onsuccess=()=>res(val); r.onerror=()=>rej(r.error); }); }
function dbAdd(db, store, val){ return new Promise((res, rej)=>{ const r=os(db,store,"readwrite").add(val); r.onsuccess=()=>res(val); r.onerror=()=>rej(r.error); }); }
function dbDelete(db, store, key){ return new Promise((res, rej)=>{ const r=os(db,store,"readwrite").delete(key); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }

// ===== Session/State =====
const elAuth = document.getElementById("view-auth");
const appHeader = document.getElementById("appHeader");
const appMain = document.getElementById("appMain");
const appTitle = document.getElementById("appTitle");

const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const rememberUser = document.getElementById("rememberUser");
const registerForm = document.getElementById("registerForm");
const regUser = document.getElementById("regUser");
const regPass = document.getElementById("regPass");
const logoutBtn = document.getElementById("logoutBtn");

const tabs = document.querySelectorAll(".tab-btn");
const views = document.querySelectorAll(".view");
const themeToggle = document.getElementById("themeToggle");
const todayDisplay = document.getElementById("todayDisplay");

const classSelectRecord = document.getElementById("classSelectRecord");
const studentList = document.getElementById("studentList");
const hintNoClass = document.getElementById("hintNoClass");
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");
const btnH1 = document.getElementById("btnH1");
const btnH2 = document.getElementById("btnH2");
const sortModeSel = document.getElementById("sortMode");

const formGlobalYear = document.getElementById("formGlobalYear");
const globalYearStart = document.getElementById("globalYearStart");
const globalH2Start = document.getElementById("globalH2Start");
const globalYearEnd = document.getElementById("globalYearEnd");

const formClass = document.getElementById("formClass");
const classNameEl = document.getElementById("className");
const classSubject = document.getElementById("classSubject");
const classTeacher = document.getElementById("classTeacher");
const yearStartEl = document.getElementById("yearStart");
const h2StartEl = document.getElementById("h2Start");
const yearEndEl = document.getElementById("yearEnd");
const studentNames = document.getElementById("studentNames");
const csvImportCreate = document.getElementById("csvImportCreate");
const btnCsvImportCreate = document.getElementById("btnCsvImportCreate");
const classList = document.getElementById("classList");

const classSelectOverview = document.getElementById("classSelectOverview");
const studentSelectOverview = document.getElementById("studentSelectOverview");
const overviewFrom = document.getElementById("overviewFrom");
const overviewTo = document.getElementById("overviewTo");
const btnH1Overview = document.getElementById("btnH1Overview");
const btnH2Overview = document.getElementById("btnH2Overview");
const overviewTableBody = document.getElementById("overviewTableBody");
const overviewStats = document.getElementById("overviewStats");
const overviewHighlight = document.getElementById("overviewHighlight");

const classSelectSeating = document.getElementById("classSelectSeating");
const roomNameInput = document.getElementById("roomNameInput");
const seatingPreset = document.getElementById("seatingPreset");
const seatingRows = document.getElementById("seatingRows");
const seatingCols = document.getElementById("seatingCols");
const seatingAisles = document.getElementById("seatingAisles");
const btnBuildGrid = document.getElementById("btnBuildGrid");
const btnClearSeating = document.getElementById("btnClearSeating");
const btnExportPDFSeating = document.getElementById("btnExportPDFSeating");
const seatingPalette = document.getElementById("seatingPalette");
const seatingGrid = document.getElementById("seatingGrid");

const popover = document.getElementById("gradePopover");
const popoverStudent = document.getElementById("popoverStudent");
const popoverCancel = document.getElementById("popoverCancel");
const toastEl = document.getElementById("toast");

// In-Memory
let db = null, dataKey = null, currentUser = null;
let state = { settings:null, classes:[], students:[], entries:[] };
let currentClassId = null;
let seatingSelectedStudentId = null;
let popoverTarget = null;

// ===== Utils =====
function uid(prefix="id"){ return `${prefix}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36)}`; }
function splitName(name){ const p=name.trim().split(/\s+/); if (p.length===1) return {first:p[0], last:p[0]}; return {first:p.slice(0,-1).join(" "), last:p[p.length-1]}; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function todayLocal(){ return new Date().toLocaleDateString("de-DE", {weekday:"short", year:"numeric", month:"2-digit", day:"2-digit"}); }
function dateMinusOne(iso){ const d=new Date(iso); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function within(d,f,t){ if(!f && !t) return true; if(f && d<f) return false; if(t && d>t) return false; return true; }
function mean(a){ if(!a||a.length===0) return null; return a.reduce((s,x)=>s+x,0)/a.length; }
function fmt1(x){ return x==null ? "—" : (Math.round(x*10)/10).toFixed(1).replace(".",","); }
function defaultGlobalYear(){ const now=new Date(); const y = now.getMonth()>=7 ? now.getFullYear() : now.getFullYear()-1; return { yearStart:`${y}-08-01`, h2Start:`${y+1}-02-01`, yearEnd:`${y+1}-07-31` }; }
function classSemesterRanges(cls){ const gy=state.settings?.globalYear || defaultGlobalYear(); const from1=cls?.yearStart||gy.yearStart; const from2=cls?.h2Start||gy.h2Start; const end=cls?.yearEnd||gy.yearEnd; return { h1:{from:from1,to:dateMinusOne(from2)}, h2:{from:from2,to:end} }; }
function pickCurrentSemesterRange(cls){ const t=todayISO(); const {h1,h2}=classSemesterRanges(cls); return (t>=h2.from && t<=h2.to)?h2:h1; }
function escapeHtml(s){ return String(s??"").replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Durchschnitt → Farbklasse (alle Ansichten)
function gradeClass(avg){
  if (avg==null || Math.abs(avg-4) < 0.051) return "grade-neutral";
  if (avg<=2) return "grade-a";
  if (avg<=3) return "grade-b";
  if (avg<4) return "grade-c";
  if (avg<=5) return "grade-d";
  return "grade-e";
}

// ===== Auth =====
async function register(username, password){
  const exists = await dbGetByIndex(db,"users","by_username",username);
  if (exists) throw new Error("Benutzername bereits vergeben.");
  const id = uid("usr");
  const salt = randBytes(16);
  const passHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${toB64(salt)}:${password}`));
  const kdfKey = await pbkdf2Key(password, salt);
  const rawDataKey = randBytes(32);
  const wrapped = await aesGcmEncrypt(kdfKey, { key: toB64(rawDataKey) });
  const user = { id, username, salt: toB64(salt), passHash: toB64(passHash), encDataKey: wrapped.data, keyIv: wrapped.iv, createdAt: new Date().toISOString() };
  await dbAdd(db, "users", user);
  const dk = await importRawAesKey(rawDataKey);
  await saveEncrypted("settings", { userId:id, theme:"light", sortModeByClass:{}, globalYear: defaultGlobalYear() }, id, dk);
}
async function login(username, password){
  const user = await dbGetByIndex(db,"users","by_username",username);
  if (!user) throw new Error("Unbekannter Benutzer.");
  const passHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${user.salt}:${password}`));
  if (toB64(passHash) !== user.passHash) throw new Error("Falsches Passwort.");
  const kdfKey = await pbkdf2Key(password, fromB64(user.salt));
  const raw = await aesGcmDecrypt(kdfKey, { iv:user.keyIv, data:user.encDataKey });
  dataKey = await importRawAesKey(fromB64(raw.key));
  currentUser = { id:user.id, username:user.username };
}
async function saveEncrypted(kind, obj, id, overrideKey=null){
  const key = overrideKey || dataKey;
  const payload = { ...obj, id: id || obj.id || uid(kind) };
  const enc = await aesGcmEncrypt(key, payload);
  const item = { id: payload.id, userId: payload.userId || currentUser.id, kind, iv: enc.iv, data: enc.data };
  await dbPut(db, "vault", item);
  return payload.id;
}
async function deleteEncrypted(id){ await dbDelete(db, "vault", id); }
async function loadAllDecrypted(){
  const items = await dbGetAllByUser(db, "vault", currentUser.id);
  const out = { settings:null, classes:[], students:[], entries:[] };
  for (const it of items){
    const obj = await aesGcmDecrypt(dataKey, { iv: it.iv, data: it.data });
    if (it.kind==="settings") out.settings = obj;
    else if (it.kind==="class") out.classes.push(obj);
    else if (it.kind==="student") out.students.push(obj);
    else if (it.kind==="entry") out.entries.push(obj);
  }
  state = out;
  if (!state.settings) state.settings = { userId: currentUser.id, theme:"light", sortModeByClass:{}, globalYear: defaultGlobalYear(), id: uid("set") };
}

// ===== UI Boot =====
todayDisplay.textContent = todayLocal();
function applyTheme(){ document.body.setAttribute("data-theme", state.settings?.theme || "light"); }
document.getElementById("themeToggle").addEventListener("click", async ()=>{
  state.settings.theme = (state.settings.theme==="dark") ? "light" : "dark";
  await saveEncrypted("settings", state.settings, state.settings.id);
  applyTheme();
});
logoutBtn.addEventListener("click", ()=>{
  currentUser=null; dataKey=null; state={settings:null,classes:[],students:[],entries:[]};
  appHeader.classList.add("hidden"); appMain.classList.add("hidden"); elAuth.classList.remove("hidden");
});

// Remember username
(function(){ const u = localStorage.getItem("oralGrades.remember.username"); if (u){ loginUser.value=u; rememberUser.checked=true; } })();
registerForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  try{
    await register(regUser.value.trim(), regPass.value);
    showToast("Benutzer angelegt. Bitte anmelden.");
    regUser.value=""; regPass.value="";
  }catch(err){ showToast(err.message || "Registrierung fehlgeschlagen."); }
});
loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  try{
    await login(loginUser.value.trim(), loginPass.value);
    if (rememberUser.checked) localStorage.setItem("oralGrades.remember.username", loginUser.value.trim());
    else localStorage.removeItem("oralGrades.remember.username");
    await loadAllDecrypted();
    elAuth.classList.add("hidden"); appHeader.classList.remove("hidden"); appMain.classList.remove("hidden");
    initAfterLogin();
  }catch(err){ showToast(err.message || "Login fehlgeschlagen."); }
});

// ===== Domain helpers =====
function getClasses(){ return state.classes; }
function getClass(id){ return state.classes.find(c=>c.id===id); }
function getStudentsByClass(classId){ return state.students.filter(s=>s.classId===classId).sort((a,b)=>(a.sortIndex||0)-(b.sortIndex||0)); }
function getStudentName(id){ return state.students.find(s=>s.id===id)?.name ?? "—"; }
function getClassName(id){ return getClass(id)?.name ?? "—"; }
function getSeating(classId){
  const c=getClass(classId); if (!c) return {rows:5,cols:6,preset:"free",disabled:[],roomName:"",cells:{}, aisles:[]};
  c.seating = c.seating || { rows:5, cols:6, preset:"free", disabled:[], roomName:"", cells:{}, aisles:[] };
  c.seating.aisles ||= [];
  return c.seating;
}
async function updateEncrypted(kind, obj){ await saveEncrypted(kind, obj, obj.id); }

// ===== Titel je aktiver Ansicht =====
function updateAppTitle(){
  const activeId = document.querySelector(".view.active")?.id || "view-erfassen";
  const nameRecord = getClassName(currentClassId) || "—";
  const nameOverview = getClassName(classSelectOverview.value) || nameRecord;
  const nameSeating = getClassName(classSelectSeating.value) || nameRecord;

  if (activeId === "view-verwaltung") {
    appTitle.textContent = "Verwaltung";
  } else if (activeId === "view-uebersicht") {
    appTitle.textContent = `Übersicht der Klasse ${nameOverview}`;
  } else if (activeId === "view-sitzplan") {
    appTitle.textContent = `Sitzplan der Klasse ${nameSeating}`;
  } else {
    appTitle.textContent = `Mündliche Noten der Klasse ${nameRecord}`;
  }
}

// ===== Routing =====
function showView(sel){
  views.forEach(v=>v.classList.remove("active"));
  document.querySelector(sel)?.classList.add("active");
  tabs.forEach(t=>t.setAttribute("aria-selected", String(t.dataset.view===sel)));
  if (sel==="#view-erfassen"){
    populateClassSelects(); setDefaultDatesForRecord(); initDefaultSortModeForClass(); renderStudentList(); highlightSemesterButtons();
  } else if (sel==="#view-uebersicht"){
    populateClassSelects(); setDefaultDatesForOverview(); renderOverview(); highlightSemesterButtons(true);
  } else if (sel==="#view-sitzplan"){
    populateClassSelects(); classSelectSeating.value=currentClassId||classSelectSeating.value; renderSeatingControlsFromClass(); renderSeating();
  } else if (sel==="#view-verwaltung"){
    renderGlobalYearForm(); renderClassList();
  }
  updateAppTitle();
}
tabs.forEach(btn=> btn.addEventListener("click", ()=> showView(btn.dataset.view)));

// ===== Populate selects =====
function populateClassSelects(){
  const classes=getClasses();
  const fills=[classSelectRecord,classSelectOverview,classSelectSeating];
  for (const sel of fills){
    sel.innerHTML=""; if (classes.length===0){ const o=document.createElement("option"); o.value=""; o.textContent="— keine —"; sel.appendChild(o); continue; }
    for (const c of classes){ const o=document.createElement("option"); o.value=c.id; o.textContent=`${c.name} · ${c.subject||"Fach"} (${c.teacher||"—"})`; sel.appendChild(o); }
  }
  if (classes.length>0){
    if (!currentClassId || !classes.some(c=>c.id===currentClassId)) currentClassId = classes[0].id;
    classSelectRecord.value=currentClassId; classSelectOverview.value=currentClassId; classSelectSeating.value=currentClassId;
    populateStudentSelectOverview();
  } else { currentClassId=null; populateStudentSelectOverview(); }
  updateAppTitle();
}
function populateStudentSelectOverview(){
  const classId=classSelectOverview.value;
  studentSelectOverview.innerHTML = `<option value="">— alle —</option>`;
  if (!classId) return;
  for (const s of getStudentsByClass(classId)){ const o=document.createElement("option"); o.value=s.id; o.textContent=s.name; studentSelectOverview.appendChild(o); }
}

// ===== Dates & Semesters =====
function setDefaultDatesForRecord(){ const r=pickCurrentSemesterRange(getClass(currentClassId)); dateFrom.value=r.from; dateTo.value=r.to; }
function setDefaultDatesForOverview(){ const r=pickCurrentSemesterRange(getClass(classSelectOverview.value)); overviewFrom.value=r.from; overviewTo.value=r.to; }
function highlightSemesterButtons(forOverview=false){
  const cls = forOverview ? getClass(classSelectOverview.value) : getClass(currentClassId);
  const {h1,h2} = classSemesterRanges(cls);
  function isMatch(f,t,r){ return f===r.from && t===r.to; }
  if (!forOverview){
    btnH1.classList.toggle("sem-active", isMatch(dateFrom.value,dateTo.value,h1));
    btnH2.classList.toggle("sem-active", isMatch(dateFrom.value,dateTo.value,h2));
  } else {
    btnH1Overview.classList.toggle("sem-active", isMatch(overviewFrom.value,overviewTo.value,h1));
    btnH2Overview.classList.toggle("sem-active", isMatch(overviewFrom.value,overviewTo.value,h2));
  }
}

// ===== Sorting =====
function sortBySeating(classId, students){
  const seat=getSeating(classId);
  const order=[]; const seen=new Set();
  for (let r=0;r<seat.rows;r++){ for(let c=0;c<seat.cols;c++){ const id=seat.cells[`${r}-${c}`]; if (id){ order.push(id); seen.add(id); } } }
  const placed=students.filter(s=>seen.has(s.id)); const unplaced=students.filter(s=>!seen.has(s.id));
  const coll=new Intl.Collator("de",{sensitivity:"base"});
  unplaced.sort((a,b)=>{ const A=splitName(a.name),B=splitName(b.name); const ln=coll.compare(A.last,B.last); return ln!==0?ln:coll.compare(A.first,B.first); });
  const byId=new Map(students.map(s=>[s.id,s])); return order.map(id=>byId.get(id)).filter(Boolean).concat(unplaced);
}
function sortStudentsForDisplay(studs, mode){
  const coll=new Intl.Collator("de",{sensitivity:"base"});
  if (mode==="lastname") return studs.slice().sort((a,b)=>{ const A=splitName(a.name),B=splitName(b.name); const ln=coll.compare(A.last,B.last); return ln!==0?ln:coll.compare(A.first,B.first); });
  if (mode==="firstname") return studs.slice().sort((a,b)=>{ const A=splitName(a.name),B=splitName(b.name); const fn=coll.compare(A.first,B.first); return fn!==0?fn:coll.compare(A.last,B.last); });
  return sortBySeating(currentClassId, studs);
}

// ===== Erfassen =====
function averageForStudentInRange(studentId, from, to){
  const vals = state.entries.filter(e=>e.studentId===studentId && within(e.date,from,to)).map(e=>e.value);
  return mean(vals);
}
function attachGradePopover(anchorEl, studentId){
  const rect = anchorEl.getBoundingClientRect();
  popoverStudent.textContent = `Bewertung: ${getStudentName(studentId)}`;
  const px = Math.min(rect.left, window.innerWidth-360);
  const py = Math.min(rect.bottom+8, window.innerHeight-240);
  popover.style.paddingLeft = `${px}px`;
  popover.style.paddingTop = `${py}px`;
  popover.classList.remove("hidden");
  popoverTarget = { studentId };
}
function hidePopover(){ popover.classList.add("hidden"); popoverTarget=null; }
popover.addEventListener("click", (e)=>{ if (e.target===popover) hidePopover(); });
document.addEventListener("keydown", (e)=>{ if (e.key==="Escape") hidePopover(); });
popoverCancel.addEventListener("click", hidePopover);
popover.querySelectorAll(".grade-btn").forEach(btn=>{
  btn.addEventListener("click", async (e)=>{
    e.preventDefault(); if (!popoverTarget) return;
    const raw = btn.dataset.symbol; const symbol = NORM_SYMBOL(raw);
    const entry = { id: uid("ent"), userId: currentUser.id, classId: currentClassId, studentId: popoverTarget.studentId, date: todayISO(), symbol, value: SYMBOL_TO_VALUE[symbol] };
    await saveEncrypted("entry", entry, entry.id);
    state.entries.push(entry);
    hidePopover(); showToast(`Gespeichert: ${getStudentName(entry.studentId)} → ${raw} (${entry.value})`);
    renderStudentList(); renderOverviewIfActive();
  });
});

function renderStudentList(){
  studentList.innerHTML=""; if (!currentClassId){ hintNoClass.classList.remove("hidden"); return; }
  hintNoClass.classList.add("hidden");
  const studs=getStudentsByClass(currentClassId);
  const mode=sortModeSel.value||"lastname";
  const from=dateFrom.value||null, to=dateTo.value||null;

  if (mode!=="seating"){
    studentList.className="cards";
    for (const s of sortStudentsForDisplay(studs, mode)){
      const avg = averageForStudentInRange(s.id, from, to);
      const label = nearestGradeLabel(avg);
      const card = document.createElement("button");
      card.className = `student-card ${gradeClass(avg)}`; card.type="button";
      card.innerHTML = `<span class="student-name">${escapeHtml(s.name)}</span>
                        <span><span class="avg">${label}</span><span class="avg-num">(${fmt1(avg)})</span></span>`;
      card.addEventListener("click", ()=> attachGradePopover(card, s.id));
      studentList.appendChild(card);
    }
  } else {
    // Sitzplan-Erfassung (farbig nach Durchschnitt; Gänge/Zeilen exakt 32px)
    const seat = getSeating(currentClassId);
    const disabledSet = new Set(seat.disabled||[]);
    const grid = document.createElement("div");
    grid.className = "capture-seating";
    grid.style.gridTemplateColumns = `repeat(${seat.cols}, var(--cell))`;
    grid.style.rowGap = `var(--aisle)`; // Zeilenabstand immer 32px

    const aisles = new Set((seat.aisles||[]).map(n=>parseInt(n,10)).filter(n=>Number.isFinite(n)));

    const resize = ()=>{
      const wrap = studentList.getBoundingClientRect();
      const baseGap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--base-gap')) || 8;
      const aisle = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--aisle')) || 32;
      const totalAisleExtra = aisles.size * Math.max(0, aisle - baseGap);
      const totalGapX = baseGap * (seat.cols - 1) + totalAisleExtra;
      const totalGapY = (seat.rows - 1) * aisle;
      const maxW = Math.max(60, Math.floor((wrap.width - totalGapX) / seat.cols));
      const maxH = Math.max(60, Math.floor((window.innerHeight - 240 - totalGapY) / seat.rows));
      const cell = Math.max(56, Math.min(maxW, maxH));
      grid.style.setProperty("--cell", `${cell}px`);
    };

    for(let r=0;r<seat.rows;r++){
      for(let c=0;c<seat.cols;c++){
        const key = `${r}-${c}`;
        const cell = document.createElement("div");
        cell.className = "cap-cell";
        if (disabledSet.has(key)) cell.classList.add("cap-disabled");
        if (aisles.has(c+1)) {
          const baseGap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--base-gap')) || 8;
          const extra = Math.max(0, 32 - baseGap);
          cell.style.marginRight = `${extra}px`;
        }
        const sid = seat.cells[key];
        if (sid){
          const avg = averageForStudentInRange(sid, from, to);
          const label = nearestGradeLabel(avg);
          const btn = document.createElement("button");
          btn.className = `cap-btn ${gradeClass(avg)}`; btn.type="button";
          btn.innerHTML = `<div class="student-name">${escapeHtml(getStudentName(sid))}</div>
                           <div><span class="avg">${label}</span><span class="avg-num">(${fmt1(avg)})</span></div>`;
          btn.addEventListener("click", ()=> attachGradePopover(btn, sid));
          cell.classList.add("cap-occupied");
          cell.appendChild(btn);
        }
        grid.appendChild(cell);
      }
    }
    studentList.className=""; studentList.appendChild(grid);
    resize(); window.addEventListener("resize", resize, { passive:true });
  }

  state.settings.sortModeByClass = state.settings.sortModeByClass || {};
  state.settings.sortModeByClass[currentClassId] = mode;
  saveEncrypted("settings", state.settings, state.settings.id);
  updateAppTitle();
}

// ===== Verwaltung – Global Year =====
function renderGlobalYearForm(){
  const gy=state.settings.globalYear || defaultGlobalYear();
  globalYearStart.value=gy.yearStart; globalH2Start.value=gy.h2Start; globalYearEnd.value=gy.yearEnd;
  yearStartEl.value=gy.yearStart; h2StartEl.value=gy.h2Start; yearEndEl.value=gy.yearEnd;
}
formGlobalYear.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const y1=globalYearStart.value, y2=globalH2Start.value, y3=globalYearEnd.value;
  if (!(y1 && y2 && y3 && y1<=y2 && y2<=y3)){ showToast("Zeiträume prüfen."); return; }
  state.settings.globalYear = { yearStart:y1, h2Start:y2, yearEnd:y3 };
  for (const c of state.classes){ c.yearStart=y1; c.h2Start=y2; c.yearEnd=y3; await updateEncrypted("class", c); }
  await saveEncrypted("settings", state.settings, state.settings.id);
  showToast("Schuljahresdaten übernommen."); setDefaultDatesForRecord(); setDefaultDatesForOverview(); renderStudentList(); renderOverviewIfActive();
});

// ===== Verwaltung – Klasse anlegen =====
btnCsvImportCreate.addEventListener("click", ()=> csvImportCreate.click());
csvImportCreate.addEventListener("change", async ()=>{
  const f=csvImportCreate.files?.[0]; if (!f) return;
  const text = await f.text();
  const names = parseNamesFromCSV(text);
  if (names.length===0){ showToast("Keine Namen in CSV gefunden."); return; }
  studentNames.value = names.join("\n");
  showToast(`${names.length} Namen übernommen.`);
  csvImportCreate.value="";
});
formClass.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name=classNameEl.value.trim(), subject=classSubject.value.trim(), teacher=classTeacher.value.trim();
  const y1=yearStartEl.value, y2=h2StartEl.value, y3=yearEndEl.value;
  if (!name || !subject || !y1 || !y2 || !y3){ showToast("Bitte Pflichtfelder ausfüllen."); return; }
  if (!(y1<=y2 && y2<=y3)){ showToast("Zeiträume prüfen."); return; }
  const cls = { id: uid("cls"), userId: currentUser.id, name, subject, teacher, yearStart:y1, h2Start:y2, yearEnd:y3, createdAt:new Date().toISOString(),
    seating:{ rows:5, cols:6, preset:"free", disabled:[], roomName:"", cells:{}, aisles:[] } };
  await saveEncrypted("class", cls, cls.id);
  state.classes.push(cls);
  let i=1; for (const nm of studentNames.value.split("\n").map(s=>s.trim()).filter(Boolean)){
    const st = { id: uid("stu"), userId: currentUser.id, classId: cls.id, name:nm, sortIndex:i++ };
    await saveEncrypted("student", st, st.id); state.students.push(st);
  }
  currentClassId = cls.id;
  formClass.reset(); renderGlobalYearForm();
  showToast("Klasse gespeichert."); populateClassSelects(); renderClassList(); setDefaultDatesForRecord(); initDefaultSortModeForClass(); renderStudentList(); renderOverviewIfActive();
});

function renderStudentAdminRows(classId){
  const classes=getClasses(); const studs=getStudentsByClass(classId);
  if (studs.length===0) return `<div class="hint">Noch keine Schüler in dieser Klasse.</div>`;
  return studs.map((s, idx)=>{
    const moveSel = `<select class="select-move" data-move-for="${s.id}">
      ${classes.map(c=> `<option value="${c.id}" ${c.id===classId?"selected":""}>${c.name} · ${c.subject||""}</option>`).join("")}
    </select>`;
    return `
      <div class="student-admin-row" style="display:grid;grid-template-columns:1fr auto auto auto;gap:.5rem;align-items:center;">
        <input type="text" value="${escapeHtml(s.name)}" data-student-name data-student-id="${s.id}" data-class-id="${classId}" />
        <div class="inline-actions">
          <button class="secondary small" data-stu-action="up" data-student-id="${s.id}" data-class-id="${classId}" ${idx===0?"disabled":""}>▲</button>
          <button class="secondary small" data-stu-action="down" data-student-id="${s.id}" data-class-id="${classId}" ${idx===studs.length-1?"disabled":""}>▼</button>
        </div>
        <div class="inline-actions">${moveSel}
          <button class="secondary small" data-stu-action="move" data-student-id="${s.id}" data-class-id="${classId}">Versetzen</button>
        </div>
        <div class="inline-actions">
          <button class="danger small" data-stu-action="delete" data-student-id="${s.id}" data-class-id="${classId}">Löschen</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderClassList(){
  classList.innerHTML=""; const classes=getClasses();
  if (classes.length===0){ classList.innerHTML=`<div class="hint">Noch keine Klassen vorhanden.</div>`; return; }
  for (const c of classes){
    const cnt=getStudentsByClass(c.id).length;
    const wrap=document.createElement("div"); wrap.className="list-item";
    wrap.innerHTML = `
      <div class="list-row">
        <div><strong>${escapeHtml(c.name)}</strong> · <span>${escapeHtml(c.subject||"—")}</span> · <span class="muted">${escapeHtml(c.teacher||"—")}</span> <span class="badge">${cnt} Schüler</span></div>
        <div class="actions">
          <button class="secondary small" data-action="export-csv" data-id="${c.id}">Export CSV</button>
          <button class="secondary small" data-action="export-pdf" data-id="${c.id}">Export PDF</button>
          <button class="primary small" data-action="edit" data-id="${c.id}">Bearbeiten</button>
          <button class="danger small" data-action="delete" data-id="${c.id}">Löschen</button>
        </div>
      </div>
      <div class="edit-panel hidden" id="edit_${c.id}">
        <div class="grid grid-class">
          <label>Klassenname <input type="text" value="${escapeHtml(c.name)}" data-edit="name"></label>
          <label>Fach <input type="text" value="${escapeHtml(c.subject??"")}" data-edit="subject"></label>
          <label>Klassenlehrkraft <input type="text" value="${escapeHtml(c.teacher??"")}" data-edit="teacher"></label>
          <label>Schuljahresbeginn <input type="date" value="${c.yearStart}" data-edit="yearStart"></label>
          <label>Beginn 2. Halbjahr <input type="date" value="${c.h2Start}" data-edit="h2Start"></label>
          <label>Schuljahresende <input type="date" value="${c.yearEnd}" data-edit="yearEnd"></label>
        </div>
        <div class="actions"><button class="primary small" data-action="save-class" data-id="${c.id}">Stammdaten speichern</button></div>
        <h4>Schüler verwalten</h4>
        <div class="actions">
          <input type="text" placeholder="Neuer Schülername" data-add-name="${c.id}">
          <button class="secondary small" data-action="add-student" data-id="${c.id}">Hinzufügen</button>
          <input type="file" accept=".csv,text/csv" data-file-for="${c.id}" class="hidden" />
          <button class="secondary small" data-action="import-csv" data-id="${c.id}">CSV importieren</button>
        </div>
        <div class="student-admin" id="students_${c.id}">
          ${renderStudentAdminRows(c.id)}
        </div>
      </div>
    `;
    classList.appendChild(wrap);
  }
  // Handlers
  classList.querySelectorAll("button[data-action='edit']").forEach(b=> b.addEventListener("click", ()=> document.getElementById(`edit_${b.dataset.id}`).classList.toggle("hidden")));
  classList.querySelectorAll("button[data-action='delete']").forEach(b=> b.addEventListener("click", async ()=>{
    const id=b.dataset.id; if (!confirm("Klasse wirklich löschen?")) return;
    for (const e of state.entries.filter(e=>e.classId===id)) await deleteEncrypted(e.id);
    for (const s of state.students.filter(s=>s.classId===id)) await deleteEncrypted(s.id);
    await deleteEncrypted(id);
    state.entries = state.entries.filter(e=>e.classId!==id);
    state.students = state.students.filter(s=>s.classId!==id);
    state.classes = state.classes.filter(c=>c.id!==id);
    if (currentClassId===id) currentClassId=null;
    populateClassSelects(); renderClassList(); renderStudentList(); renderOverviewIfActive();
  }));
  classList.querySelectorAll("button[data-action='save-class']").forEach(b=> b.addEventListener("click", async ()=>{
    const id=b.dataset.id; const panel=document.getElementById(`edit_${id}`); const inputs=panel.querySelectorAll("[data-edit]");
    const patch={}; inputs.forEach(inp=> patch[inp.dataset.edit]=inp.value);
    if (!(patch.yearStart<=patch.h2Start && patch.h2Start<=patch.yearEnd)){ showToast("Zeiträume prüfen."); return; }
    const cls=getClass(id); Object.assign(cls, patch); await updateEncrypted("class", cls);
    showToast("Klassenstammdaten gespeichert."); populateClassSelects(); renderClassList();
    if (currentClassId===id){ setDefaultDatesForRecord(); setDefaultDatesForOverview(); renderStudentList(); renderOverviewIfActive(); }
  }));
  classList.querySelectorAll("button[data-action='add-student']").forEach(b=> b.addEventListener("click", async ()=>{
    const classId=b.dataset.id; const nameInput = classList.querySelector(`[data-add-name='${classId}']`);
    const nm=nameInput.value.trim(); if (!nm){ showToast("Bitte Namen eingeben."); return; }
    const studs=getStudentsByClass(classId); const max=studs.reduce((m,s)=>Math.max(m,s.sortIndex||0),0);
    const st={ id:uid("stu"), userId: currentUser.id, classId, name:nm, sortIndex:max+1 };
    await saveEncrypted("student", st, st.id); state.students.push(st);
    nameInput.value=""; document.getElementById(`students_${classId}`).innerHTML=renderStudentAdminRows(classId);
    populateClassSelects(); if (currentClassId===classId) renderStudentList();
  }));
  classList.querySelectorAll("button[data-action='import-csv']").forEach(b=> b.addEventListener("click", ()=>{
    const classId=b.dataset.id; const input=classList.querySelector(`input[type='file'][data-file-for='${classId}']`);
    input.onchange = async ()=>{
      const file=input.files?.[0]; if (!file) return;
      const txt=await file.text(); const names=parseNamesFromCSV(txt);
      let added=0; for (const nm of names){ if (nm.trim()){ const studs=getStudentsByClass(classId); const max=studs.reduce((m,s)=>Math.max(m,s.sortIndex||0),0);
        const st={ id:uid("stu"), userId: currentUser.id, classId, name:nm.trim(), sortIndex:max+1+added };
        await saveEncrypted("student", st, st.id); state.students.push(st); added++; } }
      document.getElementById(`students_${classId}`).innerHTML=renderStudentAdminRows(classId);
      populateClassSelects(); if (currentClassId===classId) renderStudentList();
      showToast(`${added} Schüler importiert.`); input.value="";
    };
    input.click();
  }));
  classList.querySelectorAll(".student-admin").forEach(container=>{
    container.addEventListener("click", async (ev)=>{
      const btn=ev.target.closest("button[data-stu-action]"); if (!btn) return;
      const action=btn.dataset.stuAction, sid=btn.dataset.studentId, classId=btn.dataset.classId;
      if (action==="up"||action==="down"){
        const studs=getStudentsByClass(classId); const idx=studs.findIndex(s=>s.id===sid);
        const swap=action==="up"? idx-1 : idx+1; if (swap<0||swap>=studs.length) return;
        const a=studs[idx], b=studs[swap]; const t=a.sortIndex; a.sortIndex=b.sortIndex; b.sortIndex=t; await updateEncrypted("student", a); await updateEncrypted("student", b);
        container.innerHTML=renderStudentAdminRows(classId); if (currentClassId===classId && sortModeSel.value==="seating") renderStudentList();
      } else if (action==="delete"){
        if (!confirm("Schüler wirklich löschen?")) return;
        for (const e of state.entries.filter(e=>e.studentId===sid)) await deleteEncrypted(e.id);
        for (const c of state.classes){ if (c.seating?.cells){ for (const k of Object.keys(c.seating.cells)) if (c.seating.cells[k]===sid) delete c.seating.cells[k]; await updateEncrypted("class", c); } }
        await deleteEncrypted(sid); state.entries=state.entries.filter(e=>e.studentId!==sid); state.students=state.students.filter(s=>s.id!==sid);
        container.innerHTML=renderStudentAdminRows(classId); populateClassSelects(); if (currentClassId===classId){ renderStudentList(); renderOverviewIfActive(); renderSeatingIfForClass(classId); }
      } else if (action==="move"){
        const select=container.querySelector(`select[data-move-for='${sid}']`); const target=select?.value;
        if (target && target!==classId){
          const s=state.students.find(x=>x.id===sid); const max=getStudentsByClass(target).reduce((m,st)=>Math.max(m, st.sortIndex||0),0);
          const oldC=getClass(s.classId); if (oldC?.seating?.cells){ for (const k of Object.keys(oldC.seating.cells)) if (oldC.seating.cells[k]===sid) delete oldC.seating.cells[k]; await updateEncrypted("class", oldC); }
          s.classId=target; s.sortIndex=max+1; await updateEncrypted("student", s);
          renderClassList(); populateClassSelects(); if (currentClassId===classId||currentClassId===target) renderStudentList();
          renderOverviewIfActive(); renderSeatingIfForClass(classId); renderSeatingIfForClass(target); showToast("Schüler versetzt.");
        }
      }
    });
    container.addEventListener("change", async (ev)=>{
      const inp=ev.target.closest("input[data-student-name]"); if (!inp) return;
      const s=state.students.find(x=>x.id===inp.dataset.studentId); if (!s) return; s.name=inp.value.trim(); await updateEncrypted("student", s);
      if (currentClassId===inp.dataset.classId) renderStudentList();
      if (classSelectSeating.value===inp.dataset.classId) renderSeatingPalette();
    });
  });
  // Exporte
  classList.querySelectorAll("button[data-action='export-csv']").forEach(b=> b.addEventListener("click", ()=> exportClassCSVReport(b.dataset.id)));
  classList.querySelectorAll("button[data-action='export-pdf']").forEach(b=> b.addEventListener("click", ()=> exportClassPDFReport(b.dataset.id)));
}

function parseNamesFromCSV(text){
  return text.split(/\r?\n/).map(line=> line.split(/[;,]/).map(s=>s.trim()).filter(Boolean)[0] || "").filter(Boolean);
}

// ===== Übersicht =====
function getEntriesFiltered({classId, studentId=null, from=null, to=null}){
  return state.entries
    .filter(e=>e.classId===classId && (!studentId || e.studentId===studentId))
    .filter(e=>within(e.date,from,to))
    .sort((a,b)=> a.date.localeCompare(b.date));
}
function renderOverview(){
  overviewTableBody.innerHTML="";
  overviewHighlight.classList.add("hidden");
  const classId = classSelectOverview.value; if (!classId){ overviewStats.textContent="Keine Klasse ausgewählt."; return; }
  const studId = studentSelectOverview.value || null; const from=overviewFrom.value||null, to=overviewTo.value||null;
  const clsName = getClassName(classId);

  for (const e of getEntriesFiltered({classId, studentId:studId, from, to})){
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${escapeHtml(clsName)}</td>
      <td class="stu">${escapeHtml(getStudentName(e.studentId))}</td>
      <td>${DISPLAY_MINUS(e.symbol)}</td>
      <td class="val">${e.value}</td>
    `;
    overviewTableBody.appendChild(tr);
  }

  const all=getEntriesFiltered({classId, from, to}); const byStu={};
  for (const e of all){ (byStu[e.studentId] ||= []).push(e.value); }
  if (!studId){
    const lines=[];
    for (const s of getStudentsByClass(classId)){ const arr=byStu[s.id]||[]; lines.push(`${s.name}: ${fmt1(mean(arr))} (${arr.length})`); }
    overviewStats.textContent = lines.length ? `Durchschnitte im Zeitraum: ${lines.join(" · ")}` : "Keine Einträge im Zeitraum.";
  } else {
    const arr=byStu[studId]||[]; const avg=mean(arr);
    const label=nearestGradeLabel(avg);
    overviewHighlight.innerHTML = `<span><strong>${escapeHtml(getStudentName(studId))}</strong></span><span class="note">${label} <span class="avg-num">(${fmt1(avg)})</span></span>`;
    overviewHighlight.classList.remove("hidden");
    overviewStats.textContent = `Einträge: ${arr.length}`;
  }
}
function renderOverviewIfActive(){ if (document.querySelector("#view-uebersicht").classList.contains("active")) renderOverview(); }

// Semester Buttons
btnH1.addEventListener("click", ()=>{ const r=classSemesterRanges(getClass(currentClassId)).h1; dateFrom.value=r.from; dateTo.value=r.to; renderStudentList(); highlightSemesterButtons(); });
btnH2.addEventListener("click", ()=>{ const r=classSemesterRanges(getClass(currentClassId)).h2; dateFrom.value=r.from; dateTo.value=r.to; renderStudentList(); highlightSemesterButtons(); });
btnH1Overview.addEventListener("click", ()=>{ const r=classSemesterRanges(getClass(classSelectOverview.value)).h1; overviewFrom.value=r.from; overviewTo.value=r.to; renderOverview(); highlightSemesterButtons(true); });
btnH2Overview.addEventListener("click", ()=>{ const r=classSemesterRanges(getClass(classSelectOverview.value)).h2; overviewFrom.value=r.from; overviewTo.value=r.to; renderOverview(); highlightSemesterButtons(true); });

// Select listeners + Titelupdates
classSelectRecord.addEventListener("change", ()=>{ currentClassId=classSelectRecord.value||null; setDefaultDatesForRecord(); initDefaultSortModeForClass(); renderStudentList(); highlightSemesterButtons(); updateAppTitle(); });
dateFrom.addEventListener("change", ()=>{ renderStudentList(); highlightSemesterButtons(); });
dateTo.addEventListener("change", ()=>{ renderStudentList(); highlightSemesterButtons(); });
sortModeSel.addEventListener("change", renderStudentList);

classSelectOverview.addEventListener("change", ()=>{ populateStudentSelectOverview(); setDefaultDatesForOverview(); renderOverview(); highlightSemesterButtons(true); updateAppTitle(); });
studentSelectOverview.addEventListener("change", renderOverview);
overviewFrom.addEventListener("change", ()=>{ renderOverview(); highlightSemesterButtons(true); });
overviewTo.addEventListener("change", ()=>{ renderOverview(); highlightSemesterButtons(true); });

classSelectSeating.addEventListener("change", ()=>{
  renderSeatingControlsFromClass();
  renderSeating();
  updateAppTitle();
});

// ===== Sitzplan (Editor + Palette + PDF) =====
function seatingIsAdjusted(seat){ if (!seat) return false; if (Object.keys(seat.cells||{}).length>0) return true; if (seat.preset!=="free") return true; if (seat.rows!==5||seat.cols!==6) return true; if (seat.roomName?.trim()) return true; if ((seat.aisles||[]).length>0) return true; return false; }

function renderSeatingControlsFromClass(){
  const cid=classSelectSeating.value; const seat=getSeating(cid);
  seatingPreset.value=seat.preset||"free"; seatingRows.value=seat.rows||5; seatingCols.value=seat.cols||6; roomNameInput.value=seat.roomName||"";
  seatingAisles.value=(seat.aisles||[]).join(",");
  renderSeatingPalette();
}
function renderSeatingPalette(){
  const cid=classSelectSeating.value; const studs=getStudentsByClass(cid);
  const placedIds = new Set(Object.values(getSeating(cid)?.cells||{}));
  seatingPalette.innerHTML="";
  for (const s of studs){
    const b=document.createElement("button"); b.type="button"; b.className="chip"; b.textContent = s.name;
    if (placedIds.has(s.id)) b.classList.add("placed");
    if (seatingSelectedStudentId===s.id) b.classList.add("selected");
    b.addEventListener("click", ()=>{ seatingSelectedStudentId = (seatingSelectedStudentId===s.id? null : s.id); renderSeatingPalette(); });
    seatingPalette.appendChild(b);
  }
}
function buildDisabledForPreset(preset, rows, cols){
  const dis=[]; if (preset==="u"){ for (let r=0;r<rows;r++){ for (let c=0;c<cols;c++){ const border=(r===0||r===rows-1||c===0||c===cols-1); if (!border) dis.push(`${r}-${c}`); } } } return dis;
}
function parseAislesInput(cols){
  const raw=(seatingAisles.value||"").split(/[,\s]+/).map(s=>s.trim()).filter(Boolean).map(n=>parseInt(n,10));
  const valid = Array.from(new Set(raw.filter(n=>Number.isFinite(n) && n>=1 && n<=cols-1))).sort((a,b)=>a-b);
  return valid;
}
function resizeSeatingEditorGrid(seat){
  const aisles = new Set((seat.aisles||[]).map(n=>parseInt(n,10)));
  seatingGrid.style.rowGap = `var(--aisle)`; // Zeilenabstand 32px
  seatingGrid.style.gridTemplateColumns = `repeat(${seat.cols}, var(--cell))`;
  const baseGap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--base-gap')) || 8;
  const wrap = seatingGrid.getBoundingClientRect();
  const extraPerAisle = Math.max(0, 32 - baseGap);
  const totalGapX = baseGap*(seat.cols-1) + aisles.size*extraPerAisle;
  const aisle = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--aisle')) || 32;
  const totalGapY = (seat.rows-1) * aisle;
  const maxW = Math.max(56, Math.floor((wrap.width - totalGapX) / seat.cols));
  const maxH = Math.max(56, Math.floor((seatingGrid.clientHeight - totalGapY) / seat.rows));
  const cell = Math.max(48, Math.min(maxW, maxH));
  seatingGrid.style.setProperty("--cell", `${cell}px`);
}
function renderSeating(){
  seatingGrid.innerHTML=""; const cid=classSelectSeating.value; if (!cid){ seatingGrid.textContent="Keine Klasse ausgewählt."; return; }
  const seat=getSeating(cid);
  seatingGrid.style.gridTemplateColumns = `repeat(${seat.cols}, var(--cell))`;
  const disabledSet=new Set(seat.disabled||[]); const aisles=new Set((seat.aisles||[]).map(n=>parseInt(n,10)));
  for(let r=0;r<seat.rows;r++){
    for(let c=0;c<seat.cols;c++){
      const key=`${r}-${c}`; const cell=document.createElement("div"); cell.className="cell";
      if (disabledSet.has(key)) cell.classList.add("disabled");
      if (aisles.has(c+1)) {
        const baseGap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--base-gap')) || 8;
        const extra = Math.max(0, 32 - baseGap);
        cell.style.marginRight = `${extra}px`;
      }
      const sid=seat.cells[key];
      if (sid){ cell.textContent=getStudentName(sid); }
      cell.addEventListener("click", async ()=>{
        if (disabledSet.has(key)) return;
        if (seat.cells[key]){ delete seat.cells[key]; await updateEncrypted("class", getClass(cid)); renderSeating(); renderSeatingPalette(); if (sortModeSel.value==="seating"&&currentClassId===cid) renderStudentList(); return; }
        if (!seatingSelectedStudentId){ showToast("Bitte zuerst Schüler in der Palette auswählen."); return; }
        for (const k of Object.keys(seat.cells)) if (seat.cells[k]===seatingSelectedStudentId) delete seat.cells[k];
        seat.cells[key]=seatingSelectedStudentId; await updateEncrypted("class", getClass(cid));
        renderSeating(); renderSeatingPalette(); if (sortModeSel.value==="seating"&&currentClassId===cid) renderStudentList();
      });
      seatingGrid.appendChild(cell);
    }
  }
  resizeSeatingEditorGrid(seat);
  window.addEventListener("resize", ()=> resizeSeatingEditorGrid(seat), { passive:true });
}
function renderSeatingIfForClass(classId){ if (classSelectSeating.value===classId){ renderSeatingPalette(); renderSeating(); } }

btnBuildGrid.addEventListener("click", async ()=>{
  const cid=classSelectSeating.value; if (!cid) return;
  const rows=Math.max(1, Math.min(20, Number(seatingRows.value)||5));
  const cols=Math.max(1, Math.min(20, Number(seatingCols.value)||6));
  const preset=seatingPreset.value;
  const aisles=parseAislesInput(cols);
  const seat=getSeating(cid);
  const newCells={}; for (const [k,v] of Object.entries(seat.cells||{})){ const [r,c]=k.split("-").map(n=>parseInt(n,10)); if (r<rows && c<cols) newCells[k]=v; }
  seat.rows=rows; seat.cols=cols; seat.preset=preset; seat.disabled=buildDisabledForPreset(preset, rows, cols); seat.cells=newCells; seat.aisles=aisles;
  await updateEncrypted("class", getClass(cid));
  showToast("Raster aktualisiert."); renderSeating(); renderSeatingPalette(); if (sortModeSel.value==="seating"&&currentClassId===cid) renderStudentList();
});
btnClearSeating.addEventListener("click", async ()=>{
  const cid=classSelectSeating.value; if (!cid) return; if (!confirm("Alle Platzierungen löschen?")) return;
  const seat=getSeating(cid); seat.cells={}; await updateEncrypted("class", getClass(cid));
  renderSeating(); renderSeatingPalette(); if (sortModeSel.value==="seating"&&currentClassId===cid) renderStudentList();
});
roomNameInput.addEventListener("change", async ()=>{
  const cid=classSelectSeating.value; const seat=getSeating(cid); seat.roomName=roomNameInput.value.trim(); await updateEncrypted("class", getClass(cid));
});
btnExportPDFSeating.addEventListener("click", ()=> exportSeatingPDF(classSelectSeating.value));

// ===== Exporte =====
function classSemesterFor(classId){ return classSemesterRanges(getClass(classId)); }
function computeSemesterAverages(classId){
  const {h1,h2}=classSemesterFor(classId); const studs=getStudentsByClass(classId); const res={};
  for (const s of studs){
    const e1=getEntriesFiltered({classId, studentId:s.id, from:h1.from, to:h1.to}).map(e=>e.value);
    const e2=getEntriesFiltered({classId, studentId:s.id, from:h2.from, to:h2.to}).map(e=>e.value);
    res[s.id]={ name:s.name, h1Avg:mean(e1), h1Cnt:e1.length, h2Avg:mean(e2), h2Cnt:e2.length };
  }
  return res;
}
function makeCsvBlobUTF8(csv){ const BOM="\ufeff"; return new Blob([BOM+csv], {type:"text/csv;charset=utf-8"}); }
function exportClassCSVReport(classId){
  const cls=getClass(classId); if (!cls) return;
  const studs=getStudentsByClass(classId); const avgs=computeSemesterAverages(classId);
  const header1=["Klasse",cls.name,"Fach",cls.subject||"","Lehrkraft",cls.teacher||"","Exportdatum",todayISO(),"Schülerzahl",String(studs.length)];
  const sectionA=["Schüler","H1 Durchschnitt","H1 Anzahl","H2 Durchschnitt","H2 Anzahl"];
  const linesA=studs.map(s=>{ const a=avgs[s.id]; return [s.name, fmt1(a.h1Avg), a.h1Cnt, fmt1(a.h2Avg), a.h2Cnt]; });
  const sectionB=["Schüler","Datum","Symbol","Wert"]; const linesB=[];
  for (const s of studs){
    const entries=state.entries.filter(e=>e.classId===classId && e.studentId===s.id);
    if (entries.length===0) continue;
    linesB.push([s.name,"","",""]);
    for (const e of entries) linesB.push(["", e.date, DISPLAY_MINUS(e.symbol), String(e.value)]);
  }
  const rows=[header1, [""], sectionA, ...linesA, [""], sectionB, ...linesB];
  const csv = rows.map(r=>r.map(f=>{ const s=String(f??""); return /[",;\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }).join(";")).join("\n");
  const blob=makeCsvBlobUTF8(csv); const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=`bericht_${cls.name}_${todayISO()}.csv`; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
  showToast("CSV-Bericht exportiert.");
}
function exportClassPDFReport(classId){
  const cls=getClass(classId); if (!cls) return;
  const studs=getStudentsByClass(classId); const avgs=computeSemesterAverages(classId); const date=new Date().toLocaleDateString("de-DE");
  const avgRows = studs.map(s=>{ const a=avgs[s.id]; return `<tr><td>${escapeHtml(s.name)}</td><td>${fmt1(a.h1Avg)}</td><td>${a.h1Cnt}</td><td>${fmt1(a.h2Avg)}</td><td>${a.h2Cnt}</td></tr>`; }).join("");
  let entriesHtml=""; for (const s of studs){
    const entries=state.entries.filter(e=>e.classId===classId && e.studentId===s.id);
    if (entries.length===0) continue;
    entriesHtml += `<h3 style="margin:10px 0 4px 0; font-size:14pt">${escapeHtml(s.name)}</h3><table class="print-table"><thead><tr><th>Datum</th><th>Symbol</th><th>Wert</th></tr></thead><tbody>`;
    for (const e of entries) entriesHtml += `<tr><td>${e.date}</td><td>${escapeHtml(DISPLAY_MINUS(e.symbol))}</td><td>${e.value}</td></tr>`;
    entriesHtml += `</tbody></table>`;
  }
  const html = `
<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Bericht ${escapeHtml(cls.name)}</title>
<style>@page{size:A4;margin:14mm}body{font:11pt system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111}
h1{font-size:18pt;margin:0 0 6mm 0}h2{font-size:14pt;margin:8mm 0 3mm 0}h3{font-size:12pt;margin:6mm 0 3mm 0}
.meta{color:#333;margin-bottom:6mm}.print-table{width:100%;border-collapse:collapse;margin-bottom:4mm}
.print-table th,.print-table td{border:1px solid #333;padding:4px 6px;font-size:10pt}</style></head><body>
<h1>Bericht – ${escapeHtml(cls.name)} (${escapeHtml(cls.subject||"")})</h1>
<div class="meta">Klassenlehrkraft: ${escapeHtml(cls.teacher||"—")} · Schülerzahl: ${studs.length} · Exportdatum: ${date}</div>
<h2>Durchschnittsnoten (1. und 2. Halbjahr)</h2>
<table class="print-table"><thead><tr><th>Schüler</th><th>H1 Ø</th><th>H1 n</th><th>H2 Ø</th><th>H2 n</th></tr></thead><tbody>${avgRows}</tbody></table>
<h2>Einträge je Schüler</h2>${entriesHtml}
<script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 500);}</script></body></html>`.trim();
  const w=window.open("","_blank"); if (!w){ showToast("Pop-up blockiert."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
function exportSeatingPDF(classId){
  const c=getClass(classId); const seat=getSeating(classId); const studs=getStudentsByClass(classId);
  const title = `Sitzplan ${c.name} – ${c.subject||""}`; const teacher=c.teacher||"—"; const room=seat.roomName||"—"; const date=new Date().toLocaleDateString("de-DE");
  const disabled=new Set(seat.disabled||[]); const aisles=new Set((seat.aisles||[]).map(n=>parseInt(n,10)));

  // identische Abstände: gap 8px; row-gap 32px; pro Gang zusätzlich 24px (8+24=32)
  let gridHtml = `<div class="print-grid" style="display:grid; gap:8px; row-gap:32px; grid-template-columns: repeat(${seat.cols}, 1fr);">`;
  for (let r=0;r<seat.rows;r++){
    for (let col=0; col<seat.cols; col++){
      const key=`${r}-${col}`; const n=getStudentName(seat.cells[key])||""; const dis=disabled.has(key)?"disabled":"";
      const mr = aisles.has(col+1) ? "margin-right:24px" : "";
      gridHtml += `<div class="print-cell ${dis}" style="${mr}">${escapeHtml(n)}</div>`;
    }
  }
  gridHtml += `</div>`;

  const html=`
<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page{size:A4 landscape; margin:14mm}
  body{font:12pt system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111}
  h1{font-size:18pt;margin:0 0 2mm 0}.meta{color:#333;margin-top:1mm}
  .print-grid{display:grid}
  .print-cell{border:1px solid #333;border-radius:4px;height:28mm;display:flex;align-items:center;justify-content:center;padding:4px;text-align:center;word-break:break-word}
  .print-cell.disabled{background:repeating-linear-gradient(45deg,#00000010,#00000010 6px,transparent 6px,transparent 12px)}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Klassenlehrkraft: ${escapeHtml(teacher)} · Raum: ${escapeHtml(room)} · Schülerzahl: ${studs.length} · Datum: ${date}</div>
${gridHtml}
<script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 500);}</script></body></html>`.trim();
  const w=window.open("","_blank"); if (!w){ showToast("Pop-up blockiert."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// Toast
let toastTimeout=null;
function showToast(msg){ toastEl.textContent=msg; toastEl.classList.add("show"); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>toastEl.classList.remove("show"),2200); }

// Init after login
function initAfterLogin(){
  todayDisplay.textContent=todayLocal();
  applyTheme();
  populateClassSelects();
  if (currentClassId) setDefaultDatesForRecord();
  if (!state.settings?.id){ state.settings.id = uid("set"); state.settings.userId=currentUser.id; saveEncrypted("settings", state.settings, state.settings.id); }
  initDefaultSortModeForClass();
  renderStudentList();
  updateAppTitle();
}

// Bootstrap
(async function(){
  db = await openDB();
  if ("serviceWorker" in navigator){ window.addEventListener("load", ()=> navigator.serviceWorker.register("service-worker.js").catch(()=>{})); }
})();
