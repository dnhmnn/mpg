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
        setCourses(coursesData as unknown as TrainingCourse[])
        setSessions(sessionsData as unknown as TrainingSession[])
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
            <div className="section-header">
              <h2>Schulungen</h2>
              {canManage && (
                <button className="action-btn primary" onClick={openAddCourse}>
                  + Neue Schulung
                </button>
              )}
            </div>

            {loading ? (
              <div className="loading">Lade Schulungen...</div>
            ) : courses.length === 0 ? (
              <div className="empty-state">
                <p>Noch keine Schulungen vorhanden.</p>
                {canManage && <button className="action-btn primary" onClick={openAddCourse}>Erste Schulung erstellen</button>}
              </div>
            ) : (
              <div className="cards-grid">
                {courses.map(course => {
                  const courseSessions = sessions.filter(s => s.course_id === course.id)
                  return (
                    <div key={course.id} className="card">
                      <div className="card-header">
                        <h3>{course.title}</h3>
                        <span className={`badge ${course.type}`}>{course.type}</span>
                      </div>
                      <p className="card-description">{course.description}</p>
                      <div className="card-meta">
                        <span><i className="fas fa-clock"></i> {course.duration_minutes} Min.</span>
                        <span><i className="fas fa-calendar"></i> {course.valid_for_months} Monate</span>
                        {course.is_mandatory && <span className="badge mandatory">Pflicht</span>}
                      </div>
                      <div className="card-sessions">
                        <strong>Termine:</strong> {courseSessions.length}
                      </div>
                      {canManage && (
                        <div className="card-actions">
                          <button onClick={() => openAddSession(course)}>+ Termin</button>
                          <button onClick={() => openEditCourse(course)}>Bearbeiten</button>
                          <button onClick={() => deleteCourse(course.id)} className="delete">Löschen</button>
                        </div>
                      )}
                    </div>
                  )
                })}
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
