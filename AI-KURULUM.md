# RADYVORA — AI ile Otomatik Mali Tablo Doldurma Kurulumu

Bu kurulum, KAP'tan indirdiğin bilanço PDF/Excel'ini yükleyince Özet Bilanço,
Gelir Tablosu ve Nakit Akış Tablosu alanlarının otomatik dolmasını sağlar.
Tahmini maliyet: **ayda 1-2$** (kullanım sıklığına göre değişir).

Toplam süre: ~10 dakika. Hiçbiri karmaşık değil.

---

## 1) Cloudflare Worker oluştur

1. https://dash.cloudflare.com/sign-up adresinden ücretsiz hesap aç (kredi kartı istemez).
2. Sol menüden **Workers & Pages → Create → Create Worker**.
3. Bir isim ver (örn. `radyvora-ai`) → **Deploy** (şimdilik varsayılan "Hello World" koduyla deploy edebilirsin, birazdan değiştireceğiz).
4. Deploy edilince sana bir adres verilecek, örn: `https://radyvora-ai.SENIN-ADIN.workers.dev` — **bu adresi not al**, 4. adımda lazım olacak.

## 2) Worker koduna `radyvora-worker.js` içeriğini yapıştır

1. Worker sayfasında **Edit Code** (veya "Quick Edit") butonuna tıkla.
2. İçindeki varsayılan kodun tamamını sil.
3. Bu projede sana verdiğim `radyvora-worker.js` dosyasının **tüm içeriğini** yapıştır.
4. **Save and Deploy**.

## 3) Anthropic API anahtarı al ve Worker'a ekle

1. https://console.anthropic.com adresinden hesap aç.
2. **Settings → Billing** kısmından küçük bir bakiye yükle (5-10$ yeterli, aylık tahmini kullanım 1-2$).
3. **Settings → API Keys → Create Key** ile bir anahtar oluştur, kopyala (bir daha gösterilmez, kaybedersen yenisini oluşturursun).
4. Cloudflare'da Worker sayfana dön → **Settings → Variables and Secrets → Add**.
   - Type: **Secret**
   - Variable name: `ANTHROPIC_API_KEY`
   - Value: az önce kopyaladığın anahtar
   - **Save and Deploy**.

Bu anahtar sadece Worker içinde, sunucu tarafında kalır — tarayıcıya veya
GitHub'a hiçbir zaman gönderilmez.

## 4) Worker adresini siteye tanıt

1. Bu projede sana verdiğim `ai-config.js` dosyasını aç.
2. `BURAYA_WORKER_URL_YAPISTIR` yazan yeri, 1. adımda not aldığın Worker adresiyle değiştir. Örnek:
   ```js
   const RV_WORKER_URL = "https://radyvora-ai.senin-adin.workers.dev";
   ```
3. Dosyayı kaydet, repona at.

## 5) Test et

1. Siteyi aç, bir şirket seç veya yeni şirket ekle.
2. "Veri Girişi" formunun en üstünde **"🤖 AI ile Otomatik Doldur"** kutusunu göreceksin.
3. KAP'tan indirdiğin bir bilanço PDF'i veya Excel'i yükle, **"Yükle ve Doldur"** butonuna bas.
4. Birkaç saniye içinde Özet Bilanço/Gelir Tablosu/Nakit Akış alanları dolmalı.
5. **Doldurulan değerleri mutlaka gözden geçir** — yapay zeka hata yapabilir, sen her zaman son kontrolü sen yapıyorsun (sistem hiçbir şeyi senin onayın olmadan kaydetmiyor, "Kaydet ve Analiz Et" butonuna basana kadar hiçbir yere yazılmıyor).

---

## Sorun mu yaşıyorsun?

- **"Önce Cloudflare Worker adresini ekle" uyarısı çıkıyor** → 4. adımı atlamışsındır, `ai-config.js`'i kontrol et.
- **"AI isteği başarısız oldu" hatası** → Anthropic hesabında bakiye bitmiş olabilir, console.anthropic.com'dan kontrol et.
- **Dolan değerler yanlış/eksik** → PDF'in tarama (resim) olmaması, seçilebilir metin içermesi gerekir. Taranmış/resim PDF'lerde başarı oranı düşer.
- **CORS hatası** → `radyvora-worker.js`'i doğru yapıştırıp deploy ettiğinden emin ol.
