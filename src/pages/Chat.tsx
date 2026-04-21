import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import StatusBar from '../components/StatusBar'
import { encryptData, decryptData, generateDocumentKey, encryptDocumentKeyForRecipient, decryptDocumentKey } from '../lib/crypto'
import { getSessionPrivKey, getSessionPubKey, hasSessionKeys, initializeAndUnlock, getPublicKey, getPublicKeyB64, cachePublicKey, getCachedPublicKey } from '../lib/keyManager'

interface Channel {
  id: string
  name: string
  is_direct: boolean
  members: string[]
  other_user_name?: string
}

interface Message {
  id: string
  channel: string
  sender: string
  sender_name: string
  encrypted_content: string
  created: string
  decrypted?: string
}

interface OrgUser {
  id: string
  name: string
  email: string
}

export default function Chat() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [channelKey, setChannelKey] = useState<CryptoKey | null>(null)
  const [sending, setSending] = useState(false)

  const [unlocked, setUnlocked] = useState(false)

  const [showContacts, setShowContacts] = useState(false)
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')

  const [showMobileSidebar, setShowMobileSidebar] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    async function restoreKeys() {
      const { tryRestoreSession } = await import('../lib/keyManager')
      const ok = hasSessionKeys() || await tryRestoreSession()
      if (ok) setUnlocked(true)
    }
    restoreKeys()
  }, [])

  useEffect(() => {
    if (user && unlocked) {
      loadChannels()
      loadOrgUsers()
    }
  }, [user, unlocked])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => { unsubRef.current?.() }, [])


  async function loadChannels() {
    if (!user) return
    try {
      const result = await pb.collection('chat_channels').getList(1, 100, {
        filter: `organization="${user.organization_id}"`,
        sort: '-updated',
      })
      // Filter client-side for membership
      const mine = result.items.filter((ch: any) =>
        Array.isArray(ch.members) ? ch.members.includes(user.id) : false
      ) as unknown as Channel[]
      // Resolve DM display names
      const enriched = await Promise.all(mine.map(async ch => {
        if (ch.is_direct) {
          const otherId = ch.members.find(id => id !== user.id)
          if (otherId) {
            try {
              const u = await pb.collection('users').getOne(otherId)
              return { ...ch, other_user_name: u.name || u.email }
            } catch {}
          }
        }
        return ch
      }))
      setChannels(enriched)
    } catch (e) { console.error(e) }
  }

  async function loadOrgUsers() {
    if (!user) return
    try {
      const result = await pb.collection('users').getList(1, 200, {
        filter: `organization_id="${user.organization_id}"`,
      })
      setOrgUsers(result.items.filter(u => u.id !== user.id) as unknown as OrgUser[])
    } catch (e) { console.error(e) }
  }

  async function loadChannelKey(channel: Channel): Promise<CryptoKey | null> {
    if (!user) return null
    const privKey = getSessionPrivKey()
    if (!privKey) return null
    try {
      const keyRecord = await pb.collection('chat_channel_keys').getFirstListItem(
        `channel="${channel.id}" && user="${user.id}"`
      )
      const senderPubKey = await getCachedPublicKey(keyRecord.sender) || await getPublicKey(keyRecord.sender)
      if (!senderPubKey) return null
      return decryptDocumentKey(keyRecord.encrypted_key, privKey, senderPubKey)
    } catch { return null }
  }

  async function selectChannel(channel: Channel) {
    unsubRef.current?.()
    setActiveChannel(channel)
    setMessages([])
    setShowMobileSidebar(false)
    const key = await loadChannelKey(channel)
    setChannelKey(key)
    if (key) await loadMessages(channel, key)
    subscribeMessages(channel, key)
  }

  async function loadMessages(channel: Channel, key: CryptoKey) {
    try {
      const result = await pb.collection('chat_messages').getList(1, 100, {
        filter: `channel="${channel.id}"`,
        sort: 'created',
        expand: 'sender',
      })
      const msgs = await Promise.all(result.items.map(async m => {
        let text = '🔒'
        try { text = await decryptData(key, m.encrypted_content) } catch {}
        return { ...m, sender_name: (m.expand as any)?.sender?.name || '?', decrypted: text } as Message
      }))
      setMessages(msgs)
    } catch (e) { console.error(e) }
  }

  function subscribeMessages(channel: Channel, key: CryptoKey | null) {
    pb.collection('chat_messages').subscribe('*', async e => {
      if (e.record.channel !== channel.id) return
      let text = '🔒'
      if (key) try { text = await decryptData(key, e.record.encrypted_content) } catch {}
      if (e.action === 'create') {
        setMessages(prev => [...prev, {
          ...e.record,
          sender_name: e.record.expand?.sender?.name || '?',
          decrypted: text,
        } as Message])
      }
    }, { expand: 'sender' }).then(u => { unsubRef.current = u })
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !activeChannel || !channelKey || !user || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    try {
      const enc = await encryptData(channelKey, text)
      await pb.collection('chat_messages').create({
        channel: activeChannel.id,
        sender: user.id,
        encrypted_content: enc,
        organization: user.organization_id,
      })
    } catch { setInput(text) }
    finally { setSending(false) }
  }

  async function createDocKey(forUserIds: string[]): Promise<{ docKey: CryptoKey, encryptedKeys: Record<string, string> }> {
    const privKey = getSessionPrivKey()
    const pubKey = getSessionPubKey()
    if (!privKey || !pubKey) throw new Error('No session keys')
    const docKey = await generateDocumentKey()
    const encryptedKeys: Record<string, string> = {}
    // Encrypt for self
    encryptedKeys[user!.id] = await encryptDocumentKeyForRecipient(docKey, privKey, pubKey)
    // Encrypt for others
    for (const uid of forUserIds) {
      if (uid === user!.id) continue
      const recipPub = await getCachedPublicKey(uid) || await getPublicKey(uid)
      if (recipPub) encryptedKeys[uid] = await encryptDocumentKeyForRecipient(docKey, privKey, recipPub)
    }
    return { docKey, encryptedKeys }
  }

  async function startDM(targetUser: OrgUser) {
    if (!user) return
    setShowContacts(false)
    // Check if DM already exists
    const existing = channels.find(ch => ch.is_direct && ch.members.includes(targetUser.id))
    if (existing) { selectChannel(existing); return }

    try {
      const { docKey, encryptedKeys } = await createDocKey([targetUser.id])
      const channel = await pb.collection('chat_channels').create({
        name: `${user.id}_${targetUser.id}`,
        organization: user.organization_id,
        members: [user.id, targetUser.id],
        is_direct: true,
      })
      for (const [uid, encKey] of Object.entries(encryptedKeys)) {
        await pb.collection('chat_channel_keys').create({
          channel: channel.id,
          user: uid,
          sender: user.id,
          encrypted_key: encKey,
          organization: user.organization_id,
        })
      }
      const newCh: Channel = { ...channel, other_user_name: targetUser.name, members: [user.id, targetUser.id], is_direct: true }
      setChannels(prev => [newCh, ...prev])
      selectChannel(newCh)
    } catch (e) { console.error(e) }
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newChannelName.trim() || !user) return
    try {
      const { docKey, encryptedKeys } = await createDocKey([])
      const channel = await pb.collection('chat_channels').create({
        name: newChannelName.trim(),
        organization: user.organization_id,
        members: [user.id],
        is_direct: false,
      })
      for (const [uid, encKey] of Object.entries(encryptedKeys)) {
        await pb.collection('chat_channel_keys').create({
          channel: channel.id,
          user: uid,
          sender: user.id,
          encrypted_key: encKey,
          organization: user.organization_id,
        })
      }
      setNewChannelName('')
      setShowNewChannel(false)
      await loadChannels()
    } catch (e) { console.error(e) }
  }

  function formatTime(d: string) {
    const date = new Date(d)
    const now = new Date()
    if (date.toDateString() === now.toDateString())
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' +
      date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  const dms = channels.filter(c => c.is_direct)
  const groupChannels = channels.filter(c => !c.is_direct)
  const filteredContacts = orgUsers.filter(u =>
    u.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(contactSearch.toLowerCase())
  )

  if (loading) return null

  return (
    <>
      <style>{`
        .chat-wrap { display: flex; flex-direction: column; height: 100dvh; background: var(--bg); }
        .chat-body { display: flex; flex: 1; overflow: hidden; padding-top: calc(54px + env(safe-area-inset-top)); }
        .chat-sidebar {
          width: 260px; flex-shrink: 0; border-right: 1px solid var(--border);
          display: flex; flex-direction: column; background: var(--bg-card); overflow-y: auto;
        }
        .chat-sidebar-header {
          padding: 12px 14px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .chat-sidebar-title { font-size: 15px; font-weight: 600; }
        .chat-icon-btn {
          width: 28px; height: 28px; border-radius: 8px; border: none;
          background: var(--accent); color: white; font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .chat-section-label {
          font-size: 11px; font-weight: 600; color: var(--text-secondary);
          padding: 10px 14px 4px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .chat-channel-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 14px; cursor: pointer; border-radius: 0; transition: background 0.1s;
        }
        .chat-channel-item:hover { background: var(--bg-hover); }
        .chat-channel-item.active { background: var(--accent); }
        .chat-channel-item.active * { color: white !important; }
        .chat-avatar-sm {
          width: 32px; height: 32px; border-radius: 50%; background: var(--accent);
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600; flex-shrink: 0;
        }
        .chat-channel-item.active .chat-avatar-sm { background: rgba(255,255,255,0.25); }
        .chat-channel-hash {
          width: 32px; height: 32px; border-radius: 8px; background: var(--bg);
          color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; flex-shrink: 0;
        }
        .chat-channel-item.active .chat-channel-hash { background: rgba(255,255,255,0.2); color: white; }
        .chat-channel-name { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .chat-main-header {
          padding: 12px 16px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 10px; background: var(--bg-card);
        }
        .chat-main-title { font-size: 15px; font-weight: 600; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 1px; }
        .chat-msg { display: flex; gap: 8px; padding: 3px 0; }
        .chat-msg.own { flex-direction: row-reverse; }
        .chat-avatar-msg {
          width: 30px; height: 30px; border-radius: 50%; background: var(--accent);
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600; flex-shrink: 0; align-self: flex-end;
        }
        .chat-bubble-wrap { display: flex; flex-direction: column; max-width: 72%; }
        .chat-msg.own .chat-bubble-wrap { align-items: flex-end; }
        .chat-msg-name { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; padding: 0 4px; }
        .chat-bubble {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 16px 16px 16px 4px; padding: 8px 12px;
          font-size: 14px; line-height: 1.45; color: var(--text); word-break: break-word;
        }
        .chat-msg.own .chat-bubble {
          background: var(--accent); border-color: var(--accent); color: white;
          border-radius: 16px 16px 4px 16px;
        }
        .chat-msg-time { font-size: 10px; color: var(--text-secondary); margin-top: 2px; padding: 0 4px; }
        .chat-input-row {
          padding: 10px 14px; padding-bottom: calc(10px + env(safe-area-inset-bottom));
          border-top: 1px solid var(--border); display: flex; gap: 8px; align-items: flex-end;
          background: var(--bg-card);
        }
        .chat-input {
          flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 20px;
          padding: 8px 14px; font-size: 14px; color: var(--text); resize: none; outline: none;
          max-height: 100px; font-family: inherit; line-height: 1.4;
        }
        .chat-input:focus { border-color: var(--accent); }
        .chat-send {
          width: 34px; height: 34px; border-radius: 50%; border: none; background: var(--accent);
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .chat-send:disabled { opacity: 0.4; cursor: default; }
        .chat-empty-main { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 14px; }
        .chat-lock-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .chat-lock-card {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px;
          padding: 28px 24px; max-width: 340px; width: 100%; text-align: center;
        }
        .chat-lock-icon { font-size: 36px; margin-bottom: 14px; }
        .chat-lock-title { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
        .chat-lock-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5; }
        .chat-lock-inp {
          width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: 10px;
          background: var(--bg); color: var(--text); font-size: 15px; margin-bottom: 10px;
          box-sizing: border-box; outline: none;
        }
        .chat-lock-inp:focus { border-color: var(--accent); }
        .chat-lock-btn {
          width: 100%; padding: 10px; border: none; border-radius: 10px;
          background: var(--accent); color: white; font-size: 15px; font-weight: 600; cursor: pointer;
        }
        .chat-lock-err { font-size: 13px; color: #ff3b30; margin-top: 8px; }
        /* Contacts overlay */
        .chat-contacts-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 500;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .chat-contacts-sheet {
          background: var(--bg-card); border-radius: 20px 20px 0 0; width: 100%; max-width: 480px;
          padding: 16px; max-height: 70dvh; display: flex; flex-direction: column;
          padding-bottom: calc(16px + env(safe-area-inset-bottom));
        }
        .chat-contacts-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
        .chat-contacts-search {
          padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px;
          background: var(--bg); color: var(--text); font-size: 14px; outline: none; margin-bottom: 10px;
        }
        .chat-contacts-list { overflow-y: auto; flex: 1; }
        .chat-contact-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 4px;
          border-bottom: 1px solid var(--border); cursor: pointer;
        }
        .chat-contact-item:last-child { border-bottom: none; }
        .chat-contact-name { font-size: 14px; font-weight: 500; }
        .chat-contact-email { font-size: 12px; color: var(--text-secondary); }
        /* New channel form */
        .chat-new-form { padding: 12px 14px; border-top: 1px solid var(--border); display: flex; gap: 8px; }
        .chat-new-inp {
          flex: 1; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
          background: var(--bg); color: var(--text); font-size: 14px; outline: none;
        }
        .chat-new-inp:focus { border-color: var(--accent); }
        .chat-new-save {
          padding: 8px 12px; border: none; border-radius: 8px;
          background: var(--accent); color: white; font-size: 13px; font-weight: 600; cursor: pointer;
        }
        /* Back button mobile */
        .chat-back { display: none; background: none; border: none; color: var(--accent); font-size: 14px; font-weight: 500; cursor: pointer; padding: 0; align-items: center; gap: 4px; }
        @media (max-width: 767px) {
          .chat-sidebar { width: 100%; border-right: none; display: ${showMobileSidebar ? 'flex' : 'none'}; }
          .chat-main { display: ${showMobileSidebar ? 'none' : 'flex'}; }
          .chat-back { display: flex; }
        }
      `}</style>

      <div className="chat-wrap">
        <StatusBar user={user} onLogout={logout} showBackButton onBackClick={() => navigate('/hub')} pageName="Chat" />

        {!unlocked ? (
          <div className="chat-body">
            <div className="chat-lock-wrap">
              <div className="chat-lock-card">
                <div className="chat-lock-icon">🔐</div>
                <div className="chat-lock-title">Sitzung abgelaufen</div>
                <div className="chat-lock-desc">Der verschlüsselte Chat ist nur direkt nach dem Login verfügbar. Bitte melde dich neu an.</div>
                <button className="chat-lock-btn" onClick={() => navigate('/login')}>Neu einloggen</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-body">
            {/* Sidebar */}
            <div className="chat-sidebar">
              <div className="chat-sidebar-header">
                <span className="chat-sidebar-title">Chat</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="chat-icon-btn" title="Neue Direktnachricht" onClick={() => setShowContacts(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </button>
                  <button className="chat-icon-btn" title="Neuer Kanal" onClick={() => setShowNewChannel(v => !v)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>

              {dms.length > 0 && (
                <>
                  <div className="chat-section-label">Direktnachrichten</div>
                  {dms.map(ch => (
                    <div key={ch.id} className={`chat-channel-item${activeChannel?.id === ch.id ? ' active' : ''}`} onClick={() => selectChannel(ch)}>
                      <div className="chat-avatar-sm">{(ch.other_user_name || '?')[0].toUpperCase()}</div>
                      <span className="chat-channel-name">{ch.other_user_name || 'Unbekannt'}</span>
                    </div>
                  ))}
                </>
              )}

              {groupChannels.length > 0 && (
                <>
                  <div className="chat-section-label">Kanäle</div>
                  {groupChannels.map(ch => (
                    <div key={ch.id} className={`chat-channel-item${activeChannel?.id === ch.id ? ' active' : ''}`} onClick={() => selectChannel(ch)}>
                      <div className="chat-channel-hash">#</div>
                      <span className="chat-channel-name">{ch.name}</span>
                    </div>
                  ))}
                </>
              )}

              {channels.length === 0 && (
                <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
                  Noch kein Chat.<br />Schreib jemandem oder erstell einen Kanal.
                </div>
              )}

              {showNewChannel && (
                <form className="chat-new-form" onSubmit={createChannel}>
                  <input className="chat-new-inp" placeholder="Kanal-Name" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} autoFocus />
                  <button className="chat-new-save" type="submit">Erstellen</button>
                </form>
              )}
            </div>

            {/* Main */}
            <div className="chat-main">
              {!activeChannel ? (
                <div className="chat-empty-main">Wähle einen Chat aus</div>
              ) : (
                <>
                  <div className="chat-main-header">
                    <button className="chat-back" onClick={() => { setActiveChannel(null); setShowMobileSidebar(true) }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                      Zurück
                    </button>
                    {activeChannel.is_direct
                      ? <div className="chat-avatar-sm" style={{ width: 28, height: 28, fontSize: 12 }}>{(activeChannel.other_user_name || '?')[0].toUpperCase()}</div>
                      : <div className="chat-channel-hash" style={{ width: 28, height: 28 }}>#</div>
                    }
                    <span className="chat-main-title">{activeChannel.is_direct ? activeChannel.other_user_name : activeChannel.name}</span>
                  </div>

                  <div className="chat-messages">
                    {messages.map(msg => (
                      <div key={msg.id} className={`chat-msg${msg.sender === user?.id ? ' own' : ''}`}>
                        {msg.sender !== user?.id && (
                          <div className="chat-avatar-msg">{msg.sender_name?.[0]?.toUpperCase() || '?'}</div>
                        )}
                        <div className="chat-bubble-wrap">
                          {msg.sender !== user?.id && <div className="chat-msg-name">{msg.sender_name}</div>}
                          <div className="chat-bubble">{msg.decrypted}</div>
                          <div className="chat-msg-time">{formatTime(msg.created)}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form className="chat-input-row" onSubmit={sendMessage}>
                    <textarea
                      className="chat-input"
                      placeholder={channelKey ? 'Nachricht...' : '🔒 Kein Zugriff'}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      disabled={!channelKey}
                      rows={1}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any) } }}
                    />
                    <button className="chat-send" type="submit" disabled={!input.trim() || !channelKey || sending}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contacts sheet */}
      {showContacts && (
        <div className="chat-contacts-overlay" onClick={() => setShowContacts(false)}>
          <div className="chat-contacts-sheet" onClick={e => e.stopPropagation()}>
            <div className="chat-contacts-title">Kontakt auswählen</div>
            <input
              className="chat-contacts-search"
              placeholder="Suchen..."
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              autoFocus
            />
            <div className="chat-contacts-list">
              {filteredContacts.map(u => (
                <div key={u.id} className="chat-contact-item" onClick={() => startDM(u)}>
                  <div className="chat-avatar-sm">{(u.name || u.email)[0].toUpperCase()}</div>
                  <div>
                    <div className="chat-contact-name">{u.name || u.email}</div>
                    {u.name && <div className="chat-contact-email">{u.email}</div>}
                  </div>
                </div>
              ))}
              {filteredContacts.length === 0 && (
                <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>Keine Kontakte gefunden</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
