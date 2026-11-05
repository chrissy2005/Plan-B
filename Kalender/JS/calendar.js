(function () {
    'use strict';

    // KI-Log Nr. 50: Diese Client-ID wird in Google Cloud als OAuth-Client
    // vom Typ "Webanwendung" angelegt. Es wird kein Client-Secret im Frontend
    // gespeichert.
    const GOOGLE_CLIENT_ID = '152574630222-bn4nmk4s5q8hf7rouol53rcj0lsscc7r.apps.googleusercontent.com';
    // KI-Log Nr. 58: Der vollständige Calendar-Scope ist erforderlich, damit
    // auch private Kalender gelesen und neue Termine erstellt werden können.
    const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
    const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

    const connectButton = document.querySelector('#googleConnect');
    const disconnectButton = document.querySelector('#googleDisconnect');
    const reloadButton = document.querySelector('#reloadCalendar');
    const createButton = document.querySelector('#createGoogleEvent');
    const form = document.querySelector('#googleEventForm');
    const statusBox = document.querySelector('#calendarConnectionStatus');
    const messageBox = document.querySelector('#calendarMessage');
    const eventsBody = document.querySelector('#googleEventsBody');
    const syncStatus = document.querySelector('#calendarSyncStatus');

    let tokenClient = null;
    let accessToken = null;
    let googleReady = false;
    let loadingEvents = false;
    let tokenRequestPromise = null;
    let liveRefreshTimer = null;

    init();

    function init() {
        connectButton.addEventListener('click', connectGoogle);
        disconnectButton.addEventListener('click', disconnectGoogle);
        reloadButton.addEventListener('click', () => refreshEverything(false));
        form.addEventListener('submit', createEvent);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && accessToken && !loadingEvents) {
                refreshEverything(true);
            }
        });
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
        requestGoogleToken('consent')
            .then(() => {
                setConnectedState(true);
                startLiveRefresh();
                return loadEvents();
            })
            .catch(error => showMessage(error.message, true));
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
        stopLiveRefresh();
        setConnectedState(false);
        eventsBody.innerHTML = '<tr><td colspan="3" class="empty">Bitte zuerst Google verbinden.</td></tr>';
    }

    async function refreshEverything(isAutomatic) {
        if (loadingEvents) return;
        // KI-Log Nr. 59: Der Aktualisieren-Button fordert vor dem vollständigen
        // Neuaufbau der Tabelle einen frischen Google-Token an. Dadurch werden
        // neue private Termine nach einer Änderung zuverlässig berücksichtigt.
        if (!googleReady) {
            showMessage('Die Google-Anmeldung wird noch geladen. Bitte erneut versuchen.', true);
            return;
        }
        try {
            setLoadingState(true);
            showMessage('Google-Kalender werden vollständig neu geladen …', false);
            try {
                await requestGoogleToken('');
            } catch (error) {
                if (isAutomatic) {
                    throw new Error('Die Google-Verbindung ist abgelaufen. Bitte erneut mit Google Kalender verbinden.');
                }
                // KI-Log Nr. 61: Nach Erweiterung des OAuth-Scopes darf der
                // manuelle Aktualisieren-Button einmalig die neue Freigabe
                // interaktiv anfordern.
                await requestGoogleToken('consent');
            }
            setConnectedState(true);
            startLiveRefresh();
            eventsBody.innerHTML = '<tr><td colspan="3" class="empty">Kalender werden neu geladen …</td></tr>';
            await loadEvents();
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            setLoadingState(false);
        }

    }

    function startLiveRefresh() {
        if (liveRefreshTimer) return;
        // KI-Log Nr. 62: Google Calendar bietet für eine reine Browser-Seite
        // keinen dauerhaften Push-WebHook. Deshalb wird sichtbar regelmäßig
        // nachgeladen; der manuelle Button bleibt für einen sofortigen Reload.
        liveRefreshTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible' && accessToken && !loadingEvents) {
                refreshEverything(true);
            }
        }, 30000);
        syncStatus.textContent = 'Automatische Aktualisierung aktiv (alle 30 Sekunden).';
    }

    function stopLiveRefresh() {
        if (liveRefreshTimer) {
            window.clearInterval(liveRefreshTimer);
            liveRefreshTimer = null;
        }
        syncStatus.textContent = 'Nach der Verbindung wird automatisch regelmäßig aktualisiert.';
    }

    function requestGoogleToken(prompt) {
        if (tokenRequestPromise) return tokenRequestPromise;
        tokenRequestPromise = new Promise((resolve, reject) => {
            if (!googleReady || !window.google || !window.google.accounts || !window.google.accounts.oauth2) {
                reject(new Error('Google-Anmeldung ist noch nicht bereit.'));
                return;
            }
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: CALENDAR_SCOPE,
                callback: response => {
                    if (response.error || !response.access_token) {
                        reject(new Error(formatGoogleAuthError(response)));
                        return;
                    }
                    accessToken = response.access_token;
                    resolve();
                },
                error_callback: error => reject(new Error(formatGoogleAuthError(error)))
            });
            try {
                tokenClient.requestAccessToken({ prompt });
            } catch (error) {
                reject(new Error('Google-Anmeldung konnte nicht gestartet werden: ' + error.message));
            }
        }).finally(() => {
            tokenRequestPromise = null;
        });
        return tokenRequestPromise;
    }

    async function loadEvents() {
        if (!accessToken || loadingEvents) return;
        loadingEvents = true;
        setLoadingState(true);
        showMessage('Google-Termine werden geladen …', false);
        try {
            // KI-Log Nr. 52: Beim Öffnen und bei jeder Aktualisierung werden
            // Termine direkt per GET aus Google Calendar geladen.
            // KI-Log Nr. 56: Auch bereits begonnene private Google-Termine
            // werden geladen, damit die Belegt-Zeiten vollständig sind.
            const from = new Date();
            from.setDate(from.getDate() - 90);
            const to = new Date();
            to.setDate(to.getDate() + 365);
            // KI-Log Nr. 57: Alle Kalender des angemeldeten Google-Kontos
            // werden abgefragt, damit private Kalender neben "primary"
            // ebenfalls in den Belegt-Zeiten erscheinen.
            const calendars = await loadCalendars();
            const eventGroups = (
                await Promise.all(
                    calendars.map(calendar =>
                        loadCalendarEventsSafely(calendar.id, from, to)
                    )
                )
            );
            const events = eventGroups.flat();
            renderEvents(events);
            hideMessage();
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            loadingEvents = false;
            setLoadingState(false);
        }

        async function loadCalendars() {
            const calendars = [];
            let pageToken = null;

            do {
                const query = new URLSearchParams({
                    minAccessRole: 'reader',
                    showDeleted: 'false',
                    maxResults: '250'
                });
                if (pageToken) {
                    query.set('pageToken', pageToken);
                }

                const response = await calendarRequest(
                    '/users/me/calendarList?' + query.toString(),
                    { method: 'GET' }
                );
                calendars.push(...(response.items || []));
                pageToken = response.nextPageToken || null;
            } while (pageToken);

            return calendars.length
                ? calendars.filter(calendar =>
                    ['owner', 'writer', 'reader'].includes(calendar.accessRole)
                )
                : [{ id: 'primary' }];
        }

        async function loadCalendarEventsSafely(calendarId, from, to) {
            try {
                return await loadAllEvents(calendarId, from, to);
            } catch (error) {
                if (error.status === 401) {
                    throw error;
                }
                console.warn('[Google Calendar] Kalender konnte nicht geladen werden:', calendarId, error.message);
                return [];
            }
        }

        async function loadAllEvents(calendarId, from, to) {
            const events = [];
            let pageToken = null;

            do {
                const query = new URLSearchParams({
                    timeMin: from.toISOString(),
                    timeMax: to.toISOString(),
                    singleEvents: 'true',
                    orderBy: 'startTime',
                    showDeleted: 'false',
                    maxResults: '250'
                });
                if (pageToken) {
                    query.set('pageToken', pageToken);
                }

                const response = await calendarRequest(
                    '/calendars/' + encodeURIComponent(calendarId) +
                    '/events?' + query.toString(),
                    { method: 'GET' }
                );
                events.push(...(response.items || []));
                pageToken = response.nextPageToken || null;
            } while (pageToken);

            return events.map(event => ({ ...event, calendarId }));
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

    async function calendarRequest(path, options, retryAfterUnauthorized = true) {
        const response = await fetch(CALENDAR_API + path, {
            method: options.method,
            cache: 'no-store',
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
                if (retryAfterUnauthorized) {
                    // KI-Log Nr. 60: Bei abgelaufenem Token wird einmal
                    // automatisch still neu autorisiert und die Anfrage
                    // anschließend exakt wiederholt.
                    await requestGoogleToken('');
                    setConnectedState(true);
                    return calendarRequest(path, options, false);
                }
            }
            const detail = data && data.error && data.error.message;
            const error = new Error(
                detail || 'Google Calendar antwortet mit HTTP ' + response.status + '.'
            );
            error.status = response.status;
            throw error;
        }
        return data;
    }

    function renderEvents(events) {
        if (!events.length) {
            eventsBody.innerHTML = '<tr><td colspan="3" class="empty">Keine Google-Termine im geladenen Zeitraum.</td></tr>';
            return;
        }
        const uniqueEvents = Array.from(
            new Map(
                events.map(item => [
                    (item.calendarId || '') + ':' + item.id,
                    item
                ])
            ).values()
        );
        eventsBody.innerHTML = uniqueEvents.map(item => {
            const start = item.start.dateTime || item.start.date;
            const end = item.end.dateTime || item.end.date;
            return `<tr>
                <td>belegt</td>
                <td>${formatDate(start)}</td>
                <td>${formatDate(end)}</td>
            </tr>`;
        }).join('');
    }

    function setConnectedState(connected) {
        statusBox.textContent = connected ? 'Mit Google Kalender verbunden.' : 'Noch nicht mit Google verbunden.';
        connectButton.hidden = connected;
        disconnectButton.hidden = !connected;
        reloadButton.disabled = !connected;
        createButton.disabled = !connected;
        if (!connected) {
            stopLiveRefresh();
        }
    }

    function setLoadingState(loading) {
        reloadButton.disabled = loading || !accessToken;
        createButton.disabled = loading || !accessToken;
        connectButton.disabled = loading;
        disconnectButton.disabled = loading;
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
