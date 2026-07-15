/* ============================================================
   RADYVORA — Firebase Yapılandırması
   FIREBASE-KURULUM.md dosyasındaki adım 4'te aldığın config
   bilgisini aşağıdaki nesnenin İÇİNE yapıştır. Örnek:

   const firebaseConfig = {
     apiKey: "AIzaSyABCDEF...",
     authDomain: "radyvora-xxxxx.firebaseapp.com",
     projectId: "radyvora-xxxxx",
     storageBucket: "radyvora-xxxxx.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };

   Bu değerler gizli değildir, olduğu gibi bırakabilirsin.
   ============================================================ */

const firebaseConfig = {
  apiKey: "BURAYA_apiKey_YAPISTIR",
  authDomain: "BURAYA_authDomain_YAPISTIR",
  projectId: "BURAYA_projectId_YAPISTIR",
  storageBucket: "BURAYA_storageBucket_YAPISTIR",
  messagingSenderId: "BURAYA_messagingSenderId_YAPISTIR",
  appId: "BURAYA_appId_YAPISTIR"
};

/* ------------------------------------------------------------
   TEST MODU
   Gerçek bir Firebase apiKey'i her zaman "AIza" ile başlar ve
   uzun bir karakter dizisidir. Yukarıdaki alan hâlâ placeholder
   ise (ya da herhangi bir sebeple bozulmuş/eksikse) bu desene
   uymaz — bu yüzden "BURAYA_..." metnini birebir aramak yerine
   gerçek bir anahtara BENZEYİP BENZEMEDİĞİNİ kontrol ediyoruz.
   Bu, placeholder metninde ufak bir yazım/otomatik düzeltme farkı
   olsa bile Test Modu'nun doğru çalışmasını garanti eder.
------------------------------------------------------------ */
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
    console.error('RADYVORA: Firebase başlatılamadı — firebase-config.js içindeki değerleri kontrol et.', e);
  }
}

/* Firestore'un onSnapshot/doc/set/delete arayüzünü taklit eden,
   localStorage'a yazan hafif bir mock katman — script.js'in
   geri kalanı bunun gerçek Firestore mu yoksa yerel mi olduğunu
   bilmek zorunda kalmaz. */
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
