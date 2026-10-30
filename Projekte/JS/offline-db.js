window.offlineDbReady = new Promise(resolve => {
    window.resolveOfflineDb = resolve;
});
const DB_NAME = "plan-b-offline";
const DB_VERSION = 1;

let dbPromise;
console.info("[Offline-DB]: offline-db.js wurde geladen.");
function openOfflineDb(){
    if(dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if(!db.objectStoreNames.contains("projects")){
                db.createObjectStore("projects", { keyPath: "projectId" });
            }
            if(!db.objectStoreNames.contains("members")){
                db.createObjectStore("members", { keyPath: "projectId" });
            }
            if(!db.objectStoreNames.contains("longToDos")){
                db.createObjectStore("longToDos", { keyPath: "projectId" });
            }
            if(!db.objectStoreNames.contains("meetings")){
                db.createObjectStore("meetings", { keyPath: "projectId" });
            }
            if(!db.objectStoreNames.contains("calendarWeeks")){
                db.createObjectStore("calendarWeeks", { keyPath: "weekKey" });
            }
            if(!db.objectStoreNames.contains("metadata")){
                db.createObjectStore("metadata", { keyPath: "key" });
            }
        };

        request.onsuccess = event => {
            const db = event.target.result;
            db.onversionchange = () => {
                db.close();
                dbPromise = undefined;
            };
            resolve(db);
        };

        request.onerror = () => {
            dbPromise = undefined;
            reject(request.error);
        };

        request.onblocked = () => {
            console.warn("IndexedDB-Upgrade blocked. " + "Close other tabs from application.");
        };

    });
    return dbPromise;
}

function getRecord(storeName, key) {
    return openOfflineDb().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const request = transaction.objectStore(storeName).get(key);
            request.onsuccess = () => {
                resolve(request.result ?? null);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}

function putRecord(storeName, record) {
    return openOfflineDb().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readwrite");
            transaction.objectStore(storeName).put(record);
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
            transaction.onabort = () => {
                reject(transaction.error);
            };
        });
    });
}

function putManyRecords(storeName, records){
    return openOfflineDb().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            records.forEach(record => {
                store.put(record);
            });
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
            transaction.onabort = () => {
                reject(transaction.error);
            };
        
        
        });
    });
}

function getAllRecords(storeName){
    return openOfflineDb().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const request = transaction.objectStore(storeName).getAll();
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}

function clearOfflineData() {
    return openOfflineDb().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                [
                    "projects",
                    "members",
                    "longToDos",
                    "meetings",
                    "calendarWeeks",
                    "metadata"
                ],
                "readwrite"
            );
            [
                "projects",
                "members",
                "longToDos",
                "meetings",
                "calendarWeeks",
                "metadata"
            ].forEach(storeName => {
                transaction.objectStore(storeName).clear();
            });

            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
            transaction.onabort = () => {
                reject(transaction.error);
            };
        });
    });
}

console.info("[Offline-DB]: Vor Registrierung");
console.info({
    openOfflineDb: typeof openOfflineDb,
    getRecord: typeof getRecord,
    putRecord: typeof putRecord,
    putManyRecords: typeof putManyRecords,
    getAllRecords: typeof getAllRecords,
    clearOfflineData: typeof clearOfflineData
});
window.offlineDb = {
    openOfflineDb,
    getRecord,
    putRecord,
    putManyRecords,
    getAllRecords,
    clearOfflineData
};
window.resolveOfflineDb(window.offlineDb);
console.info("[Offline-DB]: Globale API registriert", window.offlineDb);