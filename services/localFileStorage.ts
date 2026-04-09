const DB_NAME = 'RivezM3ayaFiles';
const STORE_NAME = 'files';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'deckId' });
      }
    };
  });
};

export const saveFilesLocally = async (deckId: string, files: { name: string, mimeType: string, data: string }[]) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ deckId, files });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getFilesLocally = async (deckId: string): Promise<{ name: string, mimeType: string, data: string }[] | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(deckId);
    request.onsuccess = () => resolve(request.result ? request.result.files : null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteFilesLocally = async (deckId: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(deckId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
