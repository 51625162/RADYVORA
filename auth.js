/* ============================================================
   RADYVORA — Kimlik Doğrulama
   Giriş ekranını yönetir, oturum durumuna göre uygulamayı
   gösterir/gizler. Kullanıcı hesapları Firebase Console'dan
   (Authentication > Users) elle oluşturulur — açık kayıt yoktur.

   firebase-config.js henüz gerçek değerlerle doldurulmadıysa
   (RV_DEMO_MODE = true), sistem otomatik olarak eski "Tek
   Kullanıcı Modu"na döner — giriş ekranı atlanır, veriler bu
   cihazda yerel kalır. Firebase kurulduğunda (bkz.
   FIREBASE-KURULUM.md) gerçek e-posta/şifre girişi devreye girer
   ve veriler tüm cihazlarda senkronize olur.
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
  const demoMode = typeof RV_DEMO_MODE === 'undefined' || RV_DEMO_MODE || !rvAuth;

  if (demoMode) {
    rvCurrentUser = { uid: 'tek-kullanici', email: 'Tek Kullanıcı Modu — bu cihazda yerel' };
    rvShowApp(rvCurrentUser);

    const eyebrow = document.querySelector('.masthead .eyebrow');
    if (eyebrow) eyebrow.textContent += ' · Tek Kullanıcı Modu (bu cihazda yerel)';

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.textContent = 'Verileri Temizle';
      logoutBtn.addEventListener('click', () => {
        if (confirm('Bu cihazdaki tüm verileri silmek istediğine emin misin? Bu işlem geri alınamaz.')) {
          localStorage.removeItem('radyvora_demo_companies');
          localStorage.removeItem('radyvora_demo_settings');
          location.reload();
        }
      });
    }

    if (window.rvOnAuthReady) window.rvOnAuthReady(rvCurrentUser);
    return;
  }

  /* ---- Gerçek Firebase modu: giriş ekranı devrede ---- */
  rvShowLogin();

  rvAuth.onAuthStateChanged((user) => {
    if (user) {
      rvCurrentUser = user;
      rvShowApp(user);
      if (window.rvOnAuthReady) window.rvOnAuthReady(user);
    } else {
      rvCurrentUser = null;
      rvShowLogin();
    }
  });

  const loginForm = document.getElementById('loginForm');
  const loginErrorEl = document.getElementById('loginError');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      loginErrorEl.hidden = true;
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      rvAuth.signInWithEmailAndPassword(email, password)
        .catch((err) => {
          loginErrorEl.textContent = rvAuthErrorMessage(err.code);
          loginErrorEl.hidden = false;
        })
        .finally(() => { if (submitBtn) submitBtn.disabled = false; });
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.textContent = 'Çıkış';
    logoutBtn.addEventListener('click', () => { rvAuth.signOut(); });
  }

  /* Şifremi Unuttum — Firebase'in kendi şifre sıfırlama e-postası */
  const forgotBtn = document.getElementById('loginForgotBtn');
  const resetMsgEl = document.getElementById('loginResetMsg');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', () => {
      const emailEl = document.getElementById('loginEmail');
      const email = emailEl.value.trim();
      loginErrorEl.hidden = true;
      resetMsgEl.hidden = true;

      if (!email) {
        loginErrorEl.textContent = 'Önce e-posta kutusuna adresini yaz, sonra "Şifremi unuttum"a bas.';
        loginErrorEl.hidden = false;
        emailEl.focus();
        return;
      }

      forgotBtn.disabled = true;
      rvAuth.sendPasswordResetEmail(email)
        .then(() => {
          resetMsgEl.textContent = 'Şifre sıfırlama linki ' + email + ' adresine gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.';
          resetMsgEl.hidden = false;
        })
        .catch((err) => {
          loginErrorEl.textContent = rvAuthErrorMessage(err.code);
          loginErrorEl.hidden = false;
        })
        .finally(() => { forgotBtn.disabled = false; });
    });
  }
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
