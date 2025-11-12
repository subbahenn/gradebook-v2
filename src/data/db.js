// Minimal IndexedDB helper with encryption per record
import { encryptJson, decryptJson, deriveKey, randomSalt, passwordVerifier } from './crypto.js';

const DB_NAME = 'noten-db';
const DB_VERSION = 1;

let db, cryptoKey, userSalt, verifier;

export async function openDb(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('user', { keyPath: 'id' });
      d.createObjectStore('settings', { keyPath: 'id' });
      d.createObjectStore('classes', { keyPath: 'id' });
      d.createObjectStore('students', { keyPath: 'id' });
      d.createObjectStore('contributions', { keyPath: 'id' });
      d.createObjectStore('seatPlans', { keyPath: 'classId' });
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

export async function initUser(username, password){
  const tx = db.transaction('user','readwrite');
  const store = tx.objectStore('user');
  userSalt = randomSalt();
  verifier = await passwordVerifier(password, userSalt);
  await store.put({ id:'me', username, salt: Array.from(userSalt), verifier });
  cryptoKey = await deriveKey(password, userSalt);
}

export async function loadUser(){
  const tx = db.transaction('user','readonly');
  const u = await tx.objectStore('user').get('me');
  if (!u) return null;
  userSalt = new Uint8Array(u.salt);
  verifier = u.verifier;
  return u;
}

export async function login(password){
  if (!userSalt) throw new Error('No user');
  const v = await passwordVerifier(password, userSalt);
  if (v !== verifier) throw new Error('Falsches Passwort');
  cryptoKey = await deriveKey(password, userSalt);
  return true;
}

function storePut(storeName, record){
  return new Promise(async (resolve, reject)=>{
    try {
      const payload = await encryptJson(cryptoKey, record);
      const tx = db.transaction(storeName,'readwrite');
      tx.objectStore(storeName).put(payload);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch(e){ reject(e); }
  });
}
function storeGet(storeName, key){
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(storeName,'readonly');
    tx.objectStore(storeName).get(key).onsuccess = async (e) => {
      const payload = e.target.result;
      if (!payload) return resolve(null);
      try{ resolve(await decryptJson(cryptoKey, payload)); }
      catch(err){ reject(err); }
    };
    tx.onerror = () => reject(tx.error);
  });
}
function storeAll(storeName){
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(storeName,'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = async () => {
      try{
        const arr = await Promise.all(req.result.map(p => decryptJson(cryptoKey, p)));
        resolve(arr);
      } catch(e){ reject(e); }
    };
    req.onerror = () => reject(req.error);
  });
}

// Public API
export const secure = {
  put: storePut,
  get: storeGet,
  all: storeAll
};
