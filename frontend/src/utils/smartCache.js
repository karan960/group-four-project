const DB_NAME = 'campus-connect-cache';
const STORE_NAME = 'http-cache';
const DB_VERSION = 1;

const memoryCache = new Map();

const openDb = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    resolve(null);
    return;
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'key' });
    }
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const runTx = async (mode, task) => {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    task(store, resolve, reject);

    tx.onerror = () => reject(tx.error);
  });
};

export const buildCacheKey = (method, url, params = {}) => {
  const normalizedParams = Object.keys(params || {})
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  return `${String(method || 'GET').toUpperCase()}::${url}::${JSON.stringify(normalizedParams)}`;
};

export const setCacheEntry = async (key, value, ttlMs = 30000) => {
  const now = Date.now();
  const record = {
    key,
    value,
    storedAt: now,
    expiresAt: now + Math.max(1000, Number(ttlMs || 0))
  };

  memoryCache.set(key, record);

  try {
    await runTx('readwrite', (store, resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // IndexedDB is best-effort only.
  }

  return record;
};

export const getCacheEntry = async (key) => {
  const fromMemory = memoryCache.get(key);
  if (fromMemory) return fromMemory;

  try {
    const fromDb = await runTx('readonly', (store, resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (fromDb) {
      memoryCache.set(key, fromDb);
      return fromDb;
    }
  } catch {
    // IndexedDB read failure should never break the app.
  }

  return null;
};

export const isFresh = (record) => {
  if (!record || !record.expiresAt) return false;
  return Date.now() <= record.expiresAt;
};

export const clearExpiredCache = async () => {
  const now = Date.now();

  for (const [key, value] of memoryCache.entries()) {
    if (!value?.expiresAt || value.expiresAt < now) {
      memoryCache.delete(key);
    }
  }

  try {
    await runTx('readwrite', (store, resolve, reject) => {
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve(true);
          return;
        }

        const entry = cursor.value;
        if (!entry?.expiresAt || entry.expiresAt < now) {
          cursor.delete();
        }
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch {
    // Ignore cleanup errors.
  }
};
