/* =====================================================================
   Plan B - Projektuebersicht "Meine Projekte"
   KI-Log Nr. 31
   Backend-Aufrufe: api.getProjects(), api.createProject()  (siehe api.js)
   ===================================================================== */
(function () {
  'use strict';

  const api = window.PlanBApi;
  const ui = window.PlanBUI;
  const { $, esc } = ui;

  const list = $('#projectList');
  const form = $('#newProjectForm');

  ui.initTopbar(api);
  loadProjects();

  function openNewProjectModal() {
    form.reset();
    ui.clearFormError(form);
    ui.openModal('newProjectModal');
  }

  $('#newProjectButton').addEventListener('click', openNewProjectModal);

  // KI-Log Nr. 50: Der frühere create-new-project.html-Einstieg verwendet
  // dasselbe zentrale Formular und erzeugt keine zweite Projektanlage.
  if (window.location.hash === '#new') {
    openNewProjectModal();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  async function loadProjects() {
    try {
      // BACKEND: GET /projects
      const projects = await api.getProjects();
      renderProjects(projects);
    } catch (error) {
      // KI-Log Nr. 57: GET /projects ist im aktuellen Backend noch nicht vorhanden.
      // Diese Meldung trennt fehlende GET-Unterstützung von einem echten Rollenfehler.
      const message = error.status === 403 || error.status === 404
        ? 'Die Projektübersicht kann noch nicht geladen werden, weil GET /projects im Backend noch fehlt.'
        : error.message;
      list.innerHTML = `<p class="page-message" role="alert">${esc(message)}</p>`;
    }
  }

  function renderProjects(projects) {
    if (!projects.length) {
      list.innerHTML = '<p class="empty">Du bist noch in keinem Projekt. Lege ein neues Projekt an oder nimm eine Einladung an.</p>';
      return;
    }
    list.innerHTML = projects.map(p => {
      const closed = p.status === 'COMPLETED';
      const canDelete = p.myRole === 'PROJECT_LEADER';
      return `
        <article class="project-card${closed ? ' is-closed' : ''}">
          <div class="row">
            <a class="project-card-link" href="project.html?id=${encodeURIComponent(p.id)}">
              <h3>${esc(p.title)}</h3>
              <span class="pill">${esc(ui.STATUS[p.status] || p.status)}</span>
            </a>
          </div>
          <div class="project-card-footer">
            <p>Rolle: ${esc(ui.ROLE[p.myRole] || p.myRole)}</p>
            ${canDelete ? `<button class="btn btn-sm project-delete" type="button" data-project="${esc(p.id)}" data-title="${esc(p.title)}">Projekt löschen</button>` : ''}
          </div>
        </article>`;
    }).join('');
  }

  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-project]');
    if (!button) return;
    event.preventDefault();
    const title = button.dataset.title || 'dieses Projekt';
    if (!window.confirm(`Möchtest du das Projekt „${title}“ wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`)) return;
    await ui.withBusy(button, async () => {
      try {
        await api.deleteProject(button.dataset.project);
        ui.toast('Projekt wurde gelöscht.');
        await loadProjects();
      } catch (error) {
        ui.toast(error.message, true);
      }
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    ui.clearFormError(form);
    const title = form.elements.title.value.trim();
    const description = form.elements.description.value.trim();
    if (!title) {
      ui.showFormError(form, 'Bitte einen Titel eingeben.');
      form.elements.title.focus();
      return;
    }
    await ui.withBusy($('#createProjectSubmit'), async () => {
      try {
        // KI-Log Nr. 57: Nach dem POST die Projektansicht öffnen.
        // project.js sendet dort getrennte GETs für Meetings und Long-To-Dos.
        // BACKEND: POST /projects -> { id|projectId, message }
        const created = await api.createProject({ title, description });
        window.location.href = 'project.html?id=' + encodeURIComponent(created.id);
      } catch (error) {
        ui.showFormError(form, error.message);
      }
    });
  });
})();
