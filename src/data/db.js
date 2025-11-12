// src/data/db.js
import { encryptJson, decryptJson, deriveKey, randomSalt, passwordVerifier } from './crypto.js';

const DB_NAME = 'noten-db';
const DB_VERSION = 1;

let db, cryptoKey, userSalt, verifier;

// Kleine Hilfsfunktionen für IDB
function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbTxComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('user')) d.createObjectStore('user', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('classes')) d.createObjectStore('classes', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('students')) d.createObjectStore('students', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('contributions')) d.createObjectStore('contributions', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('seatPlans')) d.createObjectStore('seatPlans', { keyPath: 'classId' });
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

export async function initUser(username, password) {
  const tx = db.transaction('user', 'readwrite');
  const store = tx.objectStore('user');
  userSalt = randomSalt();
  verifier = await passwordVerifier(password, userSalt);
  await idbReq(store.put({ id: 'me', username, salt: Array.from(userSalt), verifier }));
  await idbTxComplete(tx);
  cryptoKey = await deriveKey(password, userSalt);
}

export async function loadUser() {
  const tx = db.transaction('user', 'readonly');
  const store = tx.objectStore('user');
  const u = await idbReq(store.get('me'));
  // tx kann hier auto-committen; wir warten nicht zwingend auf tx complete
  if (!u) return null;
  userSalt = new Uint8Array(u.salt);
  verifier = u.verifier;
  return u;
}

export async function login(password) {
  if (!userSalt) throw new Error('No user');
  const v = await passwordVerifier(password, userSalt);
  if (v !== verifier) throw new Error('Falsches Passwort');
  cryptoKey = await deriveKey(password, userSalt);
  return true;
}

// Verschlüsselte CRUD-Helfer
async function storePut(storeName, record) {
  if (!cryptoKey) throw new Error('Kein Schlüssel abgeleitet (nicht eingeloggt)');
  const payload = await encryptJson(cryptoKey, record);
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await idbReq(store.put(payload));
  await idbTxComplete(tx);
}

async function storeGet(storeName, key) {
  if (!cryptoKey) throw new Error('Kein Schlüssel abgeleitet (nicht eingeloggt)');
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const payload = await idbReq(store.get(key));
  if (!payload) return null;
  return await decryptJson(cryptoKey, payload);
}

async function storeAll(storeName) {
  if (!cryptoKey) throw new Error('Kein Schlüssel abgeleitet (nicht eingeloggt)');
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const payloads = await idbReq(store.getAll());
  const results = [];
  for (const p of payloads) {
    results.push(await decryptJson(cryptoKey, p));
  }
  return results;
}

export const secure = {
  put: storePut,
  get: storeGet,
  all: storeAll
};
