// KI-Log Nr. 21
// KI-Log Nr. 44: Login-Wächter im lokalen Entwicklungsmodus deaktiviert.
const API_URL = "https://plan-b-api-6486e78ed17c.herokuapp.com";
const DEV_BYPASS_AUTH = false; // KI-Log Nr. 47: Heroku-Login aktiv.
 
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
 