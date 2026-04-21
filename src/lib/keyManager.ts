import pb from './pocketbase'
import {
  generateKeyPair, exportPublicKey, exportPrivateKey,
  importPublicKey, importPrivateKey,
  deriveKeyFromPassword, encryptData, decryptData
} from './crypto'

// Module-level session keys — set at login, cleared at logout
let _privateKey: CryptoKey | null = null
let _publicKey: CryptoKey | null = null

export function getSessionPrivKey(): CryptoKey | null { return _privateKey }
export function getSessionPubKey(): CryptoKey | null { return _publicKey }
export function hasSessionKeys(): boolean { return _privateKey !== null }

export function clearSessionKeys(): void {
  _privateKey = null
  _publicKey = null
}

function getSalt(userId: string): Uint8Array {
  const stored = localStorage.getItem(`responda_salt_${userId}`)
  if (stored) return Uint8Array.from(atob(stored), c => c.charCodeAt(0))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(`responda_salt_${userId}`, btoa(String.fromCharCode(...salt)))
  return salt
}

export async function initializeAndUnlock(userId: string, password: string): Promise<void> {
  // Create keys if they don't exist yet
  const existing = await pb.collection('user_keys').getFirstListItem(`user="${userId}"`).catch(() => null)
  if (!existing) {
    const keyPair = await generateKeyPair()
    const [pubB64, privB64] = await Promise.all([
      exportPublicKey(keyPair.publicKey),
      exportPrivateKey(keyPair.privateKey),
    ])
    const salt = getSalt(userId)
    const wrapKey = await deriveKeyFromPassword(password, salt)
    const encPriv = await encryptData(wrapKey, privB64)
    await pb.collection('user_keys').create({ user: userId, public_key: pubB64, encrypted_private_key: encPriv })
    _privateKey = keyPair.privateKey
    _publicKey = keyPair.publicKey
    cachePublicKey(userId, pubB64)
    return
  }

  // Decrypt existing private key
  const salt = getSalt(userId)
  const wrapKey = await deriveKeyFromPassword(password, salt)
  const privB64 = await decryptData(wrapKey, existing.encrypted_private_key)
  _privateKey = await importPrivateKey(privB64)
  _publicKey = await importPublicKey(existing.public_key)
  cachePublicKey(userId, existing.public_key)
}

export async function getPublicKey(userId: string): Promise<CryptoKey | null> {
  try {
    const record = await pb.collection('user_keys').getFirstListItem(`user="${userId}"`)
    cachePublicKey(userId, record.public_key)
    return importPublicKey(record.public_key)
  } catch { return null }
}

export async function getPublicKeyB64(userId: string): Promise<string | null> {
  const cached = getCachedPublicKeyB64(userId)
  if (cached) return cached
  try {
    const record = await pb.collection('user_keys').getFirstListItem(`user="${userId}"`)
    cachePublicKey(userId, record.public_key)
    return record.public_key
  } catch { return null }
}

export function cachePublicKey(userId: string, b64: string): void {
  localStorage.setItem(`pubkey_${userId}`, b64)
}

export function getCachedPublicKeyB64(userId: string): string | null {
  return localStorage.getItem(`pubkey_${userId}`)
}

export async function getCachedPublicKey(userId: string): Promise<CryptoKey | null> {
  const b64 = getCachedPublicKeyB64(userId)
  if (!b64) return null
  try { return await importPublicKey(b64) } catch { return null }
}
