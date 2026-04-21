import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import StatusBar from '../components/StatusBar'
import { encryptData, decryptData, generateDocumentKey, exportDocumentKey, importDocumentKey } from '../lib/crypto'
import { getPublicKey, cachePublicKey, getCachedPublicKey } from '../lib/keyManager'

interface Channel {
  id: string
  name: string
  description?: string
  is_direct: boolean
  members: string[]
  created: string
}

interface Message {
  id: string
  channel: string
  sender: string
  sender_name: string
  content: string
  encrypted_content: string
  created: string
  decrypted?: string
}

// In-memory private key (set after unlock)
let sessionPrivateKey: CryptoKey | null = null
let sessionPublicKey: CryptoKey | null = null

export function setSessionKeys(priv: CryptoKey, pub: CryptoKey) {
  sessionPrivateKey = priv
  sessionPublicKey = pub
}

export default function Chat() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [sending, setSending] = useState(false)
  const [channelKey, setChannelKey] = useState<CryptoKey | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (user && unlocked) loadChannels()
  }, [user, unlocked])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => { unsubRef.current?.() }
  }, [])

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setUnlocking(true)
    setUnlockError('')
    try {
      const { unlockPrivateKey, initializeKeys } = await import('../lib/keyManager')
      await initializeKeys(user.id, password)
      const privKey = await unlockPrivateKey(user.id, password)
      const { generateKeyPair, exportPublicKey, importPublicKey } = await import('../lib/crypto')
      const record = await pb.collection('user_keys').getFirstListItem(`user="${user.id}"`)
      const pubKey = await importPublicKey(record.public_key)
      setSessionKeys(privKey, pubKey)
      cachePublicKey(user.id, record.public_key)
      setUnlocked(true)
    } catch {
      setUnlockError('Falsches Passwort oder Schlüssel nicht gefunden.')
    } finally {
      setUnlocking(false)
    }
  }

  async function loadChannels() {
    if (!user) return
    try {
      const result = await pb.collection('chat_channels').getList(1, 50, {
        filter: `organization="${user.organization_id}" && members~"${user.id}"`,
        sort: '-updated',
      })
      setChannels(result.items as unknown as Channel[])
      if (result.items.length > 0 && !activeChannel) {
        selectChannel(result.items[0] as unknown as Channel)
      }
    } catch (e) {
      console.error('Failed to load channels', e)
    }
  }

  async function loadChannelKey(channel: Channel): Promise<CryptoKey | null> {
    if (!user || !sessionPrivateKey) return null
    try {
      const keyRecord = await pb.collection('chat_channel_keys').getFirstListItem(
        `channel="${channel.id}" && user="${user.id}"`
      )
      const senderPubKey = await getCachedPublicKey(keyRecord.sender) ||
        await getPublicKey(keyRecord.sender)
      if (!senderPubKey) return null
      const { decryptDocumentKey } = await import('../lib/crypto')
      return decryptDocumentKey(keyRecord.encrypted_key, sessionPrivateKey, senderPubKey)
    } catch {
      return null
    }
  }

  async function selectChannel(channel: Channel) {
    unsubRef.current?.()
    setActiveChannel(channel)
    setMessages([])
    const key = await loadChannelKey(channel)
    setChannelKey(key)
    if (key) await loadMessages(channel, key)
    subscribeToMessages(channel, key)
  }

  async function loadMessages(channel: Channel, key: CryptoKey) {
    try {
      const result = await pb.collection('chat_messages').getList(1, 100, {
        filter: `channel="${channel.id}"`,
        sort: 'created',
        expand: 'sender',
      })
      const decrypted = await Promise.all(result.items.map(async (m) => {
        let text = '🔒 Verschlüsselt'
        try { text = await decryptData(key, m.encrypted_content) } catch {}
        return {
          ...m,
          sender_name: (m.expand as any)?.sender?.name || 'Unbekannt',
          decrypted: text,
        } as Message
      }))
      setMessages(decrypted)
    } catch (e) {
      console.error('Failed to load messages', e)
    }
  }

  function subscribeToMessages(channel: Channel, key: CryptoKey | null) {
    pb.collection('chat_messages').subscribe('*', async (e) => {
      if (e.record.channel !== channel.id) return
      let text = '🔒 Verschlüsselt'
      if (key) {
        try { text = await decryptData(key, e.record.encrypted_content) } catch {}
      }
      const senderName = e.record.expand?.sender?.name || 'Unbekannt'
      if (e.action === 'create') {
        setMessages(prev => [...prev, { ...e.record, sender_name: senderName, decrypted: text } as Message])
      }
    }, { expand: 'sender' }).then(unsub => { unsubRef.current = unsub })
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !activeChannel || !channelKey || !user || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    try {
      const encrypted = await encryptData(channelKey, text)
      await pb.collection('chat_messages').create({
        channel: activeChannel.id,
        sender: user.id,
        encrypted_content: encrypted,
        organization: user.organization_id,
      })
    } catch (e) {
      console.error('Failed to send message', e)
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newChannelName.trim() || !user || !sessionPrivateKey || !sessionPublicKey) return
    try {
      const docKey = await generateDocumentKey()
      const channel = await pb.collection('chat_channels').create({
        name: newChannelName.trim(),
        organization: user.organization_id,
        members: [user.id],
        is_direct: false,
      })
      const { encryptDocumentKeyForRecipient } = await import('../lib/crypto')
      const encryptedKey = await encryptDocumentKeyForRecipient(docKey, sessionPrivateKey, sessionPublicKey)
      await pb.collection('chat_channel_keys').create({
        channel: channel.id,
        user: user.id,
        sender: user.id,
        encrypted_key: encryptedKey,
        organization: user.organization_id,
      })
      setNewChannelName('')
      setShowNewChannel(false)
      await loadChannels()
    } catch (e) {
      console.error('Failed to create channel', e)
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return null

  return (
    <>
      <style>{`
        .chat-page {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          background: var(--bg);
        }
        .chat-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          padding-top: calc(54px + env(safe-area-inset-top));
        }
        .chat-sidebar {
          width: 260px;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          background: var(--bg-card);
          flex-shrink: 0;
        }
        .chat-sidebar-header {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .chat-sidebar-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
        }
        .chat-new-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: var(--accent);
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .chat-channel-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .chat-channel-item {
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.1s;
        }
        .chat-channel-item:hover { background: var(--bg-hover); }
        .chat-channel-item.active { background: var(--accent); color: white; }
        .chat-channel-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: var(--accent);
          flex-shrink: 0;
        }
        .chat-channel-item.active .chat-channel-icon {
          background: rgba(255,255,255,0.2);
          color: white;
        }
        .chat-channel-name {
          font-size: 14px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .chat-main-header {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--bg-card);
        }
        .chat-main-title {
          font-size: 15px;
          font-weight: 600;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .chat-message {
          display: flex;
          gap: 10px;
          padding: 4px 0;
        }
        .chat-message.own { flex-direction: row-reverse; }
        .chat-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
          align-self: flex-end;
        }
        .chat-bubble-wrap { display: flex; flex-direction: column; max-width: 70%; }
        .chat-message.own .chat-bubble-wrap { align-items: flex-end; }
        .chat-sender {
          font-size: 11px;
          color: var(--text-secondary);
          margin-bottom: 3px;
          padding: 0 4px;
        }
        .chat-bubble {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px 16px 16px 4px;
          padding: 8px 12px;
          font-size: 14px;
          line-height: 1.4;
          color: var(--text);
          word-break: break-word;
        }
        .chat-message.own .chat-bubble {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
          border-radius: 16px 16px 4px 16px;
        }
        .chat-time {
          font-size: 10px;
          color: var(--text-secondary);
          margin-top: 3px;
          padding: 0 4px;
        }
        .chat-input-bar {
          padding: 12px 16px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom));
          border-top: 1px solid var(--border);
          display: flex;
          gap: 8px;
          align-items: flex-end;
          background: var(--bg-card);
        }
        .chat-input {
          flex: 1;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 9px 14px;
          font-size: 14px;
          color: var(--text);
          resize: none;
          outline: none;
          max-height: 120px;
          font-family: inherit;
        }
        .chat-input:focus { border-color: var(--accent); }
        .chat-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: var(--accent);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .chat-send-btn:disabled { opacity: 0.4; cursor: default; }
        .chat-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          font-size: 14px;
          text-align: center;
          padding: 40px;
        }
        .chat-lock-screen {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
        }
        .chat-lock-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 32px;
          max-width: 360px;
          width: 100%;
          text-align: center;
        }
        .chat-lock-icon {
          font-size: 40px;
          margin-bottom: 16px;
        }
        .chat-lock-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .chat-lock-desc {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 24px;
          line-height: 1.5;
        }
        .chat-lock-input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg);
          color: var(--text);
          font-size: 15px;
          margin-bottom: 12px;
          box-sizing: border-box;
          outline: none;
        }
        .chat-lock-input:focus { border-color: var(--accent); }
        .chat-lock-btn {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 10px;
          background: var(--accent);
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
        }
        .chat-lock-error {
          font-size: 13px;
          color: #ff3b30;
          margin-top: 8px;
        }
        .chat-new-form {
          padding: 16px;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 8px;
        }
        .chat-new-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          outline: none;
        }
        .chat-new-input:focus { border-color: var(--accent); }
        .chat-new-save {
          padding: 8px 12px;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        @media (max-width: 767px) {
          .chat-sidebar { display: ${activeChannel ? 'none' : 'flex'}; width: 100%; }
          .chat-main { display: ${activeChannel ? 'flex' : 'none'}; }
          .chat-sidebar.show-mobile { display: flex; width: 100%; }
        }
        .chat-back-btn {
          display: none;
          background: none;
          border: none;
          color: var(--accent);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 0;
          margin-right: 4px;
        }
        @media (max-width: 767px) {
          .chat-back-btn { display: flex; align-items: center; gap: 4px; }
        }
      `}</style>

      <div className="chat-page">
        <StatusBar user={user} onLogout={logout} showBackButton onBackClick={() => navigate('/hub')} pageName="Chat" />

        {!unlocked ? (
          <div className="chat-body">
            <div className="chat-lock-screen">
              <div className="chat-lock-card">
                <div className="chat-lock-icon">🔐</div>
                <div className="chat-lock-title">Ende-zu-Ende verschlüsselt</div>
                <div className="chat-lock-desc">
                  Gib dein Passwort ein um den verschlüsselten Chat zu entsperren. Dein Schlüssel verlässt nie das Gerät.
                </div>
                <form onSubmit={handleUnlock}>
                  <input
                    className="chat-lock-input"
                    type="password"
                    placeholder="Passwort"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoFocus
                  />
                  <button className="chat-lock-btn" type="submit" disabled={unlocking}>
                    {unlocking ? 'Entsperre...' : 'Chat entsperren'}
                  </button>
                  {unlockError && <div className="chat-lock-error">{unlockError}</div>}
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-body">
            <div className={`chat-sidebar${activeChannel ? '' : ' show-mobile'}`}>
              <div className="chat-sidebar-header">
                <span className="chat-sidebar-title">Chat</span>
                <button className="chat-new-btn" onClick={() => setShowNewChannel(v => !v)} title="Neuer Kanal">+</button>
              </div>
              <div className="chat-channel-list">
                {channels.map(ch => (
                  <div
                    key={ch.id}
                    className={`chat-channel-item${activeChannel?.id === ch.id ? ' active' : ''}`}
                    onClick={() => selectChannel(ch)}
                  >
                    <div className="chat-channel-icon">{ch.name[0].toUpperCase()}</div>
                    <span className="chat-channel-name">{ch.name}</span>
                  </div>
                ))}
                {channels.length === 0 && (
                  <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                    Noch keine Kanäle.<br />Erstelle den ersten.
                  </div>
                )}
              </div>
              {showNewChannel && (
                <form className="chat-new-form" onSubmit={createChannel}>
                  <input
                    className="chat-new-input"
                    placeholder="Kanal-Name"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    autoFocus
                  />
                  <button className="chat-new-save" type="submit">+</button>
                </form>
              )}
            </div>

            <div className="chat-main">
              {!activeChannel ? (
                <div className="chat-empty">Wähle einen Kanal aus</div>
              ) : (
                <>
                  <div className="chat-main-header">
                    <button className="chat-back-btn" onClick={() => setActiveChannel(null)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                      Zurück
                    </button>
                    <div className="chat-channel-icon" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
                      {activeChannel.name[0].toUpperCase()}
                    </div>
                    <span className="chat-main-title">{activeChannel.name}</span>
                  </div>

                  <div className="chat-messages">
                    {messages.map(msg => (
                      <div key={msg.id} className={`chat-message${msg.sender === user?.id ? ' own' : ''}`}>
                        {msg.sender !== user?.id && (
                          <div className="chat-avatar">{msg.sender_name?.[0]?.toUpperCase() || '?'}</div>
                        )}
                        <div className="chat-bubble-wrap">
                          {msg.sender !== user?.id && (
                            <div className="chat-sender">{msg.sender_name}</div>
                          )}
                          <div className="chat-bubble">{msg.decrypted}</div>
                          <div className="chat-time">{formatTime(msg.created)}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form className="chat-input-bar" onSubmit={sendMessage}>
                    <textarea
                      className="chat-input"
                      placeholder={channelKey ? 'Nachricht schreiben...' : '🔒 Kein Zugriff auf diesen Kanal'}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      disabled={!channelKey}
                      rows={1}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any) }
                      }}
                    />
                    <button className="chat-send-btn" type="submit" disabled={!input.trim() || !channelKey || sending}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
