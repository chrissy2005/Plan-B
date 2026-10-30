const CACHE_NAME = "project-app-v7";

const APP_SHELL = [
    "/",
    "/Home/HTML/index.html",
    "/Home/JS/menu.js",
    "/Home/CSS/menu.css",
    "/Login/HTML/login.html",
    "/Login/HTML/register.html",
    "/Login/JS/login.js",
    "/Login/JS/passwort-toggle.js",
    "/Login/JS/register.js",
    "Login/CSS/login-register.css",
    "/offline.html",
    "/Projekte/HTML/projects.html",
    "/Projekte/HTML/project.html",
    "/Projekte/HTML/create-new-project.html",
    "/Projekte/HTML/task-manage.html",
    "/Projekte/JS/api.js",
    "/Projekte/JS/create-new-project.js",
    "/Projekte/JS/project.js",
    "/Projekte/JS/projects.js",
    "/Projekte/JS/task-manage.js",
    "/Projekte/JS/ui.js",
    "/Projekte/CSS/projects.css",
    "/Projekte/CSS/create-new-project.css",
    "/icons/eye-slash.svg",
    "/icons/eye.svg",
    "Projekte/JS/offline-db.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
        cache.addAll(APP_SHELL)
        )
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
     caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) =>
            key.startsWith("project-app-") && key !== CACHE_NAME
        )
       .map((key) => caches.delete(key))
      )
     )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if(url.origin !== self.location.origin) return;
    if(request.method !== "GET") return;
    if(request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(async () => {
                const cached = await caches.match(request);
                if(cached) return cached;
                const offlinePage = await caches.match("/offline.html");
                if(offlinePage) return offlinePage;
                return new Response("Diese Seite ist offline nicht verfügbar.", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}} );
            })
        );
        return;
    }
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if(cachedResponse) return cachedResponse;
            return fetch(request);
        })
    );
});

