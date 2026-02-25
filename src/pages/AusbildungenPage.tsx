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

// Calendar helper functions
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0]
}

function getWeekDays(date: Date): Date[] {
  const days: Date[] = []
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Monday start
  startOfWeek.setDate(diff)

  for (let i = 0; i < 7; i++) {
    days.push(new Date(startOfWeek))
    startOfWeek.setDate(startOfWeek.getDate() + 1)
  }
  return days
}

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

  // Calendar state
  const [calendarView, setCalendarView] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())

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

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

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
            {/* Calendar Header */}
            <div className="calendar-header">
              <div className="calendar-nav">
                <button className="calendar-nav-btn" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <button className="today-btn" onClick={() => setSelectedDate(new Date())}>Heute</button>
                <button className="calendar-nav-btn" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
              <div className="calendar-date">
                <span className="calendar-day-name">{getDayName(selectedDate)}</span>
                <span className="calendar-date-number">{selectedDate.getDate()}.</span>
                <span className="calendar-month">{getMonthName(selectedDate)}</span>
              </div>
              <div className="calendar-view-toggle">
                <button
                  className={`view-toggle-btn ${calendarView === 'calendar' ? 'active' : ''}`}
                  onClick={() => setCalendarView('calendar')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </button>
                <button
                  className={`view-toggle-btn ${calendarView === 'list' ? 'active' : ''}`}
                  onClick={() => setCalendarView('list')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Week Strip */}
            <div className="week-strip">
              {getWeekDays(selectedDate).map((day, index) => (
                <button
                  key={index}
                  className={`week-day ${isSameDay(day, selectedDate) ? 'selected' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <span className="week-day-name">{getDayName(day, true)}</span>
                  <span className="week-day-number">{day.getDate()}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="loading">Lade Schulungen...</div>
            ) : calendarView === 'calendar' ? (
              /* Timeline View - Chronological Day Schedule */
              <div className="timeline-view">
                {/* Timeline header with hours */}
                <div className="timeline-header">
                  <span className="timeline-date-label">{getDayName(selectedDate)}, {selectedDate.getDate()}. {getMonthName(selectedDate)}</span>
                </div>

                {/* Timeline events - sorted by time */}
                {sessions
                  .filter(session => {
                    const sessionDate = new Date(session.date)
                    return isSameDay(sessionDate, selectedDate)
                  })
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .length === 0 ? (
                  <div className="empty-state">
                    <p>Keine Schulungen an diesem Tag.</p>
                    {canManage && <button className="action-btn primary" onClick={openAddCourse}>+ Termin hinzufügen</button>}
                  </div>
                ) : (
                  <div className="timeline-events">
                    {/* Current time indicator */}
                    {isSameDay(selectedDate, new Date()) && (
                      <div className="timeline-now">
                        <span className="timeline-now-dot" />
                        <span className="timeline-now-time">
                          Jetzt ({currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </div>
                    )}

                    {sessions
                      .filter(session => {
                        const sessionDate = new Date(session.date)
                        return isSameDay(sessionDate, selectedDate)
                      })
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((session) => {
                        const sessionDate = new Date(session.date)
                        const course = courses.find(c => c.id === session.course_id)
                        const duration = session.duration_minutes || 60
                        const endTime = new Date(sessionDate.getTime() + duration * 60000)

                        // Check if event is in the past, present, or future
                        const now = new Date()
                        const isPast = sessionDate.getTime() < now.getTime()
                        const isCurrent = sessionDate.getTime() <= now.getTime() && endTime.getTime() > now.getTime()

                        return (
                          <div key={session.id} className={`timeline-event ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${course?.type || 'online'}`}>
                            {/* Timeline line */}
                            <div className="timeline-line">
                              <div className="timeline-dot" />
                            </div>

                            {/* Event content */}
                            <div className="timeline-event-content" onClick={() => course && openEditCourse(course)}>
                              <div className="timeline-time">
                                <span className="timeline-start">{sessionDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="timeline-duration">- {endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="timeline-length">({duration} Min.)</span>
                              </div>
                              <div className="timeline-event-title">{course?.title || 'Schulung'}</div>
                              <div className="timeline-event-meta">
                                <span className="timeline-location">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                  </svg>
                                  {session.location}
                                </span>
                                <span className={`timeline-status badge ${session.status}`}>{session.status}</span>
                                {course?.is_mandatory && <span className="badge mandatory">Pflicht</span>}
                              </div>
                              {course?.description && (
                                <div className="timeline-description">{course.description}</div>
                              )}
                              {canManage && course && (
                                <div className="timeline-actions" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => openAddSession(course)}>+ Termin</button>
                                  <button onClick={() => openEditCourse(course)}>Bearbeiten</button>
                                  <button onClick={() => deleteCourse(course.id)} className="delete">Löschen</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            ) : (
              /* List View */
              <div className="list-view">
                {sessions
                  .filter(session => {
                    const sessionDate = new Date(session.date)
                    return isSameDay(sessionDate, selectedDate)
                  })
                  .length === 0 ? (
                  <div className="empty-state">
                    <p>Keine Schulungen an diesem Tag.</p>
                    {canManage && <button className="action-btn primary" onClick={() => {}}>+ Termin hinzufügen</button>}
                  </div>
                ) : (
                  sessions
                    .filter(session => {
                      const sessionDate = new Date(session.date)
                      return isSameDay(sessionDate, selectedDate)
                    })
                    .map(session => {
                      const sessionDate = new Date(session.date)
                      const course = courses.find(c => c.id === session.course_id)

                      return (
                        <div key={session.id} className="list-event">
                          <div className="list-event-time">
                            {sessionDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="list-event-content">
                            <div className="list-event-title">{course?.title || 'Schulung'}</div>
                            <div className="list-event-details">
                              <span>{session.location}</span>
                              <span className={`badge ${session.status}`}>{session.status}</span>
                              {canManage && course && (
                                <>
                                  <button className="btn-sm" onClick={() => openAddSession(course)}>+ Termin</button>
                                  <button className="btn-sm" onClick={() => openEditCourse(course)}>Bearbeiten</button>
                                  <button className="btn-sm delete" onClick={() => deleteCourse(course.id)}>Löschen</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            )}

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
    </div>
  )
}
