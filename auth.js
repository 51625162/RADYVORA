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
  // Şu an tek kullanıcı modundasın — giriş ekranı tamamen devre dışı.
  // Firebase yapılandırmasının doğru olup olmaması bu davranışı etkilemez.
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
