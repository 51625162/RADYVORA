# RADYVORA — Firebase Kurulumu (tek seferlik, ~10 dakika)

Bu adımların hepsi ücretsizdir (Firebase Spark plan). Kredi kartı istemez.

## 1) Proje oluştur
1. https://console.firebase.google.com adresine git, Google hesabınla gir.
2. "Proje ekle" → isim ver (örn. `radyvora`) → Analytics'i kapatabilirsin (gerekmiyor) → Oluştur.

## 2) Authentication'ı aç
1. Sol menüden **Build → Authentication** → "Get started".
2. **Sign-in method** sekmesinde **Email/Password**'ü seç → Etkinleştir → Kaydet.
3. **Users** sekmesine geç → "Add user" ile **5 kullanıcının** e-posta + şifresini SEN oluştur.
   (Herkese kayıt formu açmıyoruz — bilerek. Sadece bu 5 kişi giriş yapabilecek.)

## 3) Firestore veritabanını aç
1. Sol menüden **Build → Firestore Database** → "Create database".
2. Konum olarak `eur3 (europe-west)` seç (Türkiye'ye en yakın, gecikme az) → **Production mode** ile başlat.
3. Oluşunca üstteki **Rules** sekmesine geç, içeriği tamamen sil ve bu projede sana verdiğim
   `firestore.rules` dosyasının içeriğini yapıştır → **Yayınla**.

## 4) Web uygulaması ekle ve config bilgisini al
1. Proje ana sayfasında **</>** (Web) simgesine tıkla.
2. Takma isim ver (örn. `radyvora-web`) → Firebase Hosting'i işaretleME (kullanmıyoruz, GitHub Pages kullanıyoruz) → Kaydet.
3. Karşına çıkan `firebaseConfig = { apiKey: "...", authDomain: "...", ... }` bloğunu **kopyala**.
4. Bu bilgiyi `firebase-config.js` içindeki placeholder'ların yerine yapıştır.

## Bunlar "gizli anahtar" değil
`apiKey` ve diğer config değerleri normalde gizli tutulması gereken sırlar DEĞİLDİR — Firebase
web uygulamaları için tasarım gereği herkese açıktır. Gerçek güvenlik **Firestore Rules**
(kim hangi veriyi okuyabilir/yazabilir) ile sağlanır, bu yüzden 3. adımdaki kuralları atlama.

## Ücretsiz katman sınırları (5 kullanıcı için pratikte hiç aşılmaz)
- Authentication: sınırsız kullanıcı, ücretsiz.
- Firestore: günde 50.000 okuma, 20.000 yazma, 1 GB depolama — ücretsiz.
  5 kişi ayda birkaç kez şirket/portföy güncellediğinde bunun binde birini bile kullanmazsınız.
