//KI-Log Nr. 23
const API_URL = "http://localhost:8080";
 
const dialog = document.getElementById("dialog-projekt");
const form = document.getElementById("form-projekt");
const fehler = document.getElementById("fehler");
const meldung = document.getElementById("meldung");
const btnSpeichern = document.getElementById("btn-speichern");
 

const MELDUNGEN = {
  "title missing": "Bitte einen Titel eingeben.",
  "project not found": "Projekt nicht gefunden. Bitte die Projektübersicht neu laden."
};
 
const STATUS = { active: "Aktiv", completed: "Abgeschlossen" };
const ROLLEN = { PL: "Projektleiter", member: "Teammitglied" };
 

function getToken() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
  }
  return token;
}
 
function zumLogin() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}
 

document.getElementById("btn-neues-projekt").addEventListener("click", () => {
  form.reset();
  fehler.textContent = "";
  dialog.showModal();
});
 
document.getElementById("btn-abbrechen").addEventListener("click", () => dialog.close());
 

form.addEventListener("submit", async (event) => {
  event.preventDefault();
 
  const token = getToken();
  if (!token) return;
 
  const title = document.getElementById("input-titel").value.trim();
  const description = document.getElementById("input-beschreibung").value.trim();
 
  if (title === "") {
    fehler.textContent = MELDUNGEN["title missing"];
    return;
  }
 
  btnSpeichern.disabled = true; // verhindert doppeltes Anlegen
  try {
    const response = await fetch(`${API_URL}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, title, description })
    });
 
    if (response.status === 401) return zumLogin();
 
    const data = await response.json();
    if (!response.ok) {
      fehler.textContent = MELDUNGEN[data.message]
        || "Projekt konnte nicht erstellt werden. Bitte erneut versuchen.";
      return;
    }
 
    dialog.close();
    await projektAnzeigen(data.projectId, token);
  } catch (e) {
    fehler.textContent = "Server nicht erreichbar. Bitte Verbindung prüfen und erneut versuchen.";
  } finally {
    btnSpeichern.disabled = false;
  }
});
 

async function projektAnzeigen(projectId, token) {
  meldung.textContent = "";
  try {
    const response = await fetch(
      `${API_URL}/projects/${encodeURIComponent(projectId)}?token=${encodeURIComponent(token)}`
    );
 
    if (response.status === 401) return zumLogin();
 
    const projekt = await response.json();
    if (!response.ok) {
      meldung.textContent = MELDUNGEN[projekt.message] || "Projekt konnte nicht geladen werden.";
      return;
    }
 
    
    document.getElementById("projekt-titel").textContent = projekt.title;
    document.getElementById("projekt-beschreibung").textContent = projekt.description || "";
    document.getElementById("projekt-status").textContent = STATUS[projekt.status] || projekt.status;
 
    const liste = document.getElementById("projekt-mitglieder");
    liste.replaceChildren();
    for (const mitglied of projekt.members) {
      const li = document.createElement("li");
      li.textContent = `${mitglied.name} (${ROLLEN[mitglied.role] || mitglied.role})`;
      liste.appendChild(li);
    }
 
    document.getElementById("projekt-ansicht").hidden = false;
  } catch (e) {
    meldung.textContent = "Projekt wurde erstellt, konnte aber nicht geladen werden. Bitte Seite neu laden.";
  }
}