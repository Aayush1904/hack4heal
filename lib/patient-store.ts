import type { StoredPatient } from '@/components/HomeScreen';

/**
 * Where patient data lives, and what is promised about it.
 *
 * PROMISE: a saved patient is kept on this device for at least 24 hours (RETENTION_MS). The app
 * itself never deletes or overwrites a patient automatically, and it never needs the network to
 * read or save one. To make that hold up in practice:
 *   1. Every save goes to localStorage (read synchronously by the screens) AND to IndexedDB,
 *      a second, separate browser store with far more room.
 *   2. On startup any patient missing from localStorage is restored from IndexedDB.
 *   3. The browser is asked to treat this storage as persistent, so it is not cleaned up
 *      automatically when the device runs low on space.
 *   4. If a save fails (storage full or blocked) the user is told, instead of it failing silently.
 *   5. A backup file can be downloaded and restored.
 *
 * NOT PROMISED: the user clearing the browser's site data, uninstalling the app, a different
 * address or browser profile, or a lost or broken device. No web app can survive those. The
 * backup file is the answer to them.
 */
export const RETENTION_MS = 24 * 60 * 60 * 1000;

export const PATIENTS_KEY = 'burnos_patients';
export const SAVED_AT_KEY = 'burnos_patients_savedAt';
export const PATIENTS_UPDATED = 'burnos_patients_updated';
export const STORAGE_ERROR = 'burnos_storage_error';

const DB_NAME = 'burnos';
const DB_STORE = 'kv';
const DB_KEY = 'patients';

/** Use this before adding any future "delete patient" feature: records younger than 24 h must be kept. */
export function isProtectedFromDeletion(patient: Pick<StoredPatient, 'createdAt'>, now = Date.now()): boolean {
  return now - new Date(patient.createdAt).getTime() < RETENTION_MS;
}

function parseList(raw: string | null): StoredPatient[] | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as StoredPatient[]) : null;
  } catch {
    return null;
  }
}

/** Patients from localStorage. Never throws. */
export function loadPatients(): StoredPatient[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseList(localStorage.getItem(PATIENTS_KEY)) ?? [];
  } catch {
    return [];
  }
}

// ── IndexedDB mirror ───────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeMirror(list: StoredPatient[], savedAt: string): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({ savedAt, patients: list }, DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

async function readMirror(): Promise<{ savedAt: string; patients: StoredPatient[] }> {
  try {
    const db = await openDb();
    const value = await new Promise<{ savedAt?: string; patients?: StoredPatient[] } | undefined>((resolve, reject) => {
      const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { savedAt: value?.savedAt ?? '', patients: Array.isArray(value?.patients) ? value!.patients! : [] };
  } catch {
    return { savedAt: '', patients: [] };
  }
}

// ── Saving ─────────────────────────────────────────────────────────

/** When storage is full, shrink the photos of older scans. No patient and no number is ever dropped. */
function withSmallerPhotos(list: StoredPatient[]): StoredPatient[] {
  return list.map((p) => {
    const lastScan = (p.scans?.length ?? 0) - 1;
    return {
      ...p,
      burnDebug: undefined,
      scans: p.scans?.map((s, i) => (i === lastScan ? s : { ...s, imageDataUrl: undefined })),
    };
  });
}

function announceError(message: string) {
  window.dispatchEvent(new CustomEvent(STORAGE_ERROR, { detail: { message } }));
}

/** Save the whole list to both stores. Returns whether localStorage (the one the screens read) was written. */
export function savePatients(list: StoredPatient[]): boolean {
  if (typeof window === 'undefined') return false;

  // The second copy is written first and in full, so it holds everything even if localStorage is tight.
  const savedAt = new Date().toISOString();
  void writeMirror(list, savedAt);

  let saved = false;
  try {
    localStorage.setItem(PATIENTS_KEY, JSON.stringify(list));
    localStorage.setItem(SAVED_AT_KEY, savedAt);
    saved = true;
  } catch {
    try {
      localStorage.setItem(PATIENTS_KEY, JSON.stringify(withSmallerPhotos(list)));
      localStorage.setItem(SAVED_AT_KEY, savedAt);
      saved = true;
      announceError('Storage is nearly full, so older scan photos were shrunk to keep every patient. Download a backup.');
    } catch {
      announceError('Your changes could not be saved on this device because storage is full or blocked. They are kept as a backup copy. Download a backup now.');
    }
  }

  window.dispatchEvent(new Event(PATIENTS_UPDATED));
  return saved;
}

/** Add a patient, or replace the one with the same id. */
export function upsertPatient(patient: StoredPatient): boolean {
  const list = loadPatients();
  const index = list.findIndex((p) => p.id === patient.id);
  if (index === -1) list.push(patient);
  else list[index] = patient;
  return savePatients(list);
}

// ── Recovery, persistence and backup ───────────────────────────────

/**
 * Recover from the IndexedDB copy. If it is newer than what localStorage holds (a save that did not
 * reach localStorage), it wins. Otherwise only patients missing from localStorage are brought back.
 * Returns how many patients were restored or updated.
 */
export async function restoreMissingPatients(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  const mirror = await readMirror();
  const current = loadPatients();
  if (mirror.patients.length === 0) {
    // First run after the second store was added: copy what is already saved so it is protected now.
    if (current.length > 0) savePatients(current);
    return 0;
  }

  let localStamp = '';
  try {
    localStamp = localStorage.getItem(SAVED_AT_KEY) ?? '';
  } catch {
    // treat as unknown, so the copy below is used
  }

  if (!localStamp || mirror.savedAt > localStamp) {
    const mirrorIds = new Set(mirror.patients.map((p) => p.id));
    const localOnly = current.filter((p) => !mirrorIds.has(p.id));
    const changed = mirror.patients.filter((p) => JSON.stringify(current.find((c) => c.id === p.id)) !== JSON.stringify(p)).length;
    if (changed === 0 && localOnly.length === 0) return 0;
    savePatients([...mirror.patients, ...localOnly]);
    return changed;
  }

  const known = new Set(current.map((p) => p.id));
  const missing = mirror.patients.filter((p) => !known.has(p.id));
  if (missing.length === 0) return 0;
  savePatients([...current, ...missing]);
  return missing.length;
}

/** Ask the browser not to clear this storage automatically. Returns whether it agreed. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Download every patient as a JSON file. */
export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify({ app: 'burn-snap', savedAt: new Date().toISOString(), patients: loadPatients() }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `burn-snap-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Add the patients from a backup file. Existing patients are kept as they are. Returns how many were added. */
export async function restoreFromBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text());
  const incoming: StoredPatient[] = Array.isArray(data) ? data : Array.isArray(data?.patients) ? data.patients : [];
  const valid = incoming.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string');
  const current = loadPatients();
  const known = new Set(current.map((p) => p.id));
  const added = valid.filter((p) => !known.has(p.id));
  if (added.length) savePatients([...current, ...added]);
  return added.length;
}
