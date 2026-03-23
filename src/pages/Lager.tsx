import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import StatusBar from '../components/StatusBar'

export default function Lager() {
  const { user, loading: authLoading, logout } = useAuth()
  const [locations, setLocations] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user?.organization_id) {
      loadLocations()
    }
  }, [user])

  async function loadLocations() {
    try {
      const locs = await pb.collection('inventory_locations').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: 'created'
      })
      console.log('Locations loaded:', locs)
      setLocations(locs)
    } catch(e) {
      console.error('Error:', e)
      setError(e.message)
    }
  }

  if (authLoading) return null

  return (
    <>
      <StatusBar user={user} onLogout={logout} pageName="Lager" showHubLink={true} />
      
      <div style={{padding: '2rem', background: '#fff', margin: '1rem', borderRadius: '12px'}}>
        <h2>Lager</h2>
        <p>User: {user?.email}</p>
        <p>Locations: {locations.length}</p>
        {error && <p style={{color: 'red'}}>Error: {error}</p>}
        {locations.map(loc => (
          <div key={loc.id}>{loc.name}</div>
        ))}
      </div>
    </>
  )
}
