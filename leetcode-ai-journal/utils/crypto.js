// utils/crypto.js — AES-GCM encryption keyed on chrome.runtime.id

async function getKey() {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(chrome.runtime.id),
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('leetcode-ai-journal-v1'),
      info: new Uint8Array()
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Returns base64-encoded JSON blob: { iv, ct }
export async function encryptValue(plaintext) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return btoa(JSON.stringify({
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext))
  }));
}

// Decrypts a value produced by encryptValue; throws on tampered/wrong input
export async function decryptValue(encrypted) {
  const key = await getKey();
  const { iv, ct } = JSON.parse(atob(encrypted));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(ct)
  );
  return new TextDecoder().decode(plaintext);
}
