(function () {
    'use strict';

    const api = window.PlanBApi;
    const ui = window.PlanBUI;

    const filterForm = document.querySelector(
        '#dashboardFilters'
    );

    const openTaskBody = document.querySelector(
        '#openTaskBody'
    );

    const doneTaskBody = document.querySelector(
        '#doneTaskBody'
    );

    const messageBox = document.querySelector(
        '#dashboardMessage'
    );

    let currentTasks = [];

    init();

    async function init() {
        setDefaultDashboardFilters();
        filterForm.addEventListener(
            'submit',
            event => {
                event.preventDefault();
                loadDashboard();
            }
        );

        document.querySelector(
            '#clearDashboardFilters'
        ).addEventListener('click', () => {
            setDefaultDashboardFilters();
            loadDashboard();
        });

        await loadDashboard();
    }

    function startofCurrentWeek(date = new Date()) {
        const result = new Date(date);
        const day = result.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        result.setDate(result.getDate() + diff);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    function toDateTimeLocal(date) {
        const pad = value => String(value).padStart(2, '0');
        return date.getFullYear() + '-' +
            pad(date.getMonth() + 1) + '-' +
            pad(date.getDate()) + 'T' +
            pad(date.getHours()) + ':' +
            pad(date.getMinutes());
    }

    function setDefaultDashboardFilters() {
        const currentWeekStart = startofCurrentWeek();
        const lastWeekStart = new Date(currentWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        filterForm.elements.from.value = toDateTimeLocal(lastWeekStart);
        filterForm.elements.to.value = '';
    }

    function readFilters() {
        return {
            from: filterForm.elements.from.value || null,
            to: filterForm.elements.to.value || null,
            priority: filterForm.elements.priority.value || null
        };
    }

    async function loadDashboard() {
        showMessage('Aufgaben werden geladen …', false);

        try {
            currentTasks =
                await api.getMyDashboardTasks(
                    readFilters()
                );

            renderOpenTasks();
            renderRecentlyDoneTasks();

            hideMessage();
        } catch (error) {
            showMessage(
                error.message ||
                'Die Aufgaben konnten nicht geladen werden.',
                true
            );
        }
    }

    function renderOpenTasks() {
        const openTasks = currentTasks
            .filter(task => !task.done)
            .sort(sortByStartOrEnd);

        if (!openTasks.length) {
            openTaskBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty">
                        Keine offenen Aufgaben gefunden.
                    </td>
                </tr>
            `;
            return;
        }

        openTaskBody.innerHTML =
            openTasks.map(renderOpenRow).join('');
    }

    function renderRecentlyDoneTasks() {
        const doneTasks = currentTasks.filter(task => task.done).sort(sortByStartOrEnd);

        if (!doneTasks.length) {
            doneTaskBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty">
                        Es wurden noch keine Aufgaben erledigt.
                    </td>
                </tr>
            `;
            return;
        }

        doneTaskBody.innerHTML =
            doneTasks.map(renderDoneRow).join('');
    }

    function renderOpenRow(task) {
        return `
            <tr>
                <td>
                    ${renderTaskLink(task)}
                </td>
                <td>${escapeHtml(typeLabel(task))}</td>
                <td>${escapeHtml(task.projectName || '–')}</td>
                <td>${formatDate(task.start)}</td>
                <td>${formatDate(task.end)}</td>
                <td>${escapeHtml(priorityLabel(task))}</td>
            </tr>
        `;
    }

    function renderDoneRow(task) {

        return `
            <tr>
                <td>
                    ${renderTaskLink(task)}
                </td>
                <td>${escapeHtml(typeLabel(task))}</td>
                <td>${escapeHtml(task.projectName || '–')}</td>
                <td>Erledigt</td>
                <td>${escapeHtml(priorityLabel(task))}</td>
            </tr>
        `;
    }

    function renderTaskLink(task) {
        if (!task.projectId) {
            return escapeHtml(task.title);
        }

        const url =
            '../../Projekte/HTML/project.html?id=' +
            encodeURIComponent(task.projectId);

        return `
            <a href="${url}">
                ${escapeHtml(task.title)}
            </a>
        `;
    }

    function typeLabel(task) {
        if (task.type === 'MEETING') {
            return 'Meeting';
        }

        if (task.type === 'LANGES_TODO') {
            return 'Langes To-do';
        }

        if (task.type === 'SUBTASK') {
            return 'Untertask';
        }

        return 'Aufgabe';
    }

    function priorityLabel(task) {
        const priorities = {
            HIGH: 'Hoch',
            MEDIUM: 'Mittel',
            LOW: 'Niedrig'
        };

        return priorities[task.priority] ||
            task.priority ||
            '–';
    }

    function sortByStartOrEnd(a, b) {
        const valueA = a.start || a.end || '';
        const valueB = b.start || b.end || '';

        return valueA.localeCompare(valueB);
    }

    function formatDate(value) {
        if (!value) {
            return '–';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return '–';
        }

        return date.toLocaleString(
            'de-DE',
            {
                dateStyle: 'short',
                timeStyle: 'short'
            }
        );
    }

    function showMessage(message, isError) {
        messageBox.textContent = message;
        messageBox.hidden = false;
        messageBox.classList.toggle(
            'error',
            Boolean(isError)
        );
    }

    function hideMessage() {
        messageBox.hidden = true;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character]);
    }
})();
