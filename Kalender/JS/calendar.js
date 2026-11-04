(() => {
    "use strict";

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

let selectedSubtask = null;

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
});

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

    const scheduledSubtasks = demoUnscheduledSubtasks.filter(task =>
    task.start !== null && task.end !== null
    );

    renderEvents(
        [...demoEvents, ...scheduledSubtasks].filter(matchesCalendarFilters)
    );

    renderLongTodos(demoLongTodos.filter(matchesCalendarFilters));
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

        const progress =
            `${todo.completedSubtasks}/${todo.totalSubtasks} Teilaufgaben`;

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
    progress.hidden = item.type !== "longTodo";
    progress.textContent = item.type === "longTodo"
        ? `${item.completedSubtasks} von ${item.totalSubtasks} `
            + "Teilaufgaben erledigt."
        : "";

        const editableSubtask = item.type === "subtask"
            ? demoUnscheduledSubtasks.find(task => task.id === item.id)
            : null;

        const actions = document.getElementById("calendarDetailsActions");
        const editButton = document.getElementById("calendarEditSchedule");
        const removeButton = document.getElementById("calendarRemoveSchedule");

        actions.hidden = !editableSubtask;

        editButton.onclick = () => {
            if (!editableSubtask) {
                return;
            }

            dialog.close();
            openScheduleDialog(editableSubtask);
        };

        removeButton.onclick = () => {
            if (!editableSubtask) {
                return;
            }

            editableSubtask.start = null;
            editableSubtask.end = null;

            dialog.close();
            renderWeek();
        };

        dialog.showModal();
    }

        function initializeProjectFilter() {
        const select = document.getElementById("calendarProjectFilter");
        const projects = new Map();

        for (const item of [
            ...demoEvents,
            ...demoLongTodos,
            ...demoUnscheduledSubtasks
        ]) {
            projects.set(item.projectId, item.projectName);
        }

        select.replaceChildren(new Option("Alle Projekte", ""));

        const sortedProjects = [...projects.entries()].sort(
            (first, second) => first[1].localeCompare(second[1], "de")
        );

        for (const [id, name] of sortedProjects) {
            select.append(new Option(name, id));
        }
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

    const tasks = demoUnscheduledSubtasks.filter(task =>
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

        form.querySelector('button[type="submit"]').textContent =
            isEditing ? "Änderung in Vorschau übernehmen" : "In Vorschau einplanen";

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

    function findScheduleConflicts(start, end, currentSubtask) {
        const events = [
            ...demoEvents,
            ...demoUnscheduledSubtasks
        ];

        return events.filter(item => {
            // Beim Ändern nicht mit dem eigenen bisherigen Zeitfenster vergleichen.
            if (item === currentSubtask) {
                return false;
            }

            if (item.type !== "meeting" && item.type !== "subtask") {
                return false;
            }

            if (!(item.start instanceof Date)
                || !(item.end instanceof Date)
                || !Number.isFinite(item.start.getTime())
                || !Number.isFinite(item.end.getTime())
                || item.end <= item.start) {
                return false;
            }

            return start < item.end && end > item.start;
        });
    }

   function scheduleSelectedSubtask(event) {
        event.preventDefault();

        if (!selectedSubtask) {
            return;
        }

        const date = document.getElementById("calendarScheduleDate").value;
        const startTime =
            document.getElementById("calendarScheduleStart").value;
        const endTime =
            document.getElementById("calendarScheduleEnd").value;

        const start = new Date(`${date}T${startTime}`);
        const end = new Date(`${date}T${endTime}`);

        const error = document.getElementById("calendarScheduleError");
        let errorMessage = "";

        if (!Number.isFinite(start.getTime())
            || !Number.isFinite(end.getTime())) {
            errorMessage =
                "Bitte gib ein gültiges Datum und beide Uhrzeiten an.";
        } else if (end <= start) {
            errorMessage =
                "Das Ende muss nach dem Beginn liegen.";
        } else if (start < selectedSubtask.earliestStart) {
            errorMessage =
                "Das Zeitfenster darf nicht vor dem Beginn des langen To-Dos starten.";
        } else if (end > selectedSubtask.deadline) {
            errorMessage =
                "Das Zeitfenster darf nicht nach der Frist des langen To-Dos enden.";
        }

        error.textContent = errorMessage;
        error.hidden = !errorMessage;

        if (errorMessage) {
            return;
        }

        const conflicts = findScheduleConflicts(start, end, selectedSubtask);
        const conflictBox = document.getElementById("calendarScheduleConflict");
        const conflictList =
            document.getElementById("calendarScheduleConflictList");
        const conflictConfirm =
            document.getElementById("calendarScheduleConflictConfirm");

        if (conflicts.length > 0) {
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

            if (!conflictConfirm.checked) {
                conflictConfirm.focus();
                return;
            }
        } else {
            resetScheduleConflict();
        }

        selectedSubtask.start = start;
        selectedSubtask.end = end;

        currentMonday = getMonday(start);

        document.getElementById("calendarScheduleDialog").close();
        selectedSubtask = null;

        renderWeek();
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
        renderWeek();
    });

    document.getElementById("nextWeek").addEventListener("click", () => {
        currentMonday = addDays(currentMonday, 7);
        renderWeek();
    });

    document.getElementById("todayButton").addEventListener("click", () => {
        currentMonday = getMonday(new Date());
        renderWeek();
        scrollToMorning();
    });

    const message = document.getElementById("calendarMessage");
    message.hidden = false;
    message.textContent =
    "Vorschau mit Beispieldaten – keine Verbindung zum Backend.";

    document.getElementById("calendarProjectFilter")
    .addEventListener("change", renderWeek);

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

    initializeProjectFilter();
    renderTimeLabels();
    renderWeek();
    requestAnimationFrame(scrollToMorning);

    initializeProjectFilter();
    renderTimeLabels();
    renderWeek();
    requestAnimationFrame(scrollToMorning);
})();
