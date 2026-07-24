/* ============================================================
   RADYVORA — Firebase Yapılandırması
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDwP4X1IC3wKayQpHu2U57c-piPszznjOM",
  authDomain: "radyvora-28d2a.firebaseapp.com",
  projectId: "radyvora-28d2a",
  storageBucket: "radyvora-28d2a.firebasestorage.app",
  messagingSenderId: "977410131623",
  appId: "1:977410131623:web:df227a8356d82c5cf3fd82"
};

function rvLooksLikeRealApiKey(key) {
  return typeof key === 'string' && /^AIza[A-Za-z0-9_-]{20,}$/.test(key.trim());
}
const RV_DEMO_MODE = !rvLooksLikeRealApiKey(firebaseConfig.apiKey);

let rvAuth = null;
let rvDb = null;

if (!RV_DEMO_MODE) {
  try {
    firebase.initializeApp(firebaseConfig);
    rvAuth = firebase.auth();
    rvDb = firebase.firestore();
  } catch (e) {
    console.error('RADYVORA: Firebase başlatılamadı.', e);
  }
}

function rvCreateLocalCollection(storageKey) {
  function readAll() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch (e) { return {}; }
  }
  function writeAll(obj) { localStorage.setItem(storageKey, JSON.stringify(obj)); }
  let listeners = [];
  function notify() {
    const all = readAll();
    const docs = Object.keys(all).map((id) => ({ id, data: () => all[id] }));
    listeners.forEach((cb) => cb({ docs }));
  }
  return {
    onSnapshot(cb) {
      listeners.push(cb);
      notify();
      return () => { listeners = listeners.filter((l) => l !== cb); };
    },
    doc(id) {
      return {
        set(fields) {
          const all = readAll();
          all[id] = fields;
          writeAll(all);
          notify();
          return Promise.resolve();
        },
        delete() {
          const all = readAll();
          delete all[id];
          writeAll(all);
          notify();
          return Promise.resolve();
        }
      };
    }
  };
}

function rvCreateLocalDoc(storageKey) {
  function read() {
    try { return JSON.parse(localStorage.getItem(storageKey)); }
    catch (e) { return null; }
  }
  function write(obj) { localStorage.setItem(storageKey, JSON.stringify(obj)); }
  let listeners = [];
  function notify() {
    const data = read();
    listeners.forEach((cb) => cb({ exists: !!data, data: () => data }));
  }
  return {
    onSnapshot(cb) {
      listeners.push(cb);
      notify();
      return () => { listeners = listeners.filter((l) => l !== cb); };
    },
    set(fields, opts) {
      const cur = read() || {};
      const merged = (opts && opts.merge) ? Object.assign({}, cur, fields) : fields;
      write(merged);
      notify();
      return Promise.resolve();
    }
  };
}
