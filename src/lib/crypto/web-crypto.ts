// Utilities for converting buffers to/from Base64 strings
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate a random salt for PBKDF2
export function generateSalt(length = 16): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }
  // Fallback for server-side build time or testing in node
  const crypto = require('crypto');
  return crypto.randomBytes(length);
}

// Helper to get crypto subtle reference (supports server pre-render environment check)
function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  // Node fallback for server-side rendering builds
  const crypto = require('crypto');
  return crypto.webcrypto.subtle;
}

// Derive AES-GCM key from password and salt
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const baseKey = await subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // key is not exportable
    ['encrypt', 'decrypt']
  );
}

// Encrypt a string using AES-GCM
export async function encryptText(plainText: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  
  // Generate random 12-byte IV (Initialization Vector)
  const iv = typeof window !== 'undefined' && window.crypto 
    ? window.crypto.getRandomValues(new Uint8Array(12)) 
    : require('crypto').randomBytes(12);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv),
  };
}

// Decrypt a string using AES-GCM
export async function decryptText(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const encryptedBuffer = base64ToArrayBuffer(ciphertext);
  const ivBuffer = base64ToArrayBuffer(iv);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer),
      },
      key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data. The master password key might be invalid.');
  }
}

// Create verification string to check password correctness
// Encrypts "sitevault-unlocked" and returns the base64 ciphertext
export async function createVerifier(key: CryptoKey): Promise<string> {
  const result = await encryptText('sitevault-unlocked', key);
  // Store both IV and ciphertext joined by a colon
  return `${result.iv}:${result.ciphertext}`;
}

// Verify entered password matches by attempting to decrypt the verifier
export async function verifyVerifier(verifierStr: string, key: CryptoKey): Promise<boolean> {
  try {
    const [iv, ciphertext] = verifierStr.split(':');
    if (!iv || !ciphertext) return false;
    
    const decrypted = await decryptText(ciphertext, iv, key);
    return decrypted === 'sitevault-unlocked';
  } catch {
    return false;
  }
}
