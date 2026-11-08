const CACHE_NAME = "project-app-v36";

const APP_SHELL = [
    "/",
    "/Home/HTML/index.html",
    "/Home/JS/menu.js",
    "/Home/CSS/menu.css",
    "/Home/CSS/home.css",
    "/Login/HTML/login.html",
    "/Login/HTML/register.html",
    "/Login/JS/login.js",
    "/Login/JS/passwort-toggle.js",
    "/Login/JS/register.js",
    "/Login/CSS/login-register.css",
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
    "/Projekte/JS/offline-db.js",
    "/icons/plan-b.svg",
    "/Kalender/HTML/calender.html",
    "/Kalender/JS/calendar.js",
    "/Kalender/CSS/calendar.css"
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
    const staticDestinations = [
        "style",
        "script",
        "image",
        "font"
    ];
    if(staticDestinations.includes(request.destination)){
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(request);
                if (networkResponse.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            } catch (error) {
                const cachedResponse = await caches.match(request, { ignoreSearch: true });
                if (cachedResponse) {
                    return cachedResponse;
                }
                throw error;
            }
        })()
        );
        return;
    }
    /* old Code without catching heroku server not available error
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
    ); */
    //new Code that catches the heroku server not available error, so that the cache can be load
    if(request.mode === "navigate") {
        event.respondWith(
            fetch(request).then(response => {
                if(!response.ok){
                throw new Error("Frontend-Server antwortet mit HTTP " + response.status);
                }
                return response;
            })
            .catch(async () => {
                const cachedPage = await caches.match(request, {ignoreSearch: true});
                if(cachedPage){
                    return cachedPage;
                }
                const offlinePage = await caches.match("/offline.html");
                if(offlinePage) {
                    return offlinePage;
                }
                return new Response("Diese Seite ist offline nicht verfügbar.", {
                    status: 503,
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8"
                    }
                });
            })
        );
        return;
    }
    event.respondWith(caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request);
    }));
});
