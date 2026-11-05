# Kalender: Schnittstellen für das Frontend

## Stand

Das Frontend enthält API-Aufrufe zum Laden der Kalenderwoche sowie zum
Einplanen, Ändern und Aufheben von Zeitfenstern.

Die Abläufe wurden im lokalen Demo-Modus getestet.
Der gemeinsame Test mit dem Backend steht noch aus.

GET /calendar ist bereits vorhanden und benötigt die unten beschriebenen
Ergänzungen. Die beiden weiteren Endpunkte sind für die Backend-Umsetzung
vorgesehen.

## Allgemeine Regeln

- Authentifizierung über Authorization: Bearer <token>.
- Der Benutzer wird aus der Anmeldung ermittelt.
- IDs müssen dauerhaft und eindeutig sein.
- Datums- und Zeitwerte enthalten einen Zeitzonenoffset oder Z für UTC.
- Beispiel: 2026-11-05T14:00:00+01:00 entspricht 2026-11-05T13:00:00Z.
- Das Frontend sendet beim Speichern UTC-Zeitstempel mit Z.
- Beginn und Frist eines langen To-Dos müssen ihre Uhrzeit behalten.
- Nicht vorhandene Zeitfenster werden mit from: null und to: null geliefert.
- Listen werden auch dann als Arrays geliefert, wenn sie leer sind.

## 1. Kalenderwoche laden

GET /calendar?week=2026-11-02

Die übergebene Woche wird auf Montag bis Sonntag bezogen.
Das Frontend übergibt den Montag als YYYY-MM-DD.

Antwort: HTTP 200

{
  "message": "calendar successfully retrieved for user",
  "from": "2026-11-02",
  "to": "2026-11-08",
  "meetings": [],
  "subtasks": [],
  "longToDos": []
}

### meetings

Jeder Eintrag enthält:

- meetingId
- projectId
- projectName
- title
- from: vollständiger Beginn mit Uhrzeit und Zeitzonenoffset
- to: vollständiges Ende mit Uhrzeit und Zeitzonenoffset
- done: Boolean

Es werden die Meetings geliefert, an denen der angemeldete Benutzer
teilnimmt und die den Wochenzeitraum überschneiden.

### longToDos

Jeder Eintrag enthält:

- longToDoId
- projectId
- projectName
- title
- from: vollständiger Beginn mit Uhrzeit und Zeitzonenoffset
- to: vollständige Frist mit Uhrzeit und Zeitzonenoffset
- done: Boolean
- completedSubtasks: Anzahl erledigter Teilaufgaben
- totalSubtasks: Gesamtzahl der Teilaufgaben

Es werden die relevanten langen To-Dos des angemeldeten Benutzers
für die angefragte Woche geliefert.

Die Fortschrittszahlen beziehen sich auf sämtliche Teilaufgaben des
langen To-Dos. Fehlen die Zahlen, zeigt das Frontend keinen Zahlenfortschritt.

Wichtig: Die bisherige Ausgabe von from/to als reine Datumsangabe
muss für die genaue Darstellung um die Uhrzeit ergänzt werden.

### subtasks

Es werden ausschließlich dem angemeldeten Benutzer zugewiesene,
eingeplante Teilaufgaben geliefert, die die Woche überschneiden.

Beispiel eines Eintrags:

{
  "subtaskId": 31,
  "longToDoId": 12,
  "projectId": 4,
  "projectName": "Website",
  "longToDoTitle": "Wireframes überarbeiten",
  "title": "Mobile Ansicht prüfen",
  "from": "2026-11-04T14:00:00+01:00",
  "to": "2026-11-04T15:00:00+01:00",
  "earliestStart": "2026-11-02T08:00:00+01:00",
  "deadline": "2026-11-04T18:00:00+01:00",
  "done": false
}

earliestStart und deadline stammen vom übergeordneten langen To-Do.
Diese Grenzen werden auch bei bereits eingeplanten Teilaufgaben benötigt.

Für zeitgebundene Einträge gilt die Überschneidungsbedingung:
Eintragsende > Wochenbeginn UND Eintragsbeginn < nächster Montag.

Ungeplante Teilaufgaben gehören nicht in dieses Array.

## 2. Eigene ungeplante Teilaufgaben laden

GET /calendar/unscheduled-subtasks

Antwort: HTTP 200

{
  "subtasks": []
}

Die Einträge haben dieselben Felder wie Kalender-Teilaufgaben, allerdings:

- from ist null.
- to ist null.
- done ist false.

Geliefert werden alle offenen, dem angemeldeten Benutzer zugewiesenen
Teilaufgaben ohne Zeitfenster.

Diese Liste ist unabhängig von der angezeigten Kalenderwoche.
Auch hier werden longToDoId, projectId, earliestStart und deadline benötigt.

Jede Teilaufgabe darf nur einmal vorkommen.

## 3. Zeitfenster speichern oder ändern

PUT /long-todos/{longToDoId}/subtasks/{subtaskId}/schedule

Beispiel-Body:

{
  "from": "2026-11-04T13:00:00.000Z",
  "to": "2026-11-04T14:00:00.000Z"
}

Antwort: HTTP 200

{
  "message": "subtask schedule updated"
}

Nach erfolgreicher Speicherung lädt das Frontend die Kalenderdaten neu.

## 4. Zeitplanung aufheben

Derselbe PUT-Endpunkt, mit folgendem Body:

{
  "from": null,
  "to": null
}

Es werden ausschließlich die beiden Planungszeiten gelöscht.

Insbesondere bleiben erhalten:

- Zuweisung an den Bearbeiter
- Zugehörigkeit zum langen To-Do
- Titel, Beschreibung, Priorität und Erledigt-Status

Die offene Teilaufgabe erscheint danach wieder unter
GET /calendar/unscheduled-subtasks.

## Serverseitige Prüfungen beim Speichern

- Benutzer ist angemeldet und zum Zugriff auf das Projekt berechtigt.
- Teilaufgabe gehört zum angegebenen langen To-Do.
- Teilaufgabe ist dem angemeldeten Benutzer zugewiesen.
- Entweder beide Zeitwerte sind null oder beide sind gültig.
- Ende liegt nach Beginn.
- Beginn liegt nicht vor dem Beginn des langen To-Dos.
- Ende liegt nicht nach der Frist des langen To-Dos.
- Gleichheit mit den Grenzen des langen To-Dos ist erlaubt.
- Die Änderung beider Zeitwerte erfolgt gemeinsam.

Die Frontend-Prüfung ersetzt diese Backend-Prüfungen nicht.

## Überschneidungen

Vor dem Speichern lädt das Frontend GET /calendar für die Woche des
gewählten Zeitfensters und prüft Meetings sowie eingeplante Teilaufgaben.

Die bearbeitete Teilaufgabe wird anhand ihrer ID ausgeschlossen.
Direkt aufeinanderfolgende Zeitfenster gelten nicht als Überschneidung.

Bei Überschneidungen muss der Benutzer ausdrücklich bestätigen.
Ändert sich die Konfliktliste, ist eine neue Bestätigung erforderlich.

Der Schedule-Endpunkt erlaubt Überschneidungen grundsätzlich.
Es wird aktuell kein zusätzlicher Bestätigungswert übertragen.

Diese Prüfung berücksichtigt Plan-B-Termine, keine externen Kalender.

## Fehlerantworten

Fehler als JSON mit verständlichem message-Feld zurückgeben.

- 400: ungültige Zeiten oder Verletzung des erlaubten Zeitraums
- 401: Anmeldung fehlt oder ist abgelaufen
- 403: keine Berechtigung
- 404: Teilaufgabe oder langes To-Do nicht gefunden

Das Frontend behält die Formulareingaben bei einem Speicherfehler.

## Lokaler Demo-Modus

http://127.0.0.1:5500/Kalender/HTML/calender.html?demo=1

Nur auf localhost beziehungsweise 127.0.0.1 und nur auf dieser Kalenderseite.
Kalenderaktionen verwenden dort Beispieldaten und keine Backend-Aufrufe.
Die Planung wird beim Neuladen zurückgesetzt.

Der Echtbetrieb benötigt eine Anmeldung. Beim Test über Live Server muss
das Backend zusätzlich die lokale Frontend-Origin über CORS erlauben.

## Gemeinsamer Integrationstest

1. Mit echtem Benutzer anmelden und Kalender laden.
2. Wochenwechsel und Projektfilter prüfen.
3. Eigene ungeplante Teilaufgabe einplanen.
4. Seite neu laden: Zeitfenster muss erhalten bleiben.
5. Zeitfenster ändern und erneut nachladen.
6. Planung aufheben: Zuweisung bleibt, Aufgabe erscheint rechts.
7. Zeitraumgrenzen und fehlende Berechtigungen prüfen.
8. Überschneidung in einer anderen Woche prüfen.
9. Speicherfehler prüfen: keine Erfolgsmeldung, Eingaben bleiben erhalten.