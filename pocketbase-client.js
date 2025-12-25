/**
 * PocketBase Client für Responda
 * Zentrale API-Verwaltung + Rollen-System
 */

// PocketBase SDK laden
import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@0.21.3/dist/pocketbase.es.mjs';

// PocketBase Instanz
export const pb = new PocketBase('https://api.responda.systems');

// ===== ROLLEN-SYSTEM =====

// Rollen-Vorlagen mit Permissions
export const ROLE_TEMPLATES = {
  mpg: {
    label: 'MPG-Beauftragter',
    icon: '👑',
    permissions: {
      dashboard: true,
      einsaetze: true,
      lager: true,
      produktausgabe: true,
      ausbildungen: true,
      ausbildungen_manage: true,
      dokumente: true,
      cirs: true,
      patienten: true,
      dateien: true,
      qr: true,
      chat: true,
      einstellungen: true,
      users_manage: true
    }
  },
  
  lager: {
    label: 'Lagerverwaltung',
    icon: '📦',
    permissions: {
      dashboard: true,
      lager: true,
      produktausgabe: true,
      dateien: true,
      qr: true,
      chat: true
    }
  },
  
  ausbildung: {
    label: 'Ausbildungen',
    icon: '🎓',
    permissions: {
      dashboard: true,
      einsaetze: true,
      ausbildungen: true,
      ausbildungen_manage: true,
      patienten: true,
      dateien: true,
      qr: true,
      chat: true
    }
  },
  
  qm: {
    label: 'Qualitätsmanagement',
    icon: '📋',
    permissions: {
      dashboard: true,
      dokumente: true,
      cirs: true,
      dateien: true,
      qr: true,
      chat: true
    }
  },
  
  benutzer: {
    label: 'Benutzer',
    icon: '👤',
    permissions: {
      dashboard: true,
      ausbildungen: true,
      chat: true
    }
  }
};

// Page-Namen zu URLs Mapping
export const PAGE_URLS = {
  dashboard: 'mpg-dashboard.html',
  einsaetze: 'einsaetze.html',
  lager: 'lagerverwaltung.html',
  produktausgabe: 'produktausgabe.html',
  ausbildungen: 'ausbildungen.html',
  dokumente: 'dokumente-bearbeiten.html',
  cirs: 'cirs.html',
  patienten: 'patientendokumentation-dateien.html',
  dateien: 'dateien.html',
  qr: 'qr-code-generator.html'
};

// ===== PERMISSIONS HELPER =====

/**
 * Prüft ob User Zugriff auf eine Seite hat
 */
export function canAccessPage(user, pageName) {
  if (!user) return false;
  
  // Supervisor hat immer Zugriff
  if (user.supervisor) return true;
  
  // Prüfe individuelle Permissions
  const permissions = user.permissions || {};
  return permissions[pageName] === true;
}

/**
 * Prüft ob User etwas verwalten kann
 */
export function canManage(user, section) {
  if (!user) return false;
  if (user.supervisor) return true;
  
  const permissions = user.permissions || {};
  
  switch(section) {
    case 'ausbildungen':
      return permissions.ausbildungen_manage === true;
    case 'users':
      return permissions.users_manage === true;
    default:
      return permissions[section] === true;
  }
}

/**
 * Gibt Rollen-Info zurück
 */
export function getRoleInfo(role) {
  return ROLE_TEMPLATES[role] || ROLE_TEMPLATES.benutzer;
}

/**
 * Gibt Rollen-Label zurück
 */
export function getRoleLabel(role) {
  const info = getRoleInfo(role);
  return `${info.icon} ${info.label}`;
}

// ===== AUTH GUARDS =====

/**
 * Prüft ob User eingeloggt ist
 * Leitet zu Login weiter wenn nicht
 */
export async function requireAuth() {
  if (!pb.authStore.isValid) {
    window.location.href = 'mpg-login.html';
    return null;
  }
  
  try {
    // Refresh auth
    await pb.collection('users').authRefresh();
    return pb.authStore.model;
  } catch (error) {
    console.error('Auth refresh failed:', error);
    pb.authStore.clear();
    window.location.href = 'mpg-login.html';
    return null;
  }
}

/**
 * Prüft ob User Zugriff auf aktuelle Seite hat
 */
export async function checkPageAccess(pageName) {
  const user = await requireAuth();
  if (!user) return false;
  
  if (!canAccessPage(user, pageName)) {
    alert('Zugriff verweigert! Sie haben keine Berechtigung für diese Seite.');
    window.location.href = 'mpg-dashboard.html';
    return false;
  }
  
  return true;
}

/**
 * Gibt den Namen der aktuellen Seite zurück
 */
export function getCurrentPageName() {
  const path = window.location.pathname;
  const filename = path.split('/').pop();
  
  for (const [pageName, url] of Object.entries(PAGE_URLS)) {
    if (url === filename) {
      return pageName;
    }
  }
  
  return 'dashboard';
}

// ===== NAVIGATION BUILDER =====

/**
 * Baut die Navigation basierend auf User-Permissions
 */
export function buildNavigation(user, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  const pages = [
    { id: 'einsaetze', label: '🚨 Einsätze', url: 'einsaetze.html' },
    { id: 'patienten', label: '🧾 Patientendokumentation', url: 'patientendokumentation-dateien.html' },
    { id: 'dokumente', label: '📋 Vorgänge', url: 'dokumente-bearbeiten.html' },
    { id: 'cirs', label: '⚠️ CIRS', url: 'cirs.html' },
    { id: 'ausbildungen', label: '🎓 Ausbildungen', url: 'ausbildungen.html' },
    { id: 'lager', label: '📦 Lagerverwaltung', url: 'lagerverwaltung.html' },
    { id: 'produktausgabe', label: '📋 Produktausgabe', url: 'produktausgabe.html' },
    { id: 'dateien', label: '📄 Dateien', url: 'dateien.html' },
    { id: 'qr', label: '📟 QR-Code Generator', url: 'qr-code-generator.html' }
  ];
  
  const accessiblePages = pages.filter(page => canAccessPage(user, page.id));
  
  if (accessiblePages.length === 0) {
    container.innerHTML = '<p style="color:#999; padding:10px">Keine Bereiche verfügbar</p>';
    return;
  }
  
  container.innerHTML = accessiblePages
    .map(page => `
      <a href="${page.url}" class="nav-link">
        ${page.label}
      </a>
    `)
    .join('');
}

// ===== HELPER FUNCTIONS =====

/**
 * Formatiert Datum
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('de-DE');
}

/**
 * Formatiert Datum + Zeit
 */
export function formatDateTime(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('de-DE');
}

/**
 * Escape HTML um XSS zu verhindern
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Zeigt eine Notification
 */
export function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    });
  }
}

/**
 * Fordert Notification-Berechtigung an
 */
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ===== ORGANISATION MANAGEMENT =====

const ORG_STORAGE_KEY = 'responda_org';

/**
 * Speichert Organisation im LocalStorage
 */
export function saveOrganization(orgData) {
  localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(orgData));
}

/**
 * Lädt Organisation aus LocalStorage
 */
export function loadOrganization() {
  const data = localStorage.getItem(ORG_STORAGE_KEY);
  return data ? JSON.parse(data) : null;
}

/**
 * Löscht Organisation aus LocalStorage
 */
export function clearOrganization() {
  localStorage.removeItem(ORG_STORAGE_KEY);
}

// ===== EXPORT =====
export default {
  pb,
  ROLE_TEMPLATES,
  PAGE_URLS,
  canAccessPage,
  canManage,
  getRoleInfo,
  getRoleLabel,
  requireAuth,
  checkPageAccess,
  getCurrentPageName,
  buildNavigation,
  formatDate,
  formatDateTime,
  escapeHtml,
  showNotification,
  requestNotificationPermission,
  saveOrganization,
  loadOrganization,
  clearOrganization
};
