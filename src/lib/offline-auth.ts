
/**
 * Offline Authentication & Guest Mode for Bulk AI
 * Uses IndexedDB for permanent local accounts and localStorage for sessions.
 */

const DB_NAME = 'BulkAI_OfflineAuth';
const DB_VERSION = 1;
const STORE_NAME = 'users';

export interface OfflineUser {
  username: string;
  passwordHash: string;
  isGuest: boolean;
  createdAt: string;
}

export interface Session {
  username: string;
  isGuest: boolean;
  uid: string; // Mock UID for compatibility with Firebase-based logic
  displayName: string;
  email?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'username' });
      }
    };
  });
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function signupOffline(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await openDB();
    const passwordHash = await hashPassword(password);
    
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const getRequest = store.get(username);
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          resolve({ success: false, error: 'Username already exists' });
        } else {
          const user: OfflineUser = {
            username,
            passwordHash,
            isGuest: false,
            createdAt: new Date().toISOString()
          };
          const addRequest = store.add(user);
          addRequest.onsuccess = () => resolve({ success: true });
          addRequest.onerror = () => resolve({ success: false, error: 'Storage error' });
        }
      };
    });
  } catch (err) {
    return { success: false, error: 'Database connection failed' };
  }
}

export async function loginOffline(username: string, password: string): Promise<{ success: boolean; user?: Session; error?: string }> {
  try {
    const db = await openDB();
    const passwordHash = await hashPassword(password);
    
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const getRequest = store.get(username);
      getRequest.onsuccess = () => {
        const user = getRequest.result as OfflineUser;
        if (user && user.passwordHash === passwordHash) {
          const session: Session = {
            username: user.username,
            isGuest: false,
            uid: `offline_${user.username}`,
            displayName: user.username
          };
          resolve({ success: true, user: session });
        } else {
          resolve({ success: false, error: 'Invalid credentials' });
        }
      };
    });
  } catch (err) {
    return { success: false, error: 'Database connection failed' };
  }
}

export function startGuestSession(): Session {
  const guestId = `guest_${Math.random().toString(36).substr(2, 9)}`;
  return {
    username: 'Guest',
    isGuest: true,
    uid: guestId,
    displayName: 'Guest User'
  };
}

export function saveSession(session: Session) {
  localStorage.setItem('bulk_ai_session', JSON.stringify(session));
}

export function getSession(): Session | null {
  const data = localStorage.getItem('bulk_ai_session');
  return data ? JSON.parse(data) : null;
}

export function clearSession() {
  localStorage.removeItem('bulk_ai_session');
}
