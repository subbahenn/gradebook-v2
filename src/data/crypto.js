const enc = new TextEncoder();
const dec = new TextDecoder();

export async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 250000, salt },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

export function randomSalt(len = 16) {
  const s = new Uint8Array(len); crypto.getRandomValues(s); return s;
}

export async function encryptJson(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: b64(iv), data: b64(new Uint8Array(cipher)) };
}

export async function decryptJson(key, payload) {
  const iv = fromB64(payload.iv);
  const data = fromB64(payload.data);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(dec.decode(new Uint8Array(plain)));
}

function b64(u8) { return btoa(String.fromCharCode(...u8)); }
function fromB64(s) { return new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0))); }

// Password verifier (store for login check)
export async function passwordVerifier(password, salt) {
  const key = await deriveKey(password, salt);
  const raw = await crypto.subtle.exportKey('raw', key);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return b64(new Uint8Array(hash));
}
