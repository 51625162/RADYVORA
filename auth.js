/* ============================================================
   RADYVORA — Kimlik Doğrulama
   Giriş ekranını yönetir, oturum durumuna göre uygulamayı
   gösterir/gizler. Kullanıcı hesapları Firebase Console'dan
   (Authentication > Users) elle oluşturulur — açık kayıt yoktur.
   ============================================================ */

let rvCurrentUser = null;

function rvShowLogin() {
  document.getElementById('loginScreen').hidden = false;
  document.getElementById('appShell').hidden = true;
}

function rvShowApp(user) {
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('appShell').hidden = false;
  document.getElementById('userBadge').textContent = user.email;
}

function rvInitAuth() {
  const logoutBtn = document.getElementById('logoutBtn');

  if (typeof RV_DEMO_MODE !== 'undefined' && RV_DEMO_MODE) {
    rvCurrentUser = { uid: 'demo-local', email: 'Test Modu — veriler bu tarayıcıda yerel' };
    rvShowApp(rvCurrentUser);
    const eyebrow = document.querySelector('.masthead .eyebrow');
    if (eyebrow) eyebrow.textContent += ' · Test Modu (yerel, senkronize değil)';
    logoutBtn.textContent = 'Test Verilerini Temizle';
    logoutBtn.addEventListener('click', () => {
      if (confirm('Bu tarayıcıdaki tüm test verilerini silmek istediğine emin misin? Bu işlem geri alınamaz.')) {
        localStorage.removeItem('radyvora_demo_companies');
        localStorage.removeItem('radyvora_demo_settings');
        location.reload();
      }
    });
    if (window.rvOnAuthReady) window.rvOnAuthReady(rvCurrentUser);
    return;
  }

  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Giriş yapılıyor…';

    rvAuth.signInWithEmailAndPassword(email, password)
      .catch((err) => {
        errorEl.textContent = rvAuthErrorMessage(err.code);
        errorEl.hidden = false;
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Giriş Yap';
      });
  });

  logoutBtn.addEventListener('click', () => {
    rvAuth.signOut();
  });

  rvAuth.onAuthStateChanged((user) => {
    rvCurrentUser = user;
    if (user) {
      rvShowApp(user);
      if (window.rvOnAuthReady) window.rvOnAuthReady(user);
    } else {
      rvShowLogin();
      if (window.rvOnAuthClear) window.rvOnAuthClear();
    }
  });
}

function rvAuthErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email': return 'E-posta adresi geçersiz görünüyor.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'E-posta veya şifre hatalı.';
    case 'auth/too-many-requests': return 'Çok fazla deneme yapıldı, biraz sonra tekrar dene.';
    default: return 'Giriş yapılamadı. Bağlantını kontrol edip tekrar dene.';
  }
}

document.addEventListener('DOMContentLoaded', rvInitAuth);
