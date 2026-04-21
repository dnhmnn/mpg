// E2E encryption using Web Crypto API (AES-256-GCM + ECDH P-256)

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const buf = await crypto.subtle.exportKey('spki', key)
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const buf = await crypto.subtle.exportKey('pkcs8', key)
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey('spki', buf, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
}

export async function importPrivateKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', buf, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
}

// Derive AES-256-GCM key from ECDH key pair
async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Derive AES key from password using PBKDF2
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt arbitrary data with AES-GCM
export async function encryptData(key: CryptoKey, data: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data))
  const combined = new Uint8Array(12 + buf.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(buf), 12)
  return btoa(String.fromCharCode(...combined))
}

// Decrypt AES-GCM encrypted data
export async function decryptData(key: CryptoKey, b64: string): Promise<string> {
  const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(buf)
}

// Generate random document key for encrypting content shared with multiple users
export async function generateDocumentKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportDocumentKey(key: CryptoKey): Promise<string> {
  const buf = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export async function importDocumentKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', buf, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

// Encrypt a document key for a specific recipient using their public key
export async function encryptDocumentKeyForRecipient(
  docKey: CryptoKey,
  senderPrivateKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<string> {
  const sharedKey = await deriveSharedKey(senderPrivateKey, recipientPublicKey)
  const rawDocKey = await exportDocumentKey(docKey)
  return encryptData(sharedKey, rawDocKey)
}

// Decrypt a document key using sender's public key and own private key
export async function decryptDocumentKey(
  encryptedDocKey: string,
  ownPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<CryptoKey> {
  const sharedKey = await deriveSharedKey(ownPrivateKey, senderPublicKey)
  const rawDocKey = await decryptData(sharedKey, encryptedDocKey)
  return importDocumentKey(rawDocKey)
}
