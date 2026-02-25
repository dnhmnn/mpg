import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'
import StatusBar from '../components/StatusBar'

interface AusbildungenProps {
  user: User | null
}

type Tab = 'schulungen' | 'team' | 'lernbereich' | 'einstellungen'

// Types
interface TrainingCourse {
  id: string
  title: string
  description: string
  category: string
  type: 'online' | 'präsenz' | 'hybrid'
  duration_minutes: number
  valid_for_months: number
  is_mandatory: boolean
}

interface TrainingSession {
  id: string
  course_id: string
  date: string
  location: string
  max_participants: number
  status: 'geplant' | 'läuft' | 'abgeschlossen' | 'abgesagt'
  duration_minutes?: number
}

// Participant types
interface SessionParticipant {
  id: string
  session_id: string
  user_id: string
  user_name?: string
  user_email?: string
  status: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt'
  response_date?: string
}

// Course materials
interface CourseMaterial {
  id: string
  session_id: string
  title: string
  file_url: string
  file_type: 'dozent' | 'teilnehmer'
  uploaded_at: string
}

// Calendar helper functions
function getDayName(date: Date, short = false): string {
  const days = short
    ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    : ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
  return days[date.getDay() === 0 ? 6 : date.getDay() - 1]
}

function getMonthName(date: Date): string {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  return months[date.getMonth()]
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  phone?: string
}

interface LearningModule {
  id: string
  title: string
  description: string
  category: string
  is_active: boolean
}

interface LearningSlide {
  id: string
  module_id: string
  title: string
  content: string
  order: number
}

export default function Ausbildungen({ user }: AusbildungenProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('schulungen')

  // Data states
  const [courses, setCourses] = useState<TrainingCourse[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [modules, setModules] = useState<LearningModule[]>([])
  const [slides, setSlides] = useState<LearningSlide[]>([])

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Calendar state - removed unused

  // Modal states
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null)

  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)

  const [showModuleModal, setShowModuleModal] = useState(false)
  const [editingModule, setEditingModule] = useState<LearningModule | null>(null)
  const [showSlideModal, setShowSlideModal] = useState(false)
  const [editingSlide, setEditingSlide] = useState<LearningSlide | null>(null)
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(null)

  // Session detail modal
  const [showSessionDetail, setShowSessionDetail] = useState(false)
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)
  const [selectedSessionCourse, setSelectedSessionCourse] = useState<TrainingCourse | null>(null)
  const [sessionParticipants, setSessionParticipants] = useState<SessionParticipant[]>([])
  const [sessionMaterials, setSessionMaterials] = useState<CourseMaterial[]>([])
  const [availableUsers, setAvailableUsers] = useState<any[]>([])

  // Form states
  const [courseForm, setCourseForm] = useState({
    title: '', description: '', category: '', type: 'online' as 'online' | 'präsenz' | 'hybrid',
    duration_minutes: 60, valid_for_months: 12, is_mandatory: false
  })
  const [sessionForm, setSessionForm] = useState({
    date: '', location: '', max_participants: 10, status: 'geplant' as 'geplant' | 'läuft' | 'abgeschlossen' | 'abgesagt'
  })
  const [teamForm, setTeamForm] = useState({
    name: '', email: '', role: '', phone: ''
  })
  const [moduleForm, setModuleForm] = useState({
    title: '', description: '', category: '', is_active: true
  })
  const [slideForm, setSlideForm] = useState({
    title: '', content: ''
  })

  // Settings state
  const [, setOrgSettings] = useState<any>(null)
  const [mandatoryCourses, setMandatoryCourses] = useState<string[]>([])
  const [lernbarUsers, setLernbarUsers] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])

  useEffect(() => {
    if (!user) return
    loadAllData()
  }, [user, activeTab])

  async function loadAllData() {
    if (!user?.organization_id) return
    setLoading(true)

    try {
      if (activeTab === 'schulungen') {
        const [coursesData, sessionsData] = await Promise.all([
          pb.collection('training_courses').getFullList({
            filter: `organization_id = "${user.organization_id}"`
          }),
          pb.collection('training_sessions').getFullList()
        ])
        const courses = coursesData as unknown as TrainingCourse[]
        const sessions = (sessionsData as unknown as TrainingSession[]).map(session => {
          const course = courses.find(c => c.id === session.course_id)
          return {
            ...session,
            duration_minutes: course?.duration_minutes || 60
          }
        })
        setCourses(courses)
        setSessions(sessions)
      } else if (activeTab === 'team') {
        const membersData = await pb.collection('team_members').getFullList({
          filter: `organization_id = "${user.organization_id}"`
        })
        setTeamMembers(membersData as unknown as TeamMember[])
      } else if (activeTab === 'lernbereich') {
        const [modulesData, slidesData] = await Promise.all([
          pb.collection('learning_modules').getFullList({
            filter: `organization_id = "${user.organization_id}"`
          }),
          pb.collection('learning_slides').getFullList()
        ])
        setModules(modulesData as unknown as LearningModule[])
        setSlides(slidesData as unknown as LearningSlide[])
      } else if (activeTab === 'einstellungen') {
        const [orgData, usersData] = await Promise.all([
          pb.collection('organizations').getOne(user.organization_id),
          pb.collection('users').getFullList({
            filter: `organization_id = "${user.organization_id}"`
          })
        ])
        setOrgSettings(orgData)
        setAllUsers(usersData)
        setMandatoryCourses(orgData?.mandatory_trainings || [])
        setLernbarUsers(orgData?.lernbar_users || [])
      }
    } catch (e) {
      console.error('Error loading data:', e)
    } finally {
      setLoading(false)
    }
  }

  // Course functions
  function openAddCourse() {
    setEditingCourse(null)
    setCourseForm({ title: '', description: '', category: '', type: 'online', duration_minutes: 60, valid_for_months: 12, is_mandatory: false })
    setShowCourseModal(true)
  }

  function openEditCourse(course: TrainingCourse) {
    setEditingCourse(course)
    setCourseForm({
      title: course.title,
      description: course.description,
      category: course.category,
      type: course.type,
      duration_minutes: course.duration_minutes,
      valid_for_months: course.valid_for_months,
      is_mandatory: course.is_mandatory
    })
    setShowCourseModal(true)
  }

  async function saveCourse() {
    if (!user?.organization_id) return
    try {
      const data = {
        ...courseForm,
        organization_id: user.organization_id
      }

      if (editingCourse) {
        await pb.collection('training_courses').update(editingCourse.id, data)
        setMessage('✅ Schulung aktualisiert!')
      } else {
        await pb.collection('training_courses').create(data)
        setMessage('✅ Schulung erstellt!')
      }
      setTimeout(() => setShowCourseModal(false), 1000)
      loadAllData()
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  async function deleteCourse(courseId: string) {
    if (!confirm('Möchten Sie diese Schulung wirklich löschen?')) return
    try {
      await pb.collection('training_courses').delete(courseId)
      setMessage('✅ Schulung gelöscht!')
      loadAllData()
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  function openAddSession(course: TrainingCourse) {
    setSelectedCourse(course)
    setEditingSession(null)
    setSessionForm({ date: '', location: '', max_participants: 10, status: 'geplant' })
    setShowSessionModal(true)
  }

  async function openSessionDetail(session: TrainingSession) {
    const course = courses.find(c => c.id === session.course_id)
    setSelectedSession(session)
    setSelectedSessionCourse(course || null)
    setShowSessionDetail(true)

    // Load participants
    try {
      const participantsData = await pb.collection('session_participants').getFullList({
        filter: `session_id = "${session.id}"`
      })
      const participants = participantsData as unknown as SessionParticipant[]

      // Get user details for each participant
      const usersData = await pb.collection('users').getFullList()
      const usersMap = new Map(usersData.map((u: any) => [u.id, u]))

      const participantsWithUser = participants.map((p: any) => {
        const user = usersMap.get(p.user_id)
        return {
          ...p,
          user_name: user?.name || user?.email || 'Unbekannt',
          user_email: user?.email || ''
        }
      })
      setSessionParticipants(participantsWithUser)
    } catch (e) {
      console.log('No participants yet')
      setSessionParticipants([])
    }

    // Load materials
    try {
      const materialsData = await pb.collection('session_materials').getFullList({
        filter: `session_id = "${session.id}"`
      })
      setSessionMaterials(materialsData as unknown as CourseMaterial[])
    } catch (e) {
      console.log('No materials yet')
      setSessionMaterials([])
    }

    // Load available users for adding participants
    try {
      const usersData = await pb.collection('users').getFullList({
        filter: `organization_id = "${user?.organization_id}"`
      })
      setAvailableUsers(usersData)
    } catch (e) {
      setAvailableUsers([])
    }
  }

  // Add participant to session
  async function addParticipant(userId: string) {
    if (!selectedSession) return
    try {
      await pb.collection('session_participants').create({
        session_id: selectedSession.id,
        user_id: userId,
        status: 'eingeladen'
      })
      openSessionDetail(selectedSession) // Refresh
      setMessage('✅ Teilnehmer eingeladen!')
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  // Update participant status
  async function updateParticipantStatus(participantId: string, status: 'zugesagt' | 'abgesagt' | 'entschuldigt') {
    try {
      await pb.collection('session_participants').update(participantId, {
        status,
        response_date: new Date().toISOString()
      })
      if (selectedSession) {
        openSessionDetail(selectedSession) // Refresh
      }
      setMessage('✅ Status aktualisiert!')
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  // Remove participant
  async function removeParticipant(participantId: string) {
    if (!confirm('Möchten Sie diesen Teilnehmer entfernen?')) return
    try {
      await pb.collection('session_participants').delete(participantId)
      if (selectedSession) {
        openSessionDetail(selectedSession) // Refresh
      }
      setMessage('✅ Teilnehmer entfernt!')
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  // Get share link
  function getShareLink() {
    if (!selectedSession || !selectedSessionCourse) return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/schulung/${selectedSession.id}`
  }

  // Share via WhatsApp
  function shareViaWhatsApp() {
    if (!selectedSession || !selectedSessionCourse) return
    const link = getShareLink()
    const text = `${selectedSessionCourse.title}\nDatum: ${new Date(selectedSession.date).toLocaleDateString('de-DE')}\nOrt: ${selectedSession.location}\n${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // Share via Email
  function shareViaEmail() {
    if (!selectedSession || !selectedSessionCourse) return
    const link = getShareLink()
    const subject = encodeURIComponent(`Schulung: ${selectedSessionCourse.title}`)
    const body = encodeURIComponent(`${selectedSessionCourse.title}\n\nDatum: ${new Date(selectedSession.date).toLocaleDateString('de-DE')}\nUhrzeit: ${new Date(selectedSession.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}\nOrt: ${selectedSession.location}\n\n${selectedSessionCourse.description || ''}\n\nLink: ${link}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  async function saveSession() {
    if (!selectedCourse) return
    try {
      const data = {
        ...sessionForm,
        course_id: selectedCourse.id,
        organization_id: user?.organization_id
      }

      if (editingSession) {
        await pb.collection('training_sessions').update(editingSession.id, data)
        setMessage('✅ Termin aktualisiert!')
      } else {
        await pb.collection('training_sessions').create(data)
        setMessage('✅ Termin erstellt!')
      }
      setTimeout(() => setShowSessionModal(false), 1000)
      loadAllData()
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  // Team functions
  function openAddMember() {
    setEditingMember(null)
    setTeamForm({ name: '', email: '', role: '', phone: '' })
    setShowTeamModal(true)
  }

  function openEditMember(member: TeamMember) {
    setEditingMember(member)
    setTeamForm({
      name: member.name,
      email: member.email,
      role: member.role,
      phone: member.phone || ''
    })
    setShowTeamModal(true)
  }

  async function saveMember() {
    if (!user?.organization_id) return
    try {
      const data = {
        ...teamForm,
        organization_id: user.organization_id
      }

      if (editingMember) {
        await pb.collection('team_members').update(editingMember.id, data)
        setMessage('✅ Teammitglied aktualisiert!')
      } else {
        await pb.collection('team_members').create(data)
        setMessage('✅ Teammitglied hinzugefügt!')
      }
      setTimeout(() => setShowTeamModal(false), 1000)
      loadAllData()
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  async function deleteMember(memberId: string) {
    if (!confirm('Möchten Sie dieses Teammitglied wirklich löschen?')) return
    try {
      await pb.collection('team_members').delete(memberId)
      setMessage('✅ Teammitglied gelöscht!')
      loadAllData()
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  // Module functions
  function openAddModule() {
    setEditingModule(null)
    setModuleForm({ title: '', description: '', category: '', is_active: true })
    setShowModuleModal(true)
  }

  function openEditModule(module: LearningModule) {
    setEditingModule(module)
    setModuleForm({
      title: module.title,
      description: module.description,
      category: module.category,
      is_active: module.is_active
    })
    setShowModuleModal(true)
  }

  async function saveModule() {
    if (!user?.organization_id) return
    try {
      const data = {
        ...moduleForm,
        organization_id: user.organization_id
      }

      if (editingModule) {
        await pb.collection('learning_modules').update(editingModule.id, data)
        setMessage('✅ Modul aktualisiert!')
      } else {
        await pb.collection('learning_modules').create(data)
        setMessage('✅ Modul erstellt!')
      }
      setTimeout(() => setShowModuleModal(false), 1000)
      loadAllData()
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  async function deleteModule(moduleId: string) {
    if (!confirm('Möchten Sie dieses Modul wirklich löschen?')) return
    try {
      await pb.collection('learning_modules').delete(moduleId)
      setMessage('✅ Modul gelöscht!')
      loadAllData()
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  function openAddSlide(module: LearningModule) {
    setSelectedModule(module)
    setEditingSlide(null)
    setSlideForm({ title: '', content: '' })
    setShowSlideModal(true)
  }

  async function saveSlide() {
    if (!selectedModule) return
    try {
      const moduleSlides = slides.filter(s => s.module_id === selectedModule.id)
      const data = {
        ...slideForm,
        module_id: selectedModule.id,
        order: moduleSlides.length,
        organization_id: user?.organization_id
      }

      if (editingSlide) {
        await pb.collection('learning_slides').update(editingSlide.id, data)
        setMessage('✅ Folie aktualisiert!')
      } else {
        await pb.collection('learning_slides').create(data)
        setMessage('✅ Folie erstellt!')
      }
      setTimeout(() => setShowSlideModal(false), 1000)
      loadAllData()
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  // Settings functions
  async function saveSettings() {
    if (!user?.organization_id) return
    try {
      await pb.collection('organizations').update(user.organization_id, {
        mandatory_trainings: mandatoryCourses,
        lernbar_users: lernbarUsers
      })
      setMessage('✅ Einstellungen gespeichert!')
      setTimeout(() => setMessage(''), 3000)
    } catch (e: any) {
      setMessage('❌ Fehler: ' + e.message)
    }
  }

  const canManage = user?.supervisor || user?.role === 'mpg' || user?.role === 'ausbildung'

  return (
    <div className="ausbildungen-page">
      <StatusBar
        user={user}
        onLogout={() => {
          pb.authStore.clear()
          localStorage.clear()
          navigate('/login')
        }}
        showBackButton={true}
        onBackClick={() => navigate('/hub')}
      />

      <div className="ausbildungen-content">
        {/* Tabs */}
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'schulungen' ? 'active' : ''}`}
            onClick={() => setActiveTab('schulungen')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            Schulungen
          </button>
          <button
            className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Team
          </button>
          <button
            className={`tab-btn ${activeTab === 'lernbereich' ? 'active' : ''}`}
            onClick={() => setActiveTab('lernbereich')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            Lernbereich
          </button>
          <button
            className={`tab-btn ${activeTab === 'einstellungen' ? 'active' : ''}`}
            onClick={() => setActiveTab('einstellungen')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Einstellungen
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {/* Schulungen Tab */}
        {activeTab === 'schulungen' && (
          <div className="tab-content">
            {/* Simple chronological list - no calendar navigation */}
            <div className="appointments-list">
              <h2 className="section-title">Alle Termine</h2>

              {loading ? (
                <div className="loading">Lade Schulungen...</div>
              ) : sessions.length === 0 ? (
                <div className="empty-state">
                  <p>Noch keine Schulungen vorhanden.</p>
                  {canManage && <button className="action-btn primary" onClick={openAddCourse}>+ Termin hinzufügen</button>}
                </div>
              ) : (
                /* All sessions sorted chronologically */
                sessions
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((session) => {
                    const course = courses.find(c => c.id === session.course_id)

                    return (
                      <div key={session.id} className="appointment-item" onClick={() => openSessionDetail(session)}>
                        <div className="appointment-title">{course?.title || 'Schulung'}</div>
                      </div>
                    )
                  })
              )}
            </div>

            {/* Add buttons */}
            {canManage && (
              <div className="calendar-actions">
                <button className="action-btn primary" onClick={openAddCourse}>
                  + Neue Schulung
                </button>
              </div>
            )}
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Team</h2>
              {canManage && (
                <button className="action-btn primary" onClick={openAddMember}>
                  + Neues Mitglied
                </button>
              )}
            </div>

            {loading ? (
              <div className="loading">Lade Team...</div>
            ) : teamMembers.length === 0 ? (
              <div className="empty-state">
                <p>Noch keine Teammitglieder vorhanden.</p>
                {canManage && <button className="action-btn primary" onClick={openAddMember}>Erstes Mitglied hinzufügen</button>}
              </div>
            ) : (
              <div className="cards-grid">
                {teamMembers.map(member => (
                  <div key={member.id} className="card">
                    <div className="card-header">
                      <h3>{member.name}</h3>
                      <span className="badge info">{member.role}</span>
                    </div>
                    <p className="card-meta">{member.email}</p>
                    {member.phone && <p className="card-meta">{member.phone}</p>}
                    {canManage && (
                      <div className="card-actions">
                        <button onClick={() => openEditMember(member)}>Bearbeiten</button>
                        <button onClick={() => deleteMember(member.id)} className="delete">Löschen</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lernbereich Tab */}
        {activeTab === 'lernbereich' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Lernbereich</h2>
              {canManage && (
                <button className="action-btn primary" onClick={openAddModule}>
                  + Neues Modul
                </button>
              )}
            </div>

            {loading ? (
              <div className="loading">Lade Module...</div>
            ) : modules.length === 0 ? (
              <div className="empty-state">
                <p>Noch keine Lernmodule vorhanden.</p>
                {canManage && <button className="action-btn primary" onClick={openAddModule}>Erstes Modul erstellen</button>}
              </div>
            ) : (
              <div className="cards-grid">
                {modules.map(module => {
                  const moduleSlides = slides.filter(s => s.module_id === module.id)
                  return (
                    <div key={module.id} className="card">
                      <div className="card-header">
                        <h3>{module.title}</h3>
                        <span className={`badge ${module.is_active ? 'success' : 'warning'}`}>
                          {module.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <p className="card-description">{module.description}</p>
                      <div className="card-meta">
                        <span><i className="fas fa-file-alt"></i> {moduleSlides.length} Folien</span>
                        <span><i className="fas fa-folder"></i> {module.category}</span>
                      </div>
                      {canManage && (
                        <div className="card-actions">
                          <button onClick={() => openAddSlide(module)}>+ Folie</button>
                          <button onClick={() => openEditModule(module)}>Bearbeiten</button>
                          <button onClick={() => deleteModule(module.id)} className="delete">Löschen</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Einstellungen Tab */}
        {activeTab === 'einstellungen' && canManage && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Einstellungen</h2>
            </div>

            <div className="settings-section">
              <h3>Pflicht-Schulungen</h3>
              <p className="settings-description">Wählen Sie aus, welche Schulungen für alle Mitglieder pflichtig sind.</p>
              <div className="checkbox-list">
                {courses.map(course => (
                  <label key={course.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={mandatoryCourses.includes(course.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMandatoryCourses([...mandatoryCourses, course.id])
                        } else {
                          setMandatoryCourses(mandatoryCourses.filter(id => id !== course.id))
                        }
                      }}
                    />
                    <span>{course.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3>Lernbar-Zugriff</h3>
              <p className="settings-description">Wählen Sie aus, welche Benutzer Zugriff auf Lernbar haben.</p>
              <div className="checkbox-list">
                {allUsers.map(u => (
                  <label key={u.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={lernbarUsers.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setLernbarUsers([...lernbarUsers, u.id])
                        } else {
                          setLernbarUsers(lernbarUsers.filter(id => id !== u.id))
                        }
                      }}
                    />
                    <span>{u.name || u.email}</span>
                  </label>
                ))}
              </div>
            </div>

            <button className="action-btn success" onClick={saveSettings}>
              Einstellungen speichern
            </button>
          </div>
        )}
      </div>

      {/* Course Modal */}
      {showCourseModal && (
        <div className="modal-overlay" onClick={() => setShowCourseModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCourse ? 'Schulung bearbeiten' : 'Neue Schulung'}</h3>
              <button className="modal-close" onClick={() => setShowCourseModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Titel</label>
                <input type="text" value={courseForm.title} onChange={e => setCourseForm({...courseForm, title: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Beschreibung</label>
                <textarea value={courseForm.description} onChange={e => setCourseForm({...courseForm, description: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Kategorie</label>
                <input type="text" value={courseForm.category} onChange={e => setCourseForm({...courseForm, category: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Typ</label>
                <select value={courseForm.type} onChange={e => setCourseForm({...courseForm, type: e.target.value as any})}>
                  <option value="online">Online</option>
                  <option value="präsenz">Präsenz</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Dauer (Min.)</label>
                  <input type="number" value={courseForm.duration_minutes} onChange={e => setCourseForm({...courseForm, duration_minutes: parseInt(e.target.value)})} />
                </div>
                <div className="form-field">
                  <label>Gültig (Monate)</label>
                  <input type="number" value={courseForm.valid_for_months} onChange={e => setCourseForm({...courseForm, valid_for_months: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="form-field checkbox">
                <label>
                  <input type="checkbox" checked={courseForm.is_mandatory} onChange={e => setCourseForm({...courseForm, is_mandatory: e.target.checked})} />
                  Pflichtschulung
                </label>
              </div>
              <button className="action-btn primary" onClick={saveCourse}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {showSessionModal && selectedCourse && (
        <div className="modal-overlay" onClick={() => setShowSessionModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Neuer Termin für {selectedCourse.title}</h3>
              <button className="modal-close" onClick={() => setShowSessionModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Datum</label>
                <input type="datetime-local" value={sessionForm.date} onChange={e => setSessionForm({...sessionForm, date: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Ort</label>
                <input type="text" value={sessionForm.location} onChange={e => setSessionForm({...sessionForm, location: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Max. Teilnehmer</label>
                <input type="number" value={sessionForm.max_participants} onChange={e => setSessionForm({...sessionForm, max_participants: parseInt(e.target.value)})} />
              </div>
              <div className="form-field">
                <label>Status</label>
                <select value={sessionForm.status} onChange={e => setSessionForm({...sessionForm, status: e.target.value as any})}>
                  <option value="geplant">Geplant</option>
                  <option value="läuft">Läuft</option>
                  <option value="abgeschlossen">Abgeschlossen</option>
                  <option value="abgesagt">Abgesagt</option>
                </select>
              </div>
              <button className="action-btn primary" onClick={saveSession}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingMember ? 'Mitglied bearbeiten' : 'Neues Mitglied'}</h3>
              <button className="modal-close" onClick={() => setShowTeamModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Name</label>
                <input type="text" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} />
              </div>
              <div className="form-field">
                <label>E-Mail</label>
                <input type="email" value={teamForm.email} onChange={e => setTeamForm({...teamForm, email: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Rolle</label>
                <input type="text" value={teamForm.role} onChange={e => setTeamForm({...teamForm, role: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Telefon</label>
                <input type="tel" value={teamForm.phone} onChange={e => setTeamForm({...teamForm, phone: e.target.value})} />
              </div>
              <button className="action-btn primary" onClick={saveMember}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Module Modal */}
      {showModuleModal && (
        <div className="modal-overlay" onClick={() => setShowModuleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingModule ? 'Modul bearbeiten' : 'Neues Modul'}</h3>
              <button className="modal-close" onClick={() => setShowModuleModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Titel</label>
                <input type="text" value={moduleForm.title} onChange={e => setModuleForm({...moduleForm, title: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Beschreibung</label>
                <textarea value={moduleForm.description} onChange={e => setModuleForm({...moduleForm, description: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Kategorie</label>
                <input type="text" value={moduleForm.category} onChange={e => setModuleForm({...moduleForm, category: e.target.value})} />
              </div>
              <div className="form-field checkbox">
                <label>
                  <input type="checkbox" checked={moduleForm.is_active} onChange={e => setModuleForm({...moduleForm, is_active: e.target.checked})} />
                  Aktiv
                </label>
              </div>
              <button className="action-btn primary" onClick={saveModule}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Slide Modal */}
      {showSlideModal && selectedModule && (
        <div className="modal-overlay" onClick={() => setShowSlideModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Neue Folie für {selectedModule.title}</h3>
              <button className="modal-close" onClick={() => setShowSlideModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Titel</label>
                <input type="text" value={slideForm.title} onChange={e => setSlideForm({...slideForm, title: e.target.value})} />
              </div>
              <div className="form-field">
                <label>Inhalt</label>
                <textarea value={slideForm.content} onChange={e => setSlideForm({...slideForm, content: e.target.value})} rows={6} />
              </div>
              <button className="action-btn primary" onClick={saveSlide}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {showSessionDetail && selectedSession && selectedSessionCourse && (
        <div className="modal-overlay" onClick={() => setShowSessionDetail(false)}>
          <div className="modal-content session-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedSessionCourse.title}</h3>
              <button className="modal-close" onClick={() => setShowSessionDetail(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Session Info */}
              <div className="session-info">
                <div className="info-row">
                  <span className="info-label">Datum:</span>
                  <span className="info-value">{new Date(selectedSession.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Uhrzeit:</span>
                  <span className="info-value">{new Date(selectedSession.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Ort:</span>
                  <span className="info-value">{selectedSession.location}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Typ:</span>
                  <span className="info-value badge">{selectedSessionCourse.type}</span>
                </div>
                {selectedSessionCourse.description && (
                  <div className="info-row">
                    <span className="info-label">Beschreibung:</span>
                    <span className="info-value">{selectedSessionCourse.description}</span>
                  </div>
                )}
              </div>

              {/* Share Section */}
              <div className="detail-section">
                <h4>Teilen</h4>
                <div className="share-buttons">
                  <button className="share-btn whatsapp" onClick={shareViaWhatsApp}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                  <button className="share-btn email" onClick={shareViaEmail}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    E-Mail
                  </button>
                  <button className="share-btn link" onClick={() => { navigator.clipboard.writeText(getShareLink()); setMessage('✅ Link kopiert!'); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    Link kopieren
                  </button>
                </div>
              </div>

              {/* Participants Section */}
              <div className="detail-section">
                <h4>Teilnehmer ({sessionParticipants.length})</h4>

                {sessionParticipants.length === 0 ? (
                  <p className="empty-text">Noch keine Teilnehmer eingeladen.</p>
                ) : (
                  <div className="participants-list">
                    {sessionParticipants.map(participant => (
                      <div key={participant.id} className="participant-item">
                        <div className="participant-info">
                          <span className="participant-name">{participant.user_name}</span>
                          <span className={`participant-status badge ${participant.status}`}>
                            {participant.status === 'eingeladen' ? 'Eingeladen' :
                             participant.status === 'zugesagt' ? 'Zugesagt' :
                             participant.status === 'abgesagt' ? 'Abgesagt' : 'Entschuldigt'}
                          </span>
                        </div>
                        {canManage && (
                          <div className="participant-actions">
                            <button onClick={() => updateParticipantStatus(participant.id, 'zugesagt')} title="Zusagen">
                              ✓
                            </button>
                            <button onClick={() => updateParticipantStatus(participant.id, 'abgesagt')} title="Absagen">
                              ✗
                            </button>
                            <button onClick={() => updateParticipantStatus(participant.id, 'entschuldigt')} title="Entschuldigen">
                              E
                            </button>
                            <button onClick={() => removeParticipant(participant.id)} className="delete" title="Entfernen">
                              🗑
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Participant */}
                {canManage && availableUsers.length > 0 && (
                  <div className="add-participant">
                    <select
                      onChange={(e) => { if (e.target.value) { addParticipant(e.target.value); e.target.value = ''; } }}
                      defaultValue=""
                    >
                      <option value="">+ Teilnehmer hinzufügen...</option>
                      {availableUsers
                        .filter(u => !sessionParticipants.some(p => p.user_id === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.name || u.email}</option>
                        ))
                      }
                    </select>
                  </div>
                )}
              </div>

              {/* Course Materials Section */}
              <div className="detail-section">
                <h4>Unterlagen</h4>

                {sessionMaterials.length === 0 ? (
                  <p className="empty-text">Noch keine Unterlagen hochgeladen.</p>
                ) : (
                  <div className="materials-list">
                    {sessionMaterials.map(material => (
                      <div key={material.id} className="material-item">
                        <div className="material-info">
                          <span className="material-title">{material.title}</span>
                          <span className={`material-type badge ${material.file_type}`}>
                            {material.file_type === 'dozent' ? 'Dozent' : 'Teilnehmer'}
                          </span>
                        </div>
                        <a href={material.file_url} target="_blank" rel="noopener noreferrer" className="material-download">
                          Öffnen
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Material (placeholder - would need file upload implementation) */}
                {canManage && (
                  <div className="add-material">
                    <p className="hint-text">Dateien können über die PocketBase Admin-Oberfläche hochgeladen werden.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
