(function () {
    'use strict';

    // KI-Log Nr. 50: Diese Client-ID wird in Google Cloud als OAuth-Client
    // vom Typ "Webanwendung" angelegt. Es wird kein Client-Secret im Frontend
    // gespeichert.
    const GOOGLE_CLIENT_ID = '152574630222-bn4nmk4s5q8hf7rouol53rcj0lsscc7r.apps.googleusercontent.com';
    const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
    const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

    const connectButton = document.querySelector('#googleConnect');
    const disconnectButton = document.querySelector('#googleDisconnect');
    const reloadButton = document.querySelector('#reloadCalendar');
    const createButton = document.querySelector('#createGoogleEvent');
    const form = document.querySelector('#googleEventForm');
    const statusBox = document.querySelector('#calendarConnectionStatus');
    const messageBox = document.querySelector('#calendarMessage');
    const eventsBody = document.querySelector('#googleEventsBody');

    let tokenClient = null;
    let accessToken = null;
    let googleReady = false;

    init();

    function init() {
        connectButton.addEventListener('click', connectGoogle);
        disconnectButton.addEventListener('click', disconnectGoogle);
        reloadButton.addEventListener('click', loadEvents);
        form.addEventListener('submit', createEvent);
        setDefaultEventTimes();
        const googleScript = document.querySelector('#googleIdentityScript');
        googleScript.addEventListener('load', () => {
            googleReady = true;
            statusBox.textContent = 'Bereit für die Google-Anmeldung.';
        });
        googleScript.addEventListener('error', () => {
            showMessage('Die Google-Anmeldung konnte nicht geladen werden. Prüfe die Internetverbindung oder blockierende Browser-Erweiterungen.', true);
            statusBox.textContent = 'Google-Anmeldung konnte nicht geladen werden.';
        });
        waitForGoogleClient();
    }

    function connectGoogle() {
        if (!isConfigured()) {
            showMessage(
                'Bitte zuerst GOOGLE_CLIENT_ID in Kalender/JS/calendar.js eintragen und die OAuth-Weiterleitungs-URI in Google Cloud konfigurieren.',
                true
            );
            return;
        }

        if (!googleReady || !window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            showMessage('Die Google-Anmeldung wird noch geladen. Bitte in wenigen Sekunden erneut versuchen.', true);
            return;
        }

        // KI-Log Nr. 51: Der Token wird nur im Speicher gehalten und nie in
        // localStorage, sessionStorage oder einem eigenen Backend gespeichert.
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: CALENDAR_SCOPE,
            callback: response => {
                if (response.error || !response.access_token) {
                    showMessage(formatGoogleAuthError(response), true);
                    return;
                }
                accessToken = response.access_token;
                setConnectedState(true);
                loadEvents();
            },
            error_callback: error => {
                showMessage(formatGoogleAuthError(error), true);
            }
        });
        try {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (error) {
            showMessage('Google-Anmeldung konnte nicht gestartet werden: ' + error.message, true);
        }
    }

    function waitForGoogleClient() {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                googleReady = true;
                statusBox.textContent = 'Bereit für die Google-Anmeldung.';
                window.clearInterval(timer);
            } else if (Date.now() - startedAt > 10000) {
                window.clearInterval(timer);
                statusBox.textContent = 'Google-Anmeldung konnte nicht geladen werden.';
                showMessage('Google Identity Services antwortet nicht. Bitte Seite mit Strg+F5 neu laden.', true);
            }
        }, 100);
    }

    function formatGoogleAuthError(error) {
        const code = error && (error.error || error.type);
        const messages = {
            popup_failed_to_open: 'Das Google-Anmeldefenster wurde blockiert. Erlaube Pop-ups für diese Website.',
            popup_closed: 'Das Google-Anmeldefenster wurde geschlossen.',
            access_denied: 'Der Zugriff auf Google Calendar wurde abgelehnt.',
            origin_mismatch: 'Diese Website ist in Google Cloud nicht als autorisierte JavaScript-Quelle eingetragen.',
            invalid_client: 'Die OAuth-Client-ID ist ungültig oder gehört zu einem anderen Google-Cloud-Projekt.'
        };
        return messages[code] || 'Google-Anmeldung fehlgeschlagen' + (code ? ': ' + code : '.');
    }

    function disconnectGoogle() {
        if (accessToken && window.google && window.google.accounts) {
            window.google.accounts.oauth2.revoke(accessToken);
        }
        accessToken = null;
        setConnectedState(false);
        eventsBody.innerHTML = '<tr><td colspan="4" class="empty">Bitte zuerst Google verbinden.</td></tr>';
    }

    async function loadEvents() {
        if (!accessToken) return;
        showMessage('Google-Termine werden geladen …', false);
        try {
            // KI-Log Nr. 52: Beim Öffnen und bei jeder Aktualisierung werden
            // Termine direkt per GET aus Google Calendar geladen.
            const from = new Date();
            const to = new Date(from);
            to.setDate(to.getDate() + 90);
            const query = new URLSearchParams({
                timeMin: from.toISOString(),
                timeMax: to.toISOString(),
                singleEvents: 'true',
                orderBy: 'startTime',
                maxResults: '250'
            });
            const response = await calendarRequest(
                '/calendars/primary/events?' + query.toString(),
                { method: 'GET' }
            );
            renderEvents(response.items || []);
            hideMessage();
        } catch (error) {
            showMessage(error.message, true);
        }
    }

    async function createEvent(event) {
        event.preventDefault();
        if (!accessToken) return;

        const start = document.querySelector('#eventStart').value;
        const end = document.querySelector('#eventEnd').value;
        if (new Date(end) <= new Date(start)) {
            showMessage('Das Ende muss nach dem Beginn liegen.', true);
            return;
        }

        createButton.disabled = true;
        try {
            // KI-Log Nr. 53: Plan-B sendet den neuen Termin als JSON direkt
            // an Google Calendar; ein Backend-Proxy ist dafür nicht erforderlich.
            await calendarRequest('/calendars/primary/events', {
                method: 'POST',
                body: {
                    summary: document.querySelector('#eventTitle').value.trim(),
                    location: document.querySelector('#eventLocation').value.trim(),
                    description: document.querySelector('#eventDescription').value.trim(),
                    start: { dateTime: toGoogleDateTime(start), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: toGoogleDateTime(end), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
                }
            });
            form.reset();
            setDefaultEventTimes();
            await loadEvents();
            showMessage('Der Termin wurde in Google Kalender gespeichert.', false);
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            createButton.disabled = false;
        }
    }

    async function calendarRequest(path, options) {
        const response = await fetch(CALENDAR_API + path, {
            method: options.method,
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + accessToken,
                ...(options.body ? { 'Content-Type': 'application/json' } : {})
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            if (response.status === 401) {
                setConnectedState(false);
            }
            const detail = data && data.error && data.error.message;
            throw new Error(detail || 'Google Calendar antwortet mit HTTP ' + response.status + '.');
        }
        return data;
    }

    function renderEvents(events) {
        if (!events.length) {
            eventsBody.innerHTML = '<tr><td colspan="4" class="empty">Keine Termine in den nächsten 90 Tagen.</td></tr>';
            return;
        }
        eventsBody.innerHTML = events.map(item => {
            const start = item.start.dateTime || item.start.date;
            const end = item.end.dateTime || item.end.date;
            return `<tr>
                <td>${escapeHtml(item.summary || '(Ohne Titel)')}</td>
                <td>${formatDate(start)}</td>
                <td>${formatDate(end)}</td>
                <td>${escapeHtml(item.location || '–')}</td>
            </tr>`;
        }).join('');
    }

    function setConnectedState(connected) {
        statusBox.textContent = connected ? 'Mit Google Kalender verbunden.' : 'Noch nicht mit Google verbunden.';
        connectButton.hidden = connected;
        disconnectButton.hidden = !connected;
        reloadButton.disabled = !connected;
        createButton.disabled = !connected;
    }

    function setDefaultEventTimes() {
        const start = new Date(Date.now() + 60 * 60 * 1000);
        start.setMinutes(0, 0, 0);
        const end = new Date(start);
        end.setHours(end.getHours() + 1);
        document.querySelector('#eventStart').value = toLocalInput(start);
        document.querySelector('#eventEnd').value = toLocalInput(end);
    }

    function toLocalInput(date) {
        const pad = value => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function toGoogleDateTime(value) {
        return new Date(value).toISOString();
    }

    function formatDate(value) {
        return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
    }

    function isConfigured() {
        return !GOOGLE_CLIENT_ID.startsWith('DEINE_');
    }

    function showMessage(message, isError) {
        messageBox.textContent = message;
        messageBox.hidden = false;
        messageBox.classList.toggle('error', isError);
    }

    function hideMessage() {
        messageBox.hidden = true;
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[char]);
    }
})();
