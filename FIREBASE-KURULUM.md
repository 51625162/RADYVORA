# RADYVORA — Firebase Kurulumu (tek seferlik, ~10 dakika)

Bu adımların hepsi ücretsizdir (Firebase Spark plan). Kredi kartı istemez.
Bunu tamamlayınca RADYVORA artık "Tek Kullanıcı Modu" yerine gerçek bir
e-posta + şifre ile giriş yapacak ve verilerin (şirket defterin, portföyün)
**tüm cihazlarında** aynı görünecek.

## 1) Proje oluştur

1. https://console.firebase.google.com adresine git, Google hesabınla gir.
2. "Proje ekle" → isim ver (örn. `radyvora`) → Analytics'i kapatabilirsin (gerekmiyor) → Oluştur.

## 2) Authentication'ı aç

1. Sol menüden **Build → Authentication** → "Get started".
2. **Sign-in method** sekmesinde **Email/Password**'ü seç → Etkinleştir → Kaydet.
3. **Users** sekmesine geç → **"Add user"** ile kendi e-posta adresini ve
   belirleyeceğin şifreyi gir → Kaydet.
   - Buradaki e-posta/şifre, RADYVORA'ya giriş yaparken kullanacağın bilgiler.
   - Başka cihazlardan (telefon, başka bilgisayar) da aynı e-posta/şifre ile
     giriş yapınca aynı verileri göreceksin.
   - İleride başka birine erişim vermek istersen, buraya ikinci bir kullanıcı
     daha ekleyebilirsin (herkese açık kayıt formu yok — bilerek, sadece
     buradan senin eklediğin kişiler girebilir).

## 3) Firestore veritabanını aç

1. Sol menüden **Build → Firestore Database** → "Create database".
2. Konum olarak `eur3 (europe-west)` seç (Türkiye'ye en yakın, gecikme az) → **Production mode** ile başlat.
3. Oluşunca üstteki **Rules** sekmesine geç, içeriği tamamen sil ve bu projede
   sana verdiğim `firestore.rules` dosyasının içeriğini yapıştır → **Yayınla**.

## 4) Web uygulaması ekle ve config bilgisini al

1. Proje ana sayfasında **</>** (Web) simgesine tıkla.
2. Takma isim ver (örn. `radyvora-web`) → Firebase Hosting'i işaretleME (kullanmıyoruz, GitHub Pages kullanıyoruz) → Kaydet.
3. Karşına çıkan `firebaseConfig = { apiKey: "...", authDomain: "...", ... }` bloğunu **kopyala**.
4. Bu bilgiyi `firebase-config.js` içindeki placeholder'ların (`BURAYA_..._YAPISTIR`) yerine yapıştır.
5. Dosyayı kaydet, repona at.

## Bunlar "gizli anahtar" değil

`apiKey` ve diğer config değerleri normalde gizli tutulması gereken sırlar
DEĞİLDİR — Firebase web uygulamaları için tasarım gereği herkese açıktır.
Gerçek güvenlik **Firestore Rules** (kim hangi veriyi okuyabilir/yazabilir)
ile sağlanır, bu yüzden 3. adımdaki kuralları atlama.

## 5) Test et

1. Siteyi aç — artık "Tek Kullanıcı Modu" yerine gerçek bir giriş ekranı
   görmelisin.
2. 2. adımda oluşturduğun e-posta/şifre ile giriş yap.
3. Bir şirket ekle, birkaç veri gir.
4. Başka bir cihazdan (veya aynı tarayıcıda gizli sekmede) aynı adrese gidip
   aynı bilgilerle giriş yap — az önce eklediğin şirketi orada da görmelisin.

## Ücretsiz katman sınırları (tek kullanıcı için pratikte hiç aşılmaz)

- Authentication: sınırsız kullanıcı, ücretsiz.
- Firestore: günde 50.000 okuma, 20.000 yazma, 1 GB depolama — ücretsiz.
  Tek başına kullanırken bunun binde birini bile kullanmazsın.

## Sorun mu yaşıyorsun?

- **Giriş ekranı hâlâ çıkmıyor, direkt "Tek Kullanıcı Modu" açılıyor** →
  `firebase-config.js`'deki `apiKey` hâlâ placeholder ("BURAYA_..." veya
  gerçek bir Firebase anahtarına benzemiyor) demektir, 4. adımı kontrol et.
- **"E-posta veya şifre hatalı" hatası** → 2. adımda oluşturduğun bilgilerle
  tam eşleşiyor mu kontrol et (büyük/küçük harf, boşluk).
- **Veriler başka cihazda görünmüyor** → İki cihazda da aynı e-posta ile
  giriş yaptığından emin ol; Firestore Rules'ı doğru yapıştırdığından emin ol
  (3. adım).
