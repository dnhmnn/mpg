import pb from './pocketbase'
import {
  generateKeyPair, exportPublicKey, exportPrivateKey,
  importPublicKey, importPrivateKey,
  deriveKeyFromPassword, encryptData, decryptData
} from './crypto'

const SALT_KEY = 'responda_key_salt'
const PRIVATE_KEY_SESSION = 'responda_priv_key'

// Get or create the user's salt (stored in PocketBase user record)
function getSalt(userId: string): Uint8Array {
  const stored = localStorage.getItem(`${SALT_KEY}_${userId}`)
  if (stored) return Uint8Array.from(atob(stored), c => c.charCodeAt(0))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(`${SALT_KEY}_${userId}`, btoa(String.fromCharCode(...salt)))
  return salt
}

// Initialize keys for a user on first login
export async function initializeKeys(userId: string, password: string): Promise<void> {
  const existing = await pb.collection('user_keys').getFirstListItem(`user="${userId}"`).catch(() => null)
  if (existing) return // Keys already exist

  const keyPair = await generateKeyPair()
  const [pubB64, privB64] = await Promise.all([
    exportPublicKey(keyPair.publicKey),
    exportPrivateKey(keyPair.privateKey)
  ])

  const salt = getSalt(userId)
  const wrapKey = await deriveKeyFromPassword(password, salt)
  const encryptedPriv = await encryptData(wrapKey, privB64)

  await pb.collection('user_keys').create({
    user: userId,
    public_key: pubB64,
    encrypted_private_key: encryptedPriv,
  })
}

// Load and decrypt private key into session memory
export async function unlockPrivateKey(userId: string, password: string): Promise<CryptoKey> {
  const record = await pb.collection('user_keys').getFirstListItem(`user="${userId}"`)
  const salt = getSalt(userId)
  const wrapKey = await deriveKeyFromPassword(password, salt)
  const privB64 = await decryptData(wrapKey, record.encrypted_private_key)
  const privateKey = await importPrivateKey(privB64)
  // Store serialized in sessionStorage for the session
  sessionStorage.setItem(PRIVATE_KEY_SESSION, record.encrypted_private_key)
  return privateKey
}

// Get private key for current session (must have been unlocked)
export async function getSessionPrivateKey(userId: string, password: string): Promise<CryptoKey | null> {
  try {
    return await unlockPrivateKey(userId, password)
  } catch {
    return null
  }
}

// Get a user's public key by user ID
export async function getPublicKey(userId: string): Promise<CryptoKey | null> {
  try {
    const record = await pb.collection('user_keys').getFirstListItem(`user="${userId}"`)
    return importPublicKey(record.public_key)
  } catch {
    return null
  }
}

// Get public key as base64 string
export async function getPublicKeyB64(userId: string): Promise<string | null> {
  try {
    const record = await pb.collection('user_keys').getFirstListItem(`user="${userId}"`)
    return record.public_key
  } catch {
    return null
  }
}

// Cache public keys for offline use
export function cachePublicKey(userId: string, pubKeyB64: string): void {
  localStorage.setItem(`pubkey_${userId}`, pubKeyB64)
}

export function getCachedPublicKeyB64(userId: string): string | null {
  return localStorage.getItem(`pubkey_${userId}`)
}

export async function getCachedPublicKey(userId: string): Promise<CryptoKey | null> {
  const b64 = getCachedPublicKeyB64(userId)
  if (!b64) return null
  try {
    return await importPublicKey(b64)
  } catch {
    return null
  }
}

// Clear session key on logout
export function clearSessionKey(): void {
  sessionStorage.removeItem(PRIVATE_KEY_SESSION)
}
