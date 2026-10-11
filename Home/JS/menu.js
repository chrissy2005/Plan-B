// KI-Log Nr. 21 
const API_URL = "http://localhost:8080";
 
if (!sessionStorage.getItem("token")) {
  window.location.replace("../../Login/HTML/login.html");
}
 
async function logout() {
  if (!confirm("Möchtest du dich wirklich abmelden?")) {
    return;
  }
 
  
  try {
    await fetch(API_URL + "/auth", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: sessionStorage.getItem("token") })
    });
  } catch (error) {
    console.warn("Server nicht erreichbar, Abmeldung nur lokal:", error);
  }
 
  
  sessionStorage.removeItem("token");
  window.location.replace("../../Login/HTML/login.html");
}
 