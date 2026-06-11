/**
 * VitalVision — Session History Database (IndexedDB via Dexie.js + FastAPI Backend Integration)
 * Stores all past sessions locally and synchronizes them with the Neon PostgreSQL DB via FastAPI.
 */

const DB_NAME   = 'VitalVisionDB';
const DB_VERSION = 1;
const STORE     = 'sessions';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api/v1/sessions`
  : '/api/v1/sessions';
const BEARER_TOKEN = 'vitalvision-demo-token-swagger';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = e => reject(e.target.error);
  });
}

// Helper to save locally
async function saveLocal(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const item = { ...data };
    if (!item.date) {
      item.date = new Date().toISOString();
    }
    const req = tx.objectStore(STORE).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject(e.target.error);
  });
}

export async function saveSession(data) {
  console.log("Saving session...", data);
  let backendRecord = null;
  
  // 1. Try to save to backend (FastAPI + Neon PostgreSQL)
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEARER_TOKEN}`
      },
      body: JSON.stringify({
        hr: Number(data.hr),
        confidence: Number(data.confidence),
        spo2: Number(data.spo2),
        spo2Confidence: data.spo2Confidence !== undefined ? Number(data.spo2Confidence) : null,
        temp: data.temp || null,
        stress: data.stress || null,
        dominant: data.dominant || null,
        emotionDistrib: data.emotionDistrib || {},
        timeline: data.timeline || [],
        alerts: data.alerts || [],
        meta: data.meta || null,
        source: data.source || 'live',
        session_date: data.date || new Date().toISOString(),
        notes: data.notes || null,
        raw_results: data
      })
    });
    
    if (response.ok) {
      backendRecord = await response.json();
      console.log("Session saved to FastAPI backend successfully:", backendRecord);
    } else {
      console.warn("Failed to save to backend:", await response.text());
    }
  } catch (err) {
    console.error("Network error saving session to backend:", err);
  }

  // 2. Save to local IndexedDB (use backend ID if available to keep them in sync, otherwise auto-increment)
  const localData = { ...data };
  if (backendRecord && backendRecord.id) {
    localData.id = backendRecord.id;
    localData.date = backendRecord.date;
  } else if (!localData.date) {
    localData.date = new Date().toISOString();
  }
  
  return await saveLocal(localData);
}

export async function getAllSessions() {
  console.log("Retrieving all sessions...");
  
  // 1. Try to fetch from backend (FastAPI + Neon PostgreSQL)
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("Retrieved sessions from backend successfully:", data);
      
      // Update/Sync local IndexedDB cache with backend records
      if (data && Array.isArray(data.items)) {
        const db = await openDB();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        
        store.clear();
        for (const item of data.items) {
          store.put(item);
        }
        
        return data.items; // Backend returns sorted
      }
    } else {
      console.warn("Failed to retrieve sessions from backend:", await response.text());
    }
  } catch (err) {
    console.error("Network error retrieving sessions from backend, falling back to local DB:", err);
  }

  // 2. Fallback to local IndexedDB
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.reverse()); // newest first
    req.onerror   = e => reject(e.target.error);
  });
}

export async function deleteSession(id) {
  console.log(`Deleting session: ${id}`);
  
  // 1. Try to delete from backend (FastAPI + Neon PostgreSQL)
  try {
    const response = await fetch(`${BACKEND_URL}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`
      }
    });
    
    if (response.ok) {
      console.log(`Session ${id} deleted from backend successfully`);
    } else {
      console.warn(`Failed to delete session ${id} from backend:`, await response.text());
    }
  } catch (err) {
    console.error(`Network error deleting session ${id} from backend:`, err);
  }

  // 2. Delete from local IndexedDB
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

export async function clearAllSessions() {
  console.log("Clearing all sessions...");
  
  // 1. Try to clear all from backend (FastAPI + Neon PostgreSQL)
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`
      }
    });
    
    if (response.ok) {
      console.log("All sessions deleted from backend successfully");
    } else {
      console.warn("Failed to delete all sessions from backend:", await response.text());
    }
  } catch (err) {
    console.error("Network error deleting all sessions from backend:", err);
  }

  // 2. Clear local IndexedDB
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}
