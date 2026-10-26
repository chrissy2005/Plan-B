# Plan B: Frontend API contract

Basis: API-Design vom 19.10.2026. Produktionsbasis bleibt
https://plan-b-api-6486e78ed17c.herokuapp.com.

## Direkte Mitgliederverwaltung

- GET `/projects/{projectId}/members`: direktes Array aus userId, firstName,
  lastName, email und role.
- POST `/projects/{projectId}/members`: `{"email":"person@example.com","role":"MEMBER"}`.
- Alternative Rolle: `PROJECT_LEADER`. Nur die Projektleitung darf hinzufügen.
- Die E-Mail muss registriert sein. Die Mitgliedschaft entsteht sofort.
- Erfolg: 200 `{"message":"member added"}`; danach Mitgliederliste neu laden.
- Duplikat: 400; nicht registriert: 404; Rolle reicht nicht: 403.
- Kein Einladungsablauf, keine entsprechenden Requests oder Badge-Abfragen.

## GET und POST für Aufgaben

- GET `/projects/{projectId}/meetings` und `/projects/{projectId}/long-todos`.
- GET `/meetings/{meetingId}` und `/long-todos/{longToDoId}`.
- POST `/projects/{projectId}/meetings`: title, description, startDateTime,
  endDateTime, participantIds.
- POST `/projects/{projectId}/long-todos`: title, description, startDateTime,
  endDateTime, priority, assignedMemberIds, subtasks.
- Untertask beim Create: title, description, priority; zunächst unzugewiesen.
- POST `/long-todos/{longToDoId}/subtasks`: title, description.
- Zeitformat: `2026-11-01T10:00`, ohne Offset. Beide Zeitpunkte sind aktuell
  Pflicht. Frontend-Prioritäten werden nach LOW/MEDIUM/HIGH abgebildet.
- „Alle Mitglieder“ wird vor dem POST zu konkreten numerischen IDs aufgelöst.
- UI-IDs `meeting:12` und `long-todo:12` bleiben verschieden; sie sind keine
  Backend-Pfadparameter. Teilnehmer und Assignees werden intern zu Strings.

## Header und GET-Antworten

`Authorization: Bearer <JWT>` und separat `Content-Type: application/json`.
Der Token gehört weder in den Body noch in eine Query. GET hat keinen Body.
Die Listen bleiben gemäß den Tabellen im API-Design direkte Arrays; sie werden
nicht nachträglich in einen message-Wrapper gepackt.

## Grenzen

Projekt-/Member-PUTs verwenden das dokumentierte update-Format, benötigen aber
noch die zugehörige Backend-Implementierung. Task-PUT/DELETE, echte Token-
Revokation bei DELETE /auth, US2-Übernahme, Kalender und persönliche Zeitfenster
werden durch diese GET-/POST-Korrektur nicht fertiggestellt.

Vollständige Aufgabenbearbeitung, Übernahme und Kalenderhilfen melden deshalb
eine explizite „noch nicht implementiert“-Meldung, statt erfundene Pfade
aufzurufen. Neue Meetings behalten die vorhandene feste MEDIUM-Priorität; eine
Meeting-Priorität wird nicht stillschweigend im Formular angenommen.

## Lokale Prüfungen

```sh
node --test tests/api-contract.test.cjs
```

Zusätzlich wurden sämtliche externen JavaScript-Dateien mit `node --check`
geprüft und die Hauptabläufe gegen eine isolierte lokale PostgreSQL-Instanz im
Browser getestet. Keine produktiven Accounts oder Projekte wurden dafür angelegt.
