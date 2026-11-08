// KI-Log Nr. 21
// KI-Log Nr. 44: Login-Wächter im lokalen Entwicklungsmodus deaktiviert.
const API_URL = "https://plan-b-api-6486e78ed17c.herokuapp.com";
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js?v=36")
      .catch(error => console.error("Service Worker konnte nicht aktualisiert werden:", error));
  });
}
//const DEV_BYPASS_AUTH = false; // KI-Log Nr. 47: Heroku-Login aktiv.
// Kalendervorschau lokal ausdrücklich mit ?demo=1 öffnen.
const DEV_BYPASS_AUTH =
  ["localhost", "127.0.0.1"].includes(window.location.hostname)
  && window.location.pathname === "/Kalender/HTML/calender.html"
  && new URLSearchParams(window.location.search).get("demo") === "1";
 
if (!DEV_BYPASS_AUTH && !sessionStorage.getItem("token")) {
  window.location.replace("../../Login/HTML/login.html?v=31");
}
 
async function logout() {
  if (!confirm("Möchtest du dich wirklich abmelden?")) {
    return;
  }
 
  
  if (!DEV_BYPASS_AUTH) try {
    await fetch(API_URL + "/auth", {
      method: "DELETE",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + sessionStorage.getItem("token")
      }
    });
  } catch (error) {
    console.warn("Server nicht erreichbar, Abmeldung nur lokal:", error);
  }
 
  
  sessionStorage.removeItem("token");
  window.location.replace("../../Login/HTML/login.html?v=31");
}

function formatHeaderRole(user) {
  const role = String(user && (user.role || user.function || user.position) || '').toUpperCase();
  if (['PROJECT_LEADER', 'PROJECT_MANAGER', 'PROJEKTLEITER', 'PROJEKTLEITUNG'].includes(role)) {
    return 'Projektleitung';
  }
  if (['MEMBER', 'TEAMMITGLIED'].includes(role)) {
    return 'Teammitglied';
  }
  return 'Teammitglied';
}

function formatHeaderName(user) {
  const firstName = String(user && (user.firstName || user.firstname) || '').trim();
  const lastName = String(user && (user.lastName || user.lastname) || '').trim();
  return user && (user.name || user.displayName)
    || [firstName, lastName].filter(Boolean).join(' ')
    || user && user.email
    || 'Benutzer';
}

function getTokenUser() {
  try {
    const token = sessionStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      name: payload.name || payload.preferred_username || payload.email,
      email: payload.email || ''
    };
  } catch (error) {
    console.warn('Benutzername konnte nicht aus der Sitzung gelesen werden:', error);
    return null;
  }
}

async function initSharedHeader() {
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton && !logoutButton.dataset.bound) {
    logoutButton.dataset.bound = 'true';
    logoutButton.addEventListener('click', () => void logout());
  }

  const name = document.getElementById('currentUserName');
  const role = document.getElementById('currentUserRole');
  const tokenUser = getTokenUser();
  if (name && tokenUser) name.textContent = formatHeaderName(tokenUser);
  if (role) role.textContent = formatHeaderRole(tokenUser);

  const api = window.PlanBApi;
  if (!api || typeof api.getCurrentUser !== 'function') return;
  try {
    const user = await api.getCurrentUser();
    if (name) name.textContent = formatHeaderName(user);
    if (role) role.textContent = formatHeaderRole(user);
  } catch (error) {
    console.warn('Kopfzeile konnte nicht geladen werden:', error);
  }
}

window.addEventListener('DOMContentLoaded', initSharedHeader);
 