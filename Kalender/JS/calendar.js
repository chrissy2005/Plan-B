(() => {
    "use strict";

    const isDemoMode =
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && window.location.pathname === "/Kalender/HTML/calender.html"
    && new URLSearchParams(window.location.search).get("demo") === "1";
    const dayHeaders = document.getElementById("calendarDayHeaders");
    const timeLabels = document.getElementById("calendarTimeLabels");
    const calendarDays = document.getElementById("calendarDays");
    const weekLabel = document.getElementById("weekLabel");
    const scrollArea = document.getElementById("calendarScrollArea");

    const dayFormatter = new Intl.DateTimeFormat("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit"
    });

    const dateFormatter = new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });

    let currentMonday = getMonday(new Date());

    // Vorübergehende Beispieldaten, keine Daten aus dem Backend.
    // Die Termine gehören zur aktuellen Woche beim Öffnen der Seite.
    const demoMonday = getMonday(new Date());

    function demoDate(dayOffset, hour, minute = 0) {
        const date = addDays(demoMonday, dayOffset);
        date.setHours(hour, minute, 0, 0);
        return date;
    }

    const demoEvents = [
        {
            type: "meeting",
            projectId: "demo-website",
            projectName: "Website",
            title: "Beispiel: Sprint Planning",
            context: "Meeting · Website",
            start: demoDate(0, 9),
            end: demoDate(0, 10)
        },
        {
            type: "subtask",
            projectId: "demo-website",
            projectName: "Website",
            title: "Beispiel: Startseite zeichnen",
            context: "Teilaufgabe · Wireframes überarbeiten · Website",
            start: demoDate(2, 11),
            end: demoDate(2, 12, 30)
        }
    ];

    const demoLongTodos = [
        {
            type: "longTodo",
            projectId: "demo-website",
            projectName: "Website",
            title: "Beispiel: Wireframes überarbeiten",
            start: demoDate(0, 8),
            end: demoDate(2, 18),
            completedSubtasks: 1,
            totalSubtasks: 3
        },
        {
            type: "longTodo",
            projectId: "demo-calendar",
            projectName: "Kalenderintegration",
            title: "Beispiel: Kalender-Sync testen",
            start: demoDate(3, 8),
            end: demoDate(8, 18),
            completedSubtasks: 0,
            totalSubtasks: 2
        }
    ];

    const demoUnscheduledSubtasks = [
        {
            id: "demo-subtask-mobile",
            type: "subtask",
            projectId: "demo-website",
            projectName: "Website",
            title: "Beispiel: Mobile Ansicht prüfen",
            context: "Teilaufgabe · Wireframes überarbeiten · Website",
            earliestStart: demoDate(0, 8),
            deadline: demoDate(2, 18),
            start: null,
            end: null
        },
        {
            id: "demo-subtask-sync",
            type: "subtask",
            projectId: "demo-calendar",
            projectName: "Kalenderintegration",
            title: "Beispiel: Sync-Log auswerten",
            context: "Teilaufgabe · Kalender-Sync testen · Kalenderintegration",
            earliestStart: demoDate(3, 8),
            deadline: demoDate(8, 18),
            start: null,
            end: null
        }
    ];

    // Daten, mit denen die Kalenderansicht arbeitet.
    // Im Echtbetrieb werden diese Listen durch API-Antworten gefüllt.
    let calendarEvents = isDemoMode ? demoEvents : [];
    let calendarLongTodos = isDemoMode ? demoLongTodos : [];
    let calendarSubtasks = isDemoMode ? demoUnscheduledSubtasks : [];

    let selectedSubtask = null;
    let isLoadingCalendar = false;
    let isSavingSchedule = false;
    let calendarLoadVersion = 0;

    const timeFormatter = new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
    });

    // Wandelt einen Datumswert aus der API in ein Date-Objekt um.
    function parseCalendarDate(value, fieldName) {
        if (typeof value !== "string" || !value.trim()) {
            throw new Error(`In den Kalenderdaten fehlt ${fieldName}.`);
        }

        // Reine Datumsangaben ausdrücklich als lokales Datum behandeln.
        const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T00:00:00`
            : value;

        const date = new Date(normalizedValue);

        if (!Number.isFinite(date.getTime())) {
            throw new Error(
                `Die Kalenderdaten enthalten ein ungültiges Datum für ${fieldName}.`
            );
        }

        return date;
    }

    // Übersetzt eine eigene Teilaufgabe aus der API ins Kalenderformat.
    // Wird für geplante und ungeplante Teilaufgaben verwendet.
    function mapCalendarSubtask(raw) {
        if (
            raw.subtaskId == null
            || raw.longToDoId == null
            || raw.projectId == null
        ) {
            throw new Error(
                "Bei einer Teilaufgabe fehlen Aufgaben- oder Projekt-IDs."
            );
        }

        const hasStart = raw.from != null;
        const hasEnd = raw.to != null;

        if (hasStart !== hasEnd) {
            throw new Error(
                "Eine Teilaufgabe muss entweder beide Zeitangaben oder keine besitzen."
            );
        }

        const start = hasStart
            ? parseCalendarDate(raw.from, "Beginn der Teilaufgabe")
            : null;

        const end = hasEnd
            ? parseCalendarDate(raw.to, "Ende der Teilaufgabe")
            : null;

        const earliestStart = parseCalendarDate(
            raw.earliestStart,
            "Beginn des langen To-Dos"
        );

        const deadline = parseCalendarDate(
            raw.deadline,
            "Frist des langen To-Dos"
        );

        if (deadline < earliestStart || (hasStart && end <= start)) {
            throw new Error(
                "Die Kalenderdaten enthalten ein ungültiges Zeitfenster."
            );
        }

        return {
            id: String(raw.subtaskId),
            longToDoId: String(raw.longToDoId),
            type: "subtask",
            projectId: String(raw.projectId),
            projectName: raw.projectName || "Unbenanntes Projekt",
            title: raw.title || "Unbenannte Teilaufgabe",
            context: [
                "Teilaufgabe",
                raw.longToDoTitle,
                raw.projectName
            ].filter(Boolean).join(" · "),
            done: raw.done === true,
            earliestStart,
            deadline,
            start,
            end
        };
    }

    function mapCalendarWeek(data) {
        const events = data.meetings.map(raw => ({
            id: String(raw.meetingId),
            type: "meeting",
            projectId: raw.projectId == null ? "" : String(raw.projectId),
            projectName: raw.projectName || "Unbenanntes Projekt",
            title: raw.title || "Unbenanntes Meeting",
            context: ["Meeting", raw.projectName].filter(Boolean).join(" · "),
            done: raw.done === true,
            start: parseCalendarDate(raw.from, "Meeting-Beginn"),
            end: parseCalendarDate(raw.to, "Meeting-Ende")
        }));

        const longTodos = data.longToDos.map(raw => {
            const hasProgress =
                Number.isInteger(raw.completedSubtasks)
                && Number.isInteger(raw.totalSubtasks)
                && raw.completedSubtasks >= 0
                && raw.totalSubtasks >= raw.completedSubtasks;

            return {
                id: String(raw.longToDoId),
                type: "longTodo",
                projectId: raw.projectId == null ? "" : String(raw.projectId),
                projectName: raw.projectName || "Unbenanntes Projekt",
                title: raw.title || "Unbenanntes langes To-Do",
                context: ["Langes To-Do", raw.projectName]
                    .filter(Boolean).join(" · "),
                done: raw.done === true,
                start: parseCalendarDate(raw.from, "Beginn des langen To-Dos"),
                end: parseCalendarDate(raw.to, "Frist des langen To-Dos"),
                completedSubtasks: hasProgress ? raw.completedSubtasks : null,
                totalSubtasks: hasProgress ? raw.totalSubtasks : null
            };
        });

        const subtasks = data.subtasks.map(mapCalendarSubtask);

        return { events, longTodos, subtasks };
    }

    function setCalendarLoading(loading) {
        isLoadingCalendar = loading;

        document.querySelector(".calendar-layout")
            .setAttribute("aria-busy", String(loading));

        [
            "previousWeek",
            "nextWeek",
            "todayButton",
            "calendarProjectFilter",
            "calendarTypeFilter"
        ].forEach(id => {
            document.getElementById(id).disabled = loading;
        });
    }

    async function loadCalendar() {
        const loadVersion = ++calendarLoadVersion;
        const message = document.getElementById("calendarMessage");

        message.hidden = false;

        if (isDemoMode) {
            initializeProjectFilter();
            renderWeek();

            message.textContent =
                "Vorschau mit Beispieldaten – keine Verbindung zum Backend.";

            return;
        }

        const requestedWeek = localDateValue(currentMonday);

        setCalendarLoading(true);

        // Alte Termine entfernen, damit sie nicht unter einer neuen Woche stehen.
        calendarEvents = [];
        calendarLongTodos = [];
        calendarSubtasks = [];
        renderWeek();

        message.textContent = "Kalenderdaten werden geladen …";

        document.getElementById("longTodoBars").textContent =
            "Lange To-Dos werden geladen …";

        document.getElementById("unscheduledSubtasks").textContent =
            "Teilaufgaben werden geladen …";

        try {
            const [weekData, unscheduledData] = await Promise.all([
                window.PlanBApi.getCalendarWeek(requestedWeek),
                window.PlanBApi.getCalendarUnscheduledSubtasks()
            ]);

            // Eine inzwischen gestartete neuere Anfrage hat Vorrang.
            if (loadVersion !== calendarLoadVersion) {
                return;
            }

            const mappedWeek = mapCalendarWeek(weekData);
            const unscheduledTasks =
                unscheduledData.map(mapCalendarSubtask);

            // Dieser Endpunkt soll ausschließlich offene,
            // noch nicht eingeplante eigene Teilaufgaben liefern.
            if (unscheduledTasks.some(task =>
                task.start !== null || task.end !== null || task.done
            )) {
                throw new Error(
                    "Die Antwort für ungeplante Teilaufgaben enthält "
                    + "bereits geplante oder erledigte Aufgaben."
                );
            }

            // Jede Teilaufgabe darf nur einmal in den Listen vorkommen.
            const subtasks = [
                ...mappedWeek.subtasks,
                ...unscheduledTasks
            ];

            const uniqueIds = new Set(subtasks.map(task => task.id));

            if (uniqueIds.size !== subtasks.length) {
                throw new Error(
                    "Die Kalenderantwort enthält doppelte Teilaufgaben."
                );
            }

            calendarEvents = mappedWeek.events;
            calendarLongTodos = mappedWeek.longTodos;
            calendarSubtasks = subtasks;

            initializeProjectFilter();
            renderWeek();

            message.textContent = "Kalenderdaten geladen.";
        } catch (error) {
            if (loadVersion !== calendarLoadVersion) {
                return;
            }

            console.error("Kalender konnte nicht geladen werden:", error);

            calendarEvents = [];
            calendarLongTodos = [];
            calendarSubtasks = [];
            renderWeek();

            // Einen Ladefehler nicht als leere Aufgabenliste darstellen.
            document.getElementById("longTodoBars").textContent =
                "Lange To-Dos konnten nicht geladen werden.";

            document.getElementById("unscheduledSubtasks").textContent =
                "Teilaufgaben konnten nicht geladen werden.";

            message.textContent =
                "Kalender konnte nicht geladen werden. "
                + (error.message || "Bitte versuche es erneut.")
                + " Zum erneuten Laden kannst du auf „Heute“ klicken.";
        } finally {
            if (loadVersion === calendarLoadVersion) {
                setCalendarLoading(false);
            }
        }
    }

    async function runScheduleAction(action) {
        if (isSavingSchedule) return;

        isSavingSchedule = true;

        const controls = [...document.querySelectorAll(
            "#calendarScheduleDialog input, "
            + "#calendarScheduleDialog button, "
            + "#calendarDetails button"
        )];

        const previousStates = controls.map(element => element.disabled);

        controls.forEach(element => {
            element.disabled = true;
        });

        try {
            await action();
        } finally {
            controls.forEach((element, index) => {
                element.disabled = previousStates[index];
            });

            isSavingSchedule = false;
        }
    }

    async function persistSubtaskSchedule(task, start, end) {
        if (isDemoMode) {
            task.start = start;
            task.end = end;
            return;
        }

        if (!task.longToDoId || !task.id) {
            throw new Error("Die IDs zum Speichern der Teilaufgabe fehlen.");
        }

        await window.PlanBApi.updateSubtaskSchedule(
            task.longToDoId,
            task.id,
            {
                from: start === null ? null : start.toISOString(),
                to: end === null ? null : end.toISOString()
            }
        );
    }

    async function finishScheduleChange(start, successMessage) {
        if (start !== null) {
            currentMonday = getMonday(start);
        }

        ["calendarScheduleDialog", "calendarDetails"].forEach(id => {
            const dialog = document.getElementById(id);
            if (dialog.open) dialog.close();
        });

        selectedSubtask = null;

        await loadCalendar();

        if (!isDemoMode) {
            const message = document.getElementById("calendarMessage");
            message.hidden = false;

            // Eine erfolgreiche Speicherung bleibt auch dann erkennbar,
            // wenn das anschließende Neuladen fehlschlägt.
            message.textContent =
                successMessage + " " + message.textContent;
        }

        weekLabel.tabIndex = -1;
        weekLabel.focus({ preventScroll: true });
    }

    async function removeSubtaskSchedule(task) {
        if (!task || isSavingSchedule) return;

        const note = document.querySelector(
            "#calendarDetails .calendar-details-note"
        );

        await runScheduleAction(async () => {
            note.textContent = "Planung wird aufgehoben …";

            try {
                await persistSubtaskSchedule(task, null, null);

                await finishScheduleChange(
                    null,
                    "Zeitplanung aufgehoben. Die Zuweisung bleibt bestehen."
                );
            } catch (error) {
                note.textContent =
                    "Planung konnte nicht aufgehoben werden. "
                    + (error.message || "Bitte versuche es erneut.");
            }
        });
    }

    // Ermittelt den Montag der übergebenen Woche.
    function getMonday(date) {
        const monday = new Date(date);
        monday.setHours(0, 0, 0, 0);

        const daysSinceMonday = (monday.getDay() + 6) % 7;
        monday.setDate(monday.getDate() - daysSinceMonday);

        return monday;
    }

    // Rechnet mit Kalendertagen, auch über Zeitumstellungen hinweg.
    function addDays(date, amount) {
        const result = new Date(date);
        result.setDate(result.getDate() + amount);
        return result;
    }

    function isSameDay(first, second) {
        return first.getFullYear() === second.getFullYear()
            && first.getMonth() === second.getMonth()
            && first.getDate() === second.getDate();
    }

    function renderTimeLabels() {
        timeLabels.replaceChildren();

        for (let hour = 0; hour < 24; hour++) {
            const label = document.createElement("div");
            label.className = "calendar-time-label";
            label.textContent = `${String(hour).padStart(2, "0")}:00`;

            timeLabels.append(label);
        }
    }

    function renderWeek() {
        const sunday = addDays(currentMonday, 6);
        const today = new Date();

        weekLabel.textContent =
            `${dateFormatter.format(currentMonday)} – `
            + dateFormatter.format(sunday);

        dayHeaders.replaceChildren();
        calendarDays.replaceChildren();

        // Freies Feld über der linken Uhrzeitenspalte.
        const corner = document.createElement("div");
        corner.setAttribute("aria-hidden", "true");
        dayHeaders.append(corner);

        for (let index = 0; index < 7; index++) {
            const date = addDays(currentMonday, index);
            const isToday = isSameDay(date, today);

            const heading = document.createElement("div");
            heading.className = "calendar-day-heading";
            heading.textContent = dayFormatter.format(date);
            heading.classList.toggle("is-today", isToday);

            if (isToday) {
                heading.setAttribute("aria-current", "date");
            }

            const column = document.createElement("div");
            column.className = "calendar-day-column";
            column.classList.toggle("is-today", isToday);
            column.dataset.dayIndex = String(index);

                   dayHeaders.append(heading);
        calendarDays.append(column);
    }

    const scheduledSubtasks = calendarSubtasks.filter(task =>
    task.start !== null && task.end !== null
    );

    renderEvents(
        [...calendarEvents, ...scheduledSubtasks].filter(matchesCalendarFilters)
    );

    renderLongTodos(calendarLongTodos.filter(matchesCalendarFilters));
    renderUnscheduledSubtasks();
    }

    function renderEvents(events) {
    // Alte Ereignisse entfernen, damit keine Duplikate entstehen.
    calendarDays.querySelectorAll(".calendar-event").forEach(
        element => element.remove()
    );

    const styles = getComputedStyle(
        document.querySelector(".calendar-page")
    );

    const hourHeight = parseFloat(
        styles.getPropertyValue("--calendar-hour-height")
    ) || 60;

    for (let index = 0; index < 7; index++) {
        const dayStart = addDays(currentMonday, index);
        const dayEnd = addDays(dayStart, 1);
        const segments = [];

        // Sichtbare Abschnitte für diesen Tag sammeln.
        for (const event of events) {
            const start = event.start;
            const end = event.end;

            if (!(start instanceof Date)
                || !(end instanceof Date)
                || !Number.isFinite(start.getTime())
                || !Number.isFinite(end.getTime())
                || end <= start) {
                continue;
            }

            if (start >= dayEnd || end <= dayStart) {
                continue;
            }

            const visibleStart = start < dayStart ? dayStart : start;
            const visibleEnd = end > dayEnd ? dayEnd : end;

            const startMinutes =
                visibleStart.getHours() * 60 + visibleStart.getMinutes();

            const endMinutes = visibleEnd.getTime() === dayEnd.getTime()
                ? 24 * 60
                : visibleEnd.getHours() * 60 + visibleEnd.getMinutes();

            segments.push({
                event,
                startMinutes,
                endMinutes
            });
        }

        // Frühe Termine zuerst, bei gleichem Beginn längere zuerst.
        segments.sort((a, b) =>
            a.startMinutes - b.startMinutes
            || b.endMinutes - a.endMinutes
        );

        const groups = [];
        let group = null;

        // Zusammenhängende Überschneidungen gruppieren
        // und jeweils eine freie Spalte zuweisen.
        for (const segment of segments) {
            if (!group || segment.startMinutes >= group.endMinutes) {
                group = {
                    endMinutes: segment.endMinutes,
                    segments: [],
                    columnEnds: []
                };

                groups.push(group);
            }

            let column = group.columnEnds.findIndex(
                end => end <= segment.startMinutes
            );

            if (column === -1) {
                column = group.columnEnds.length;
            }

            segment.column = column;
            group.columnEnds[column] = segment.endMinutes;
            group.endMinutes = Math.max(
                group.endMinutes,
                segment.endMinutes
            );

            group.segments.push(segment);
        }

        // Termine mit der berechneten Position und Breite zeichnen.
        for (const currentGroup of groups) {
            const columnCount = currentGroup.columnEnds.length;
            const widthPercent = 100 / columnCount;

            for (const segment of currentGroup.segments) {
                const event = segment.event;
                const start = event.start;
                const end = event.end;

                const element = document.createElement("button");
                element.type = "button";
                element.setAttribute("aria-haspopup", "dialog");

                element.addEventListener(
                    "click",
                    () => openCalendarDetails(event)
                );

                element.className =
                    `calendar-event calendar-event--${event.type}`;

                element.style.top =
                    `${segment.startMinutes / 60 * hourHeight}px`;

                element.style.height =
                    `${(segment.endMinutes - segment.startMinutes)
                        / 60 * hourHeight}px`;

                element.style.left =
                    `calc(${segment.column * widthPercent}% + 4px)`;

                element.style.width =
                    `calc(${widthPercent}% - 8px)`;

                // Die bisherige rechte Positionierung aufheben.
                element.style.right = "auto";

                const title = document.createElement("strong");
                title.className = "calendar-event-title";
                title.textContent = event.title;

                const time = document.createElement("span");
                time.className = "calendar-event-time";
                time.textContent =
                    `${timeFormatter.format(start)} – `
                    + timeFormatter.format(end);

                const context = document.createElement("span");
                context.className = "calendar-event-context";
                context.textContent = event.context || "";

                element.title =
                    `${event.title}\n${time.textContent}\n${context.textContent}`;

                element.setAttribute(
                    "aria-label",
                    `${event.title}, `
                    + `${dateFormatter.format(start)}, `
                    + `${timeFormatter.format(start)} Uhr bis `
                    + `${dateFormatter.format(end)}, `
                    + `${timeFormatter.format(end)} Uhr`
                );

                element.append(title, time, context);
                calendarDays.children[index].append(element);
            }
        }
    }
}

function renderLongTodos(longTodos) {
    const container = document.getElementById("longTodoBars");
    container.replaceChildren();

    let row = 1;

    for (const todo of longTodos) {
        if (!Number.isFinite(todo.start.getTime())
            || !Number.isFinite(todo.end.getTime())
            || todo.end < todo.start) {
            continue;
        }

        // Für die Balken vergleichen wir Kalendertage.
        const firstDay = new Date(todo.start);
        firstDay.setHours(0, 0, 0, 0);

        const lastDay = new Date(todo.end);
        lastDay.setHours(0, 0, 0, 0);

        const visibleDays = [];

        for (let index = 0; index < 7; index++) {
            const day = addDays(currentMonday, index);

            if (day >= firstDay && day <= lastDay) {
                visibleDays.push(index);
            }
        }

        // Dieses To-Do liegt außerhalb der angezeigten Woche.
        if (visibleDays.length === 0) {
            continue;
        }

        const startColumn = visibleDays[0] + 1;
        const endColumn = visibleDays[visibleDays.length - 1] + 2;

        const continuesBefore = firstDay < currentMonday;
        const continuesAfter = lastDay > addDays(currentMonday, 6);

        const progress = todo.completedSubtasks != null
            && todo.totalSubtasks != null
                ? `${todo.completedSubtasks}/${todo.totalSubtasks} Teilaufgaben`
                : "Fortschritt nicht verfügbar";

        const bar = document.createElement("button");
        bar.type = "button";
        bar.setAttribute("aria-haspopup", "dialog");
        bar.addEventListener("click", () => {
            openCalendarDetails({ ...todo, type: "longTodo" });
        });
        bar.className = "calendar-long-todo-bar";
        bar.style.gridColumn = `${startColumn} / ${endColumn}`;
        bar.style.gridRow = String(row++);

        bar.textContent =
            `${continuesBefore ? "← " : ""}`
            + `${todo.title} · ${todo.projectName} · ${progress}`
            + `${continuesAfter ? " →" : ""}`;

        const startText =
            `${dateFormatter.format(todo.start)} `
            + timeFormatter.format(todo.start);

        const endText =
            `${dateFormatter.format(todo.end)} `
            + timeFormatter.format(todo.end);

        bar.title =
            `${todo.title}\n${todo.projectName}\n`
            + `${startText} – ${endText}\n${progress}`
            + (continuesBefore ? "\nBeginnt vor dieser Woche." : "")
            + (continuesAfter ? "\nEndet nach dieser Woche." : "");

        container.append(bar);
        }

        if (row === 1) {
            const empty = document.createElement("p");
            empty.className = "calendar-long-todo-empty";
            empty.textContent =
                "Keine passenden langen To-Dos für diese Woche und Filterauswahl.";
            container.append(empty);
        }
    }

    function openCalendarDetails(item) {
    const dialog = document.getElementById("calendarDetails");
    dialog.querySelector(".calendar-details-note").textContent = isDemoMode
        ? "Vorschau mit Beispieldaten."
        : "Geladene Daten aus deinem Plan-B-Kalender.";

    const typeNames = {
        meeting: "Meeting",
        subtask: "Teilaufgabe",
        longTodo: "Langes To-Do"
    };

    document.getElementById("calendarDetailsTitle").textContent =
        item.title;

    document.getElementById("calendarDetailsType").textContent =
        typeNames[item.type] || "Aufgabe";

    document.getElementById("calendarDetailsContext").textContent =
        item.context || item.projectName || "Keine Zuordnung angegeben";

    document.getElementById("calendarDetailsStart").textContent =
        `${dateFormatter.format(item.start)}, `
        + `${timeFormatter.format(item.start)} Uhr`;

    document.getElementById("calendarDetailsEnd").textContent =
        `${dateFormatter.format(item.end)}, `
        + `${timeFormatter.format(item.end)} Uhr`;

    const progress = document.getElementById("calendarDetailsProgress");

    const hasProgress =
        item.type === "longTodo"
        && item.completedSubtasks != null
        && item.totalSubtasks != null;

    progress.hidden = !hasProgress;
    progress.textContent = hasProgress
        ? `${item.completedSubtasks} von ${item.totalSubtasks} `
            + "Teilaufgaben erledigt."
        : "";

        const editableSubtask = item.type === "subtask"
            ? calendarSubtasks.find(task => task.id === item.id)
            : null;

        const actions = document.getElementById("calendarDetailsActions");
        const editButton = document.getElementById("calendarEditSchedule");
        const removeButton = document.getElementById("calendarRemoveSchedule");

        actions.hidden = !editableSubtask || editableSubtask.done === true;

        editButton.onclick = () => {
            if (!editableSubtask) {
                return;
            }

            dialog.close();
            openScheduleDialog(editableSubtask);
        };

        removeButton.onclick = () => {
            void removeSubtaskSchedule(editableSubtask);
        };

        dialog.showModal();
    }

    function initializeProjectFilter() {
        const select = document.getElementById("calendarProjectFilter");

        const previousValue = select.value;
        const previousLabel =
            select.selectedOptions[0]?.textContent || previousValue;

        const projects = new Map();

        for (const item of [
            ...calendarEvents,
            ...calendarLongTodos,
            ...calendarSubtasks
        ]) {
            if (item.projectId != null && item.projectId !== "") {
                projects.set(String(item.projectId), item.projectName);
            }
        }

        // Gewähltes Projekt behalten, auch wenn es in der neuen Woche
        // keine Einträge besitzt.
        if (previousValue && !projects.has(previousValue)) {
            projects.set(previousValue, previousLabel);
        }

        select.replaceChildren(new Option("Alle Projekte", ""));

        const sortedProjects = [...projects.entries()].sort(
            (first, second) =>
                String(first[1]).localeCompare(String(second[1]), "de")
        );

        for (const [id, name] of sortedProjects) {
            select.append(new Option(name || "Unbenanntes Projekt", id));
        }

        select.value = previousValue;
    }

    function matchesCalendarFilters(item) {
        const projectId =
            document.getElementById("calendarProjectFilter").value;

        const type =
            document.getElementById("calendarTypeFilter").value;

        const matchesProject = !projectId || item.projectId === projectId;
        const matchesType = !type || item.type === type;

        return matchesProject && matchesType;
    }

    function renderUnscheduledSubtasks() {
    const container = document.getElementById("unscheduledSubtasks");
    container.replaceChildren();

    const tasks = calendarSubtasks.filter(task =>
        task.start === null && matchesCalendarFilters(task)
    );

    for (const task of tasks) {
        const card = document.createElement("article");
        card.className = "calendar-unscheduled-card";

        const title = document.createElement("h3");
        title.textContent = task.title;

        const context = document.createElement("p");
        context.textContent = task.context;

        const deadline = document.createElement("p");
        deadline.textContent =
            `Frist: ${dateFormatter.format(task.deadline)}, `
            + `${timeFormatter.format(task.deadline)} Uhr`;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn";
        button.textContent = "Einplanen";
        button.setAttribute("aria-haspopup", "dialog");
        button.setAttribute("aria-label", `${task.title} einplanen`);
        button.addEventListener("click", () => openScheduleDialog(task));

        card.append(title, context, deadline, button);
        container.append(card);
    }

    if (tasks.length === 0) {
        const empty = document.createElement("p");
        empty.textContent =
            "Keine ungeplanten Teilaufgaben für diese Filterauswahl.";
        container.append(empty);
    }
    }

    function localDateValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function localTimeValue(date) {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return `${hours}:${minutes}`;
    }

    function openScheduleDialog(task) {
        selectedSubtask = task;

        const dialog = document.getElementById("calendarScheduleDialog");
        const form = document.getElementById("calendarScheduleForm");
        const error = document.getElementById("calendarScheduleError");

        const dateInput = document.getElementById("calendarScheduleDate");
        const startInput = document.getElementById("calendarScheduleStart");
        const endInput = document.getElementById("calendarScheduleEnd");

        const isEditing = task.start !== null && task.end !== null;

        form.reset();
        resetScheduleConflict();
        error.textContent = "";
        error.hidden = true;

        document.getElementById("calendarScheduleTitle").textContent =
            isEditing ? "Zeitfenster ändern" : "Teilaufgabe einplanen";

        form.querySelector('button[type="submit"]').textContent = isDemoMode
            ? (isEditing ? "Änderung in Vorschau übernehmen" : "In Vorschau einplanen")
            : (isEditing ? "Änderung speichern" : "Einplanen");

        document.getElementById("calendarScheduleTask").textContent =
            task.title;

        document.getElementById("calendarScheduleDeadline").textContent =
            `Planbar ab ${dateFormatter.format(task.earliestStart)}, `
            + `${timeFormatter.format(task.earliestStart)} Uhr `
            + `bis ${dateFormatter.format(task.deadline)}, `
            + `${timeFormatter.format(task.deadline)} Uhr.`;

        dateInput.min = localDateValue(task.earliestStart);
        dateInput.max = localDateValue(task.deadline);

        if (isEditing) {
            dateInput.value = localDateValue(task.start);
            startInput.value = localTimeValue(task.start);
            endInput.value = localTimeValue(task.end);
        }

        dialog.showModal();
    }

    function resetScheduleConflict() {
    document.getElementById("calendarScheduleConflict").hidden = true;
    document.getElementById("calendarScheduleConflictList")
        .replaceChildren();
    document.getElementById("calendarScheduleConflictConfirm")
        .checked = false;
    }

    async function findScheduleConflicts(start, end, currentSubtask) {
        let events;

        if (isDemoMode) {
            events = [...calendarEvents, ...calendarSubtasks];
        } else {
            // Die Woche des gewählten Zeitfensters prüfen.
            // Sie kann von der gerade angezeigten Woche abweichen.
            const week = localDateValue(getMonday(start));
            const data = await window.PlanBApi.getCalendarWeek(week);
            const mapped = mapCalendarWeek(data);

            events = [...mapped.events, ...mapped.subtasks];
        }

        return events.filter(item => {
            // API-Antworten enthalten neue Objekte.
            // Deshalb zusätzlich anhand der Teilaufgaben-ID vergleichen.
            if (
                item === currentSubtask
                || (
                    item.type === "subtask"
                    && item.id != null
                    && String(item.id) === String(currentSubtask.id)
                )
            ) {
                return false;
            }

            if (
                !(item.start instanceof Date)
                || !(item.end instanceof Date)
                || !Number.isFinite(item.start.getTime())
                || !Number.isFinite(item.end.getTime())
                || item.end <= item.start
            ) {
                return false;
            }

            return start < item.end && end > item.start;
        });
    }

   async function scheduleSelectedSubtask(event) {
        event.preventDefault();

        if (!selectedSubtask || isSavingSchedule) return;

        const task = selectedSubtask;

        const date = document.getElementById("calendarScheduleDate").value;
        const startTime =
            document.getElementById("calendarScheduleStart").value;
        const endTime =
            document.getElementById("calendarScheduleEnd").value;

        const start = new Date(`${date}T${startTime}`);
        const end = new Date(`${date}T${endTime}`);

        const error = document.getElementById("calendarScheduleError");
        let errorMessage = "";

        if (
            !Number.isFinite(start.getTime())
            || !Number.isFinite(end.getTime())
        ) {
            errorMessage =
                "Bitte gib ein gültiges Datum und beide Uhrzeiten an.";
        } else if (
            localDateValue(start) !== date
            || localDateValue(end) !== date
            || localTimeValue(start) !== startTime
            || localTimeValue(end) !== endTime
        ) {
            errorMessage =
                "Dieses Datum oder diese Uhrzeit ist nicht gültig.";
        } else if (end <= start) {
            errorMessage = "Das Ende muss nach dem Beginn liegen.";
        } else if (start < task.earliestStart) {
            errorMessage =
                "Das Zeitfenster darf nicht vor dem Beginn des langen To-Dos starten.";
        } else if (end > task.deadline) {
            errorMessage =
                "Das Zeitfenster darf nicht nach der Frist des langen To-Dos enden.";
        }

        error.textContent = errorMessage;
        error.hidden = !errorMessage;

        if (errorMessage) return;

        const conflictBox =
            document.getElementById("calendarScheduleConflict");
        const conflictList =
            document.getElementById("calendarScheduleConflictList");
        const conflictConfirm =
            document.getElementById("calendarScheduleConflictConfirm");

        const submitButton = document.querySelector(
            '#calendarScheduleForm button[type="submit"]'
        );

        const previousButtonText = submitButton.textContent;

        await runScheduleAction(async () => {
            try {
                submitButton.textContent = "Zeitfenster wird geprüft …";

                const conflicts = await findScheduleConflicts(start, end, task);

                if (conflicts.length > 0) {
                    // Eine Bestätigung gilt nur für genau dieses Zeitfenster
                    // und die zuletzt angezeigten Konflikte.
                    const conflictKey = JSON.stringify([
                        task.id,
                        start.toISOString(),
                        end.toISOString(),
                        conflicts.map(item => JSON.stringify([
                            item.type,
                            item.id,
                            item.title,
                            item.start.toISOString(),
                            item.end.toISOString()
                        ])).sort()
                    ]);

                    if (conflictConfirm.dataset.conflictKey !== conflictKey) {
                        conflictConfirm.checked = false;
                    }

                    conflictConfirm.dataset.conflictKey = conflictKey;
                    conflictList.replaceChildren();

                    conflicts.forEach(item => {
                        const entry = document.createElement("li");

                        entry.textContent =
                            `${item.title}: `
                            + `${dateFormatter.format(item.start)}, `
                            + `${timeFormatter.format(item.start)} Uhr bis `
                            + `${dateFormatter.format(item.end)}, `
                            + `${timeFormatter.format(item.end)} Uhr`;

                        conflictList.append(entry);
                    });

                    conflictBox.hidden = false;

                    if (!conflictConfirm.checked) return;
                } else {
                    resetScheduleConflict();
                }

                submitButton.textContent = isDemoMode
                    ? "Vorschau wird aktualisiert …"
                    : "Zeitfenster wird gespeichert …";

                await persistSubtaskSchedule(task, start, end);

                await finishScheduleChange(
                    start,
                    "Zeitfenster gespeichert."
                );
            } catch (requestError) {
                error.textContent =
                    "Zeitfenster konnte nicht übernommen werden. "
                    + (requestError.message || "Bitte versuche es erneut.");

                error.hidden = false;
            } finally {
                submitButton.textContent = previousButtonText;
            }
        });

        // Erst nach Freigabe der Eingaben den Fokus setzen.
        if (
            document.getElementById("calendarScheduleDialog").open
            && !conflictBox.hidden
            && !conflictConfirm.checked
            && error.hidden
        ) {
            conflictConfirm.focus();
        }
    }

    function scrollToMorning() {
        const styles = getComputedStyle(
            document.querySelector(".calendar-page")
        );

        const hourHeight = parseFloat(
            styles.getPropertyValue("--calendar-hour-height")
        ) || 60;

        scrollArea.scrollTop = 8 * hourHeight;
    }

    document.getElementById("previousWeek").addEventListener("click", () => {
        currentMonday = addDays(currentMonday, -7);
        void loadCalendar();
    });

    document.getElementById("nextWeek").addEventListener("click", () => {
        currentMonday = addDays(currentMonday, 7);
        void loadCalendar();
    });

    document.getElementById("todayButton").addEventListener("click", () => {
        currentMonday = getMonday(new Date());
        void loadCalendar();
        scrollToMorning();
    });

    const message = document.getElementById("calendarMessage");
    message.hidden = false;
    message.textContent = isDemoMode
        ? "Vorschau mit Beispieldaten – keine Verbindung zum Backend."
        : "Die Kalender-Anbindung wird vorbereitet. Es sind noch keine Daten geladen.";

    document.getElementById("calendarTypeFilter")
        .addEventListener("change", renderWeek);

    document.getElementById("calendarScheduleForm")
    .addEventListener("submit", scheduleSelectedSubtask);

    document.getElementById("calendarScheduleCancel")
    .addEventListener("click", () => {
        document.getElementById("calendarScheduleDialog").close();
        selectedSubtask = null;
    });

    [
    "calendarScheduleDate",
    "calendarScheduleStart",
    "calendarScheduleEnd"
    ].forEach(id => {
        document.getElementById(id)
            .addEventListener("input", resetScheduleConflict);
    });

    // Während einer laufenden Anfrage bleiben die Dialoge geöffnet.
    // Nach Abschluss funktioniert Escape wieder wie gewohnt.
    ["calendarScheduleDialog", "calendarDetails"].forEach(id => {
        document.getElementById(id).addEventListener("cancel", event => {
            if (isSavingSchedule) {
                event.preventDefault();
            }
        });
    });

    if (!isDemoMode) {
        document.querySelector(".calendar-sidebar > p").textContent =
            "Deine offenen Teilaufgaben ohne Zeitfenster. "
            + "Die Liste ist unabhängig von der angezeigten Woche.";

        document.querySelector(
            "#calendarScheduleDialog .calendar-details-note"
        ).textContent =
            "Die Planung wird gespeichert. "
            + "Überschneidungen mit deinen Plan-B-Terminen werden "
            + "vor dem Speichern geprüft.";
    }

    renderTimeLabels();
    void loadCalendar();
    requestAnimationFrame(scrollToMorning);
})();
