const DB_NAME = 'ExpenseApp';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('receipts')) {
        const store = db.createObjectStore('receipts', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('userProfile')) {
        db.createObjectStore('userProfile', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addReceipt(receipt) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('receipts', 'readwrite');
    const store = tx.objectStore('receipts');
    const req = store.add(receipt);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function updateReceipt(receipt) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('receipts', 'readwrite');
    const store = tx.objectStore('receipts');
    const req = store.put(receipt);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function deleteReceipt(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('receipts', 'readwrite');
    const store = tx.objectStore('receipts');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getAllReceipts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('receipts', 'readonly');
    const store = tx.objectStore('receipts');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getReceipt(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('receipts', 'readonly');
    const store = tx.objectStore('receipts');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function saveUserProfile(profile) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('userProfile', 'readwrite');
    const store = tx.objectStore('userProfile');
    const req = store.put({ key: 'profile', ...profile });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getUserProfile() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('userProfile', 'readonly');
    const store = tx.objectStore('userProfile');
    const req = store.get('profile');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
