// 그림책 라이브러리·위치 정보를 IndexedDB에 저장하는 유틸

const DB_NAME = 'pb-bookshelf';
const DB_VERSION = 1;
const STORE_LIBRARY = 'library';
const STORE_POSITIONS = 'positions';

// LocalStorage 구버전 키 (한 번 마이그레이션 후 삭제)
const LS_LIBRARY_KEY = 'pb-library-v1';
const LS_POSITION_KEY = 'pb-positions-v1';
const LS_MIGRATED_KEY = 'pb-idb-migrated-v1';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_LIBRARY)) {
        db.createObjectStore(STORE_LIBRARY, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_POSITIONS)) {
        db.createObjectStore(STORE_POSITIONS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ─── 라이브러리 ─────────────────────────────────────────── */

async function loadLibraryIDB() {
  try {
    const rows = await idbGetAll(STORE_LIBRARY);
    // page 순서 유지를 위해 저장 순서(index) 기준 정렬
    rows.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return rows.map((r) => r.data);
  } catch {
    return [];
  }
}

async function saveLibraryIDB(books) {
  try {
    await idbClear(STORE_LIBRARY);
    for (let i = 0; i < books.length; i++) {
      const key = bookKeyFromData(books[i]);
      await idbPut(STORE_LIBRARY, { key, index: i, data: books[i] });
    }
  } catch (e) {
    console.warn('[IDB] 라이브러리 저장 실패:', e);
  }
}

/* ─── 위치 ───────────────────────────────────────────────── */

async function loadPositionsIDB() {
  try {
    const rows = await idbGetAll(STORE_POSITIONS);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

async function savePositionIDB(key, idx) {
  try {
    await idbPut(STORE_POSITIONS, { key, value: idx });
  } catch (e) {
    console.warn('[IDB] 위치 저장 실패:', e);
  }
}

/* ─── LocalStorage → IndexedDB 1회 마이그레이션 ─────────── */

async function migrateFromLocalStorage() {
  try {
    if (localStorage.getItem(LS_MIGRATED_KEY)) return;
    const rawLib = localStorage.getItem(LS_LIBRARY_KEY);
    const rawPos = localStorage.getItem(LS_POSITION_KEY);
    if (rawLib) {
      const books = JSON.parse(rawLib);
      if (Array.isArray(books) && books.length > 0) {
        await saveLibraryIDB(books);
      }
    }
    if (rawPos) {
      const positions = JSON.parse(rawPos);
      for (const [key, val] of Object.entries(positions)) {
        await savePositionIDB(key, val);
      }
    }
    localStorage.setItem(LS_MIGRATED_KEY, '1');
    // 마이그레이션 완료 후 구 데이터 정리
    localStorage.removeItem(LS_LIBRARY_KEY);
    localStorage.removeItem(LS_POSITION_KEY);
  } catch (e) {
    console.warn('[IDB] 마이그레이션 실패:', e);
  }
}

/* ─── 헬퍼 ──────────────────────────────────────────────── */

function bookKeyFromData(book) {
  const s = book?.student || {};
  return `${s.class || ''}-${s.name || ''}-${s.title || ''}`;
}

window.PB_IDB = {
  loadLibrary: loadLibraryIDB,
  saveLibrary: saveLibraryIDB,
  loadPositions: loadPositionsIDB,
  savePosition: savePositionIDB,
  migrate: migrateFromLocalStorage,
  bookKey: bookKeyFromData,
};
