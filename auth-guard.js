// auth-guard.js - Rollen-basierte Zugriffskontrolle
import { NhostClient } from "https://esm.sh/@nhost/nhost-js@2.2.9";

const nhost = new NhostClient({
  subdomain: "hpjfrhktprpuuxvvlpsb",
  region: "eu-central-1"
});

/**
 * Prüft ob User eingeloggt ist und die richtige Rolle hat
 * @param {string[]} allowedRoles - Array von erlaubten Rollen, z.B. ['admin', 'lager']
 * @param {string} redirectUrl - Wohin bei Fehler redirecten (default: admin-login.html)
 */
export async function requireAuth(allowedRoles = [], redirectUrl = 'admin-login.html') {
  try {
    // 1. Ist User eingeloggt?
    const isAuth = await nhost.auth.isAuthenticatedAsync();
    if (!isAuth) {
      console.log('🔒 Nicht eingeloggt - Redirect zu Login');
      location.href = redirectUrl;
      throw new Error('Not authenticated');
    }

    // 2. User-Daten holen
    const user = nhost.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      console.log('🔒 Keine User-ID - Redirect zu Login');
      location.href = redirectUrl;
      throw new Error('No user ID');
    }

    // 3. Rolle aus Datenbank laden
    const token = await nhost.auth.getAccessToken();
    const headers = { 
      "Content-Type": "application/json", 
      "Authorization": "Bearer " + token 
    };
    const endpoint = `https://hpjfrhktprpuuxvvlpsb.graphql.eu-central-1.nhost.run/v1`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `
          query GetUserRole($userId: uuid!) {
            user_profiles(where: {user_id: {_eq: $userId}}) {
              role
              name
            }
          }
        `,
        variables: { userId }
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL Error:', result.errors);
      throw new Error('Error fetching user role');
    }

    const profile = result.data?.user_profiles?.[0];
    
    if (!profile) {
      console.log('🔒 Kein Profil gefunden - Redirect zu Login');
      location.href = redirectUrl;
      throw new Error('No user profile found');
    }

    const userRole = profile.role;
    const userName = profile.name;

    console.log(`✅ User: ${user.email}, Rolle: ${userRole}`);

    // 4. Rolle prüfen (wenn allowedRoles nicht leer)
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      console.log(`🚫 Zugriff verweigert! Erforderlich: ${allowedRoles.join(', ')}, Hat: ${userRole}`);
      alert(`Zugriff verweigert!\n\nDiese Seite ist nur für: ${allowedRoles.join(', ')}\nDeine Rolle: ${userRole}`);
      location.href = getRedirectForRole(userRole);
      throw new Error('Access denied');
    }

    // 5. Erfolg!
    return {
      user,
      userId,
      userEmail: user.email,
      userRole,
      userName,
      nhost
    };

  } catch (error) {
    console.error('Auth Guard Error:', error);
    throw error;
  }
}

/**
 * Leitet User zur passenden Seite basierend auf Rolle
 */
function getRedirectForRole(role) {
  switch (role) {
    case 'admin':
      return 'admin-dashboard.html';
    case 'mitglied':
      return 'mitglieder-dashboard.html';
    case 'lager':
      return 'lagerverwaltung.html';
    default:
      return 'admin-login.html';
  }
}

/**
 * Holt User-Rolle (ohne Redirect)
 */
export async function getUserRole() {
  try {
    const user = nhost.auth.getUser();
    if (!user) return null;

    const token = await nhost.auth.getAccessToken();
    const endpoint = `https://hpjfrhktprpuuxvvlpsb.graphql.eu-central-1.nhost.run/v1`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": "Bearer " + token 
      },
      body: JSON.stringify({
        query: `
          query GetUserRole($userId: uuid!) {
            user_profiles(where: {user_id: {_eq: $userId}}) {
              role
            }
          }
        `,
        variables: { userId: user.id }
      })
    });

    const result = await response.json();
    return result.data?.user_profiles?.[0]?.role || null;
  } catch (e) {
    console.error('Error getting user role:', e);
    return null;
  }
}

export { nhost };
