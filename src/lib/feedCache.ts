type FeedCacheEntry<T> = {
  items: T[];
  nextCursor: string | null;
  savedAt: number;
};

const DB_NAME = "beliefted-cache";
const DB_VERSION = 1;
const STORE = "feed";

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const readFeedCache = async <T>(key: string) => {
  try {
    const db = await openDb();
    return await new Promise<FeedCacheEntry<T> | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve((request.result as FeedCacheEntry<T> | undefined) ?? null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const writeFeedCache = async <T>(key: string, entry: FeedCacheEntry<T>) => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.put(entry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore cache write errors
  }
};

