(function () {
    "use strict";

    const CLIENT_ID =
        "152574630222-bn4nmk4s5q8hf7rouol53rcj0lsscc7r.apps.googleusercontent.com";
    const SCOPE = "https://www.googleapis.com/auth/calendar";
    const API = "https://www.googleapis.com/calendar/v3";
    const connectButton = document.getElementById("googleConnect");
    const disconnectButton = document.getElementById("googleDisconnect");
    const reloadButton = document.getElementById("reloadCalendar");
    const status = document.getElementById("googleSyncStatus");
    let tokenClient = null;
    let accessToken = null;
    let googleReady = false;
    let loading = false;

    function setStatus(text, error) {
        status.textContent = text;
        status.classList.toggle("is-error", Boolean(error));
    }

    function setControls(connected) {
        connectButton.hidden = connected;
        disconnectButton.hidden = !connected;
        connectButton.disabled = loading;
        disconnectButton.disabled = loading;
    }

    function requestToken(prompt) {
        return new Promise((resolve, reject) => {
            if (!googleReady) {
                reject(new Error("Google-Anmeldung wird noch geladen."));
                return;
            }
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPE,
                callback(response) {
                    if (response.error || !response.access_token) {
                        reject(new Error(
                            "Google-Anmeldung fehlgeschlagen"
                            + (response.error ? ": " + response.error : ".")
                        ));
                        return;
                    }
                    accessToken = response.access_token;
                    resolve();
                },
                error_callback(error) {
                    reject(new Error(
                        "Google-Anmeldung fehlgeschlagen"
                        + (error && error.type ? ": " + error.type : ".")
                    ));
                }
            });
            tokenClient.requestAccessToken({ prompt });
        });
    }

    async function request(path, options) {
        const response = await fetch(API + path, {
            method: options.method || "GET",
            cache: "no-store",
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + accessToken,
                ...(options.body ? { "Content-Type": "application/json" } : {})
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const detail = data && data.error && data.error.message;
            throw new Error(detail || "Google Calendar HTTP " + response.status);
        }
        return data;
    }

    async function loadBusy() {
        const calendars = await request(
            "/users/me/calendarList?minAccessRole=reader&maxResults=250",
            {}
        );
        const items = (calendars.items || [])
            .filter(calendar => ["owner", "writer", "reader"].includes(calendar.accessRole))
            .map(calendar => ({ id: calendar.id }));
        const start = new Date();
        start.setDate(start.getDate() - 90);
        const end = new Date();
        end.setDate(end.getDate() + 365);
        const periods = [];
        for (let rangeStart = start; rangeStart < end;) {
            const rangeEnd = new Date(
                Math.min(rangeStart.getTime() + 90 * 86400000, end.getTime())
            );
            for (let offset = 0; offset < items.length; offset += 50) {
                const response = await request("/freeBusy", {
                    method: "POST",
                    body: {
                        timeMin: rangeStart.toISOString(),
                        timeMax: rangeEnd.toISOString(),
                        items: items.slice(offset, offset + 50)
                    }
                });
                Object.values(response.calendars || {}).forEach(calendar => {
                    (calendar.busy || []).forEach(period => periods.push(period));
                });
            }
            rangeStart = rangeEnd;
        }
        document.dispatchEvent(new CustomEvent("planb:google-busy-updated", {
            detail: periods
        }));
        setStatus("Externer Kalender verbunden – synchronisiert", false);
    }

    async function synchronize(interactive) {
        if (loading) return;
        loading = true;
        setControls(Boolean(accessToken));
        setStatus("Externer Kalender wird synchronisiert …", false);
        try {
            if (!accessToken) await requestToken(interactive ? "consent" : "");
            await loadBusy();
            setControls(true);
        } catch (error) {
            accessToken = null;
            setControls(false);
            setStatus(error.message, true);
        } finally {
            loading = false;
            connectButton.disabled = false;
            disconnectButton.disabled = false;
        }
    }

    connectButton.addEventListener("click", () => void synchronize(true));
    reloadButton.addEventListener("click", () => {
        if (accessToken) void synchronize(false);
    });
    disconnectButton.addEventListener("click", () => {
        if (accessToken && window.google) {
            window.google.accounts.oauth2.revoke(accessToken);
        }
        accessToken = null;
        document.dispatchEvent(new CustomEvent("planb:google-busy-updated", {
            detail: []
        }));
        setControls(false);
        setStatus("Externer Kalender nicht verbunden", false);
    });

    const waitForGoogle = window.setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            googleReady = true;
            window.clearInterval(waitForGoogle);
        }
    }, 100);
})();
