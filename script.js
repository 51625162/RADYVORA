/* ============================================================
   RADYVORA — Dr. Uzman AI
   Kural-tabanlı analiz motoru + Firestore ile çoklu kullanıcı
   senkronizasyonu. Hiçbir üçüncü taraf yapay zeka çağrısı yapmaz.
   ============================================================ */

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fmt1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const fmtPct = (v) => (Number.isFinite(v) ? (v > 0 ? '+' : '') + v.toFixed(1) + '%' : '—');
const fmtMoney = (v) => (Number.isFinite(v) ? v.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' ₺' : '—');
const fmtMulti = (v) => (Number.isFinite(v) ? v.toFixed(1) + 'x' : '—');

let state = {
  companies: [],
  activeId: null,
  kapDraft: [],       // KAP etki kayıtları taslağı (form düzenlenirken)
  kapRaporDraft: [],  // KAP faaliyet raporu linkleri taslağı
  benchmark: {}       // { bist100Baslangic, bist100Guncel }
};

/* ================================================================
   STORAGE (Firestore, kullanıcı bazlı)
   users/{uid}/companies/{companyId}         → şirket kayıtları
   users/{uid}/settings/portfolio            → endeks karşılaştırma ayarları
================================================================ */
let rvCompaniesUnsub = null;
let rvSettingsUnsub = null;

function rvCompaniesRef() {
  // Şu an tek kullanıcı modundasın — veriler her zaman bu cihazda saklanır.
  return rvCreateLocalCollection('radyvora_demo_companies');
}
function rvSettingsRef() {
  return rvCreateLocalDoc('radyvora_demo_settings');
}

function rvStartListening() {
  const ref = rvCompaniesRef();
  const settingsRef = rvSettingsRef();
  if (!ref || !settingsRef) return;

  if (rvCompaniesUnsub) rvCompaniesUnsub();
  rvCompaniesUnsub = ref.onSnapshot(
    (snapshot) => {
      state.companies = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCompanyList();
      const active = state.companies.find((c) => c.id === state.activeId) || null;
      renderDashboard(active);
      if (!active) { state.activeId = null; els.companyForm.hidden = true; }
      renderPortfolioSummary();
    },
    (err) => {
      console.error('RADYVORA: Firestore okuma hatası', err);
      alert('Veriler yüklenemedi: ' + err.message);
    }
  );

  if (rvSettingsUnsub) rvSettingsUnsub();
  rvSettingsUnsub = settingsRef.onSnapshot(
    (doc) => {
      state.benchmark = doc.exists ? doc.data() : {};
      if (els.bm_bist_baslangic) {
        els.bm_bist_baslangic.value = state.benchmark.bist100Baslangic ?? '';
        els.bm_bist_guncel.value = state.benchmark.bist100Guncel ?? '';
      }
      if (els.m_tufe) {
        els.m_tufe.value = state.benchmark.m_tufe ?? '';
        els.m_faiz.value = state.benchmark.m_faiz ?? '';
        els.m_cds.value = state.benchmark.m_cds ?? '';
        els.m_pmi.value = state.benchmark.m_pmi ?? '';
        if (els.macroUpdated) {
          els.macroUpdated.textContent = state.benchmark.macroUpdatedAt
            ? `Manuel veriler son güncelleme: ${state.benchmark.macroUpdatedAt}`
            : '';
        }
      }
      renderPortfolioSummary();
    },
    (err) => console.error('RADYVORA: Ayarlar okunamadı', err)
  );
}

function rvStopListening() {
  if (rvCompaniesUnsub) { rvCompaniesUnsub(); rvCompaniesUnsub = null; }
  if (rvSettingsUnsub) { rvSettingsUnsub(); rvSettingsUnsub = null; }
  state.companies = [];
  state.activeId = null;
  state.benchmark = {};
  if (els.companyForm) els.companyForm.hidden = true;
  if (els.companyList) renderCompanyList();
  if (els.dashboard) renderDashboard(null);
  if (els.pfEmptyNote) renderPortfolioSummary();
}

window.rvOnAuthReady = function () {
  if (!els.companyList) cacheEls();
  rvStartListening();
};
window.rvOnAuthClear = function () {
  if (!els.companyList) cacheEls();
  rvStopListening();
};

/* ================================================================
   EKONOMİK RADAR — Döviz kurları (GERÇEKTEN otomatik, ücretsiz)
   Kaynak: frankfurter.app — anahtar gerektirmez, tarayıcıdan
   doğrudan çağrılabilir (CORS destekli). TÜFE/faiz/CDS/PMI için
   TCMB EVDS'nin tarayıcıdan güvenli/CORS'lu çağrılabildiğine dair
   bir garanti yok, bu yüzden onlar bilinçli olarak manuel bırakıldı.
================================================================ */
async function rvFetchDovizKurlari() {
  if (els.macroError) els.macroError.hidden = true;
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch('https://api.frankfurter.app/latest?from=USD&to=TRY'),
      fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY')
    ]);
    if (!usdRes.ok || !eurRes.ok) throw new Error('Kur servisi yanıt vermedi');
    const usdData = await usdRes.json();
    const eurData = await eurRes.json();
    const usdTry = usdData.rates && usdData.rates.TRY;
    const eurTry = eurData.rates && eurData.rates.TRY;
    if (els.macroUsd) els.macroUsd.textContent = Number.isFinite(usdTry) ? usdTry.toFixed(4) + ' ₺' : '—';
    if (els.macroEur) els.macroEur.textContent = Number.isFinite(eurTry) ? eurTry.toFixed(4) + ' ₺' : '—';
  } catch (e) {
    console.error('RADYVORA: Döviz kuru çekilemedi', e);
    if (els.macroUsd) els.macroUsd.textContent = '—';
    if (els.macroEur) els.macroEur.textContent = '—';
    if (els.macroError) {
      els.macroError.hidden = false;
      els.macroError.textContent = 'Döviz kurları çekilemedi — internet bağlantını kontrol et ve "Kurları Güncelle"ye tekrar bas.';
    }
  }
}

function handleSaveMacro() {
  const ref = rvSettingsRef();
  if (!ref) return;
  const num = (id) => { const v = document.getElementById(id).value; return v === '' ? null : parseFloat(v); };
  const today = new Date().toLocaleDateString('tr-TR');
  const data = {
    m_tufe: num('m_tufe'), m_faiz: num('m_faiz'), m_cds: num('m_cds'), m_pmi: num('m_pmi'),
    macroUpdatedAt: today
  };
  ref.set(data, { merge: true }).catch((err) => alert('Kaydedilemedi: ' + err.message));
}

/* ================================================================
   TÜRETİLMİŞ DEĞERLER (fiyat/hisse verisinden hesaplananlar)
================================================================ */
function positionValue(c) {
  return (Number.isFinite(c.guncelFiyat) && Number.isFinite(c.adet)) ? c.guncelFiyat * c.adet : null;
}
function costValue(c) {
  return (Number.isFinite(c.maliyetFiyati) && Number.isFinite(c.adet)) ? c.maliyetFiyati * c.adet : null;
}
// Not: toplamHisse "mn adet" biriminde, finansal kalemler "mn ₺" biriminde
// girildiği için piyasa değeri de doğrudan mn ₺ cinsinden çıkar.
function marketCap(c) {
  return (Number.isFinite(c.guncelFiyat) && Number.isFinite(c.toplamHisse) && c.toplamHisse > 0)
    ? c.guncelFiyat * c.toplamHisse : null;
}
function annualNetKar(c) { return Number.isFinite(c.netkarBu) ? c.netkarBu * 4 : null; }
function annualFavok(c) { return Number.isFinite(c.favokBu) ? c.favokBu * 4 : null; }

function computedFk(c) {
  const mc = marketCap(c), ak = annualNetKar(c);
  return (mc !== null && ak) ? mc / ak : null;
}
function computedPddd(c) {
  const mc = marketCap(c);
  return (mc !== null && c.ozkaynakBu) ? mc / c.ozkaynakBu : null;
}
function computedFdFavok(c) {
  const mc = marketCap(c), af = annualFavok(c);
  if (mc === null || !af) return null;
  const ev = mc + (Number.isFinite(c.netborcBu) ? c.netborcBu : 0);
  return ev / af;
}

function autoPortfolioWeight(c) {
  const val = positionValue(c);
  if (val === null) return null;
  const total = state.companies.reduce((s, x) => s + (positionValue(x) || 0), 0);
  if (!total) return null;
  return (val / total) * 100;
}

/**
 * Sektör ortalama çarpanlarına göre olası hisse başı değer aralığı.
 * Bu bir "hedef fiyat" değildir — yalnızca üç farklı çarpan yönteminin
 * (F/K, PD/DD, FD/FAVÖK) girilen sektör ortalamalarına göre ima ettiği
 * fiyatları gösterir. Varsayım (sektör ortalaması) değişirse aralık da değişir.
 */
function fairValueRange(c) {
  const shares = c.toplamHisse;
  if (!Number.isFinite(shares) || shares <= 0) return null;

  const eps = Number.isFinite(c.netkarBu) ? (c.netkarBu * 4) / shares : null;
  const bvps = Number.isFinite(c.ozkaynakBu) ? c.ozkaynakBu / shares : null;
  const favokPerShare = Number.isFinite(c.favokBu) ? (c.favokBu * 4) / shares : null;
  const netBorcPerShare = Number.isFinite(c.netborcBu) ? c.netborcBu / shares : 0;

  const candidates = [];
  if (eps !== null && eps > 0 && Number.isFinite(c.fkSektor)) candidates.push(c.fkSektor * eps);
  if (bvps !== null && bvps > 0 && Number.isFinite(c.pdddSektor)) candidates.push(c.pdddSektor * bvps);
  if (favokPerShare !== null && Number.isFinite(c.fdfavokSektor)) {
    const v = c.fdfavokSektor * favokPerShare - netBorcPerShare;
    if (v > 0) candidates.push(v);
  }

  if (!candidates.length) return null;
  return {
    low: Math.min(...candidates),
    high: Math.max(...candidates),
    mid: candidates.reduce((a, b) => a + b, 0) / candidates.length
  };
}

/* ================================================================
   SKORLAMA MOTORU
================================================================ */
function computeScores(c) {
  const scores = {};
  const notes = { warnings: [] };

  const favokMarjiBu = c.satisBu ? (c.favokBu / c.satisBu) * 100 : null;
  const roe = c.ozkaynakBu ? (c.netkarBu / c.ozkaynakBu) * 100 : null;
  const netBorcFavok = c.favokBu ? (c.netborcBu / c.favokBu) : null;

  const marginScore = favokMarjiBu !== null ? clamp(favokMarjiBu * 3, 0, 100) : null;
  const leverageScoreForHealth = netBorcFavok !== null ? clamp(100 - netBorcFavok * 15, 0, 100) : null;
  const roeScore = roe !== null ? clamp(roe * 4, 0, 100) : null;

  const healthParts = [
    [marginScore, 0.4], [leverageScoreForHealth, 0.35], [roeScore, 0.25]
  ].filter(p => p[0] !== null);
  scores.saglik = healthParts.length
    ? healthParts.reduce((s, p) => s + p[0] * p[1], 0) / healthParts.reduce((s, p) => s + p[1], 0)
    : null;

  let profitVolatility = null;
  if (c.netkarOnceki && c.netkarOnceki !== 0) {
    profitVolatility = Math.abs((c.netkarBu - c.netkarOnceki) / Math.abs(c.netkarOnceki)) * 100;
  }
  const leverageComponent = netBorcFavok !== null ? clamp(100 - netBorcFavok * 15, 0, 100) : null;
  const volatilityComponent = profitVolatility !== null ? clamp(100 - profitVolatility * 0.6, 0, 100) : null;
  const agirlik = autoPortfolioWeight(c);
  const concentrationComponent = Number.isFinite(agirlik)
    ? clamp(100 - Math.max(0, agirlik - 15) * 4, 0, 100)
    : null;

  const riskParts = [
    [leverageComponent, 0.5], [volatilityComponent, 0.3], [concentrationComponent, 0.2]
  ].filter(p => p[0] !== null);
  scores.risk = riskParts.length
    ? riskParts.reduce((s, p) => s + p[0] * p[1], 0) / riskParts.reduce((s, p) => s + p[1], 0)
    : null;

  function multipleScore(company, sector) {
    if (!Number.isFinite(company) || !Number.isFinite(sector) || sector === 0) return null;
    const ratio = company / sector;
    return clamp(100 - (ratio - 1) * 100, 0, 100);
  }
  const cFk = computedFk(c), cPddd = computedPddd(c), cFdFavok = computedFdFavok(c);
  const fkScore = multipleScore(cFk, c.fkSektor);
  const pdddScore = multipleScore(cPddd, c.pdddSektor);
  const fdfavokScore = multipleScore(cFdFavok, c.fdfavokSektor);
  const valParts = [fkScore, pdddScore, fdfavokScore].filter(v => v !== null);
  scores.degerleme = valParts.length ? valParts.reduce((s, v) => s + v, 0) / valParts.length : null;

  scores.sektorUyum = Number.isFinite(c.sektorGorunum) ? c.sektorGorunum * 10 : null;
  scores.portfoyUyum = concentrationComponent;

  scores.yonetim = (Number.isFinite(c.sozVerilen) && c.sozVerilen > 0)
    ? clamp((c.sozGerceklesen / c.sozVerilen) * 100, 0, 100)
    : null;

  if (c.kap && c.kap.length) {
    const reactions = c.kap.filter(k => Number.isFinite(k.reaction));
    scores.kapEtki = reactions.length
      ? clamp(50 + (reactions.reduce((s, k) => s + k.reaction, 0) / reactions.length) * 2.5, 0, 100)
      : null;
  } else scores.kapEtki = null;

  const weights = { saglik: 0.25, risk: 0.2, degerleme: 0.2, sektorUyum: 0.1, portfoyUyum: 0.1, yonetim: 0.1, kapEtki: 0.05 };
  let wsum = 0, vsum = 0;
  for (const k in weights) {
    if (Number.isFinite(scores[k])) { wsum += weights[k]; vsum += scores[k] * weights[k]; }
  }
  scores.genel = wsum > 0 ? vsum / wsum : null;

  if (netBorcFavok !== null && netBorcFavok > 4) {
    notes.warnings.push(`Net borç/FAVÖK oranı ${fmt1(netBorcFavok)}x seviyesinde — borç yükü riskli bölgede.`);
  }
  if (profitVolatility !== null && profitVolatility > 50) {
    notes.warnings.push(`Net kârda çeyreksel oynaklık %${fmt1(profitVolatility)} — kazanç istikrarı zayıf.`);
  }
  if (Number.isFinite(agirlik) && agirlik > 25) {
    notes.warnings.push(`Portföyde bu hisse %${fmt1(agirlik)} ağırlığında — tekil şirket yoğunlaşma riski.`);
  }
  if (Number.isFinite(scores.yonetim) && c.sozVerilen >= 3 && scores.yonetim < 50) {
    notes.warnings.push(`Yönetimin verdiği sözlerin yalnızca %${fmt1(scores.yonetim)}'i gerçekleşmiş.`);
  }
  if (Number.isFinite(scores.degerleme) && scores.degerleme < 25) {
    notes.warnings.push(`Şirket, hesaplanan çarpanlara göre sektör ortalamasının belirgin üzerinde fiyatlanıyor.`);
  }
  if (favokMarjiBu !== null && favokMarjiBu < 0) {
    notes.warnings.push(`FAVÖK marjı negatif (%${fmt1(favokMarjiBu)}) — operasyonel kârlılık sorunlu.`);
  }

  return { scores, notes, derived: { favokMarjiBu, roe, netBorcFavok, profitVolatility, cFk, cPddd, cFdFavok, agirlik } };
}

function tierFor(genel) {
  if (!Number.isFinite(genel)) return { label: 'Veri Yetersiz', cls: 'tier-dengeli' };
  if (genel >= 75) return { label: 'Sağlam', cls: 'tier-saglam' };
  if (genel >= 55) return { label: 'Dengeli', cls: 'tier-dengeli' };
  if (genel >= 35) return { label: 'Kırılgan', cls: 'tier-kirilgan' };
  return { label: 'Riskli', cls: 'tier-riskli' };
}

function managementTrustLabel(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= 80) return 'Yüksek Güven';
  if (score >= 50) return 'Orta Güven';
  return 'Düşük Güven';
}

/* ================================================================
   OTOMATİK YATIRIM RAPORU (metin üretimi, kural tabanlı)
================================================================ */
function generateReport(c, result) {
  const { scores, derived } = result;
  const p = [];

  if (Number.isFinite(scores.saglik)) {
    const seviye = scores.saglik >= 70 ? 'güçlü' : scores.saglik >= 45 ? 'ortalama düzeyde' : 'zayıf';
    let cumle = `${c.name}, bilanço görünümü açısından ${seviye} bir tablo çiziyor (Şirket Sağlığı: ${fmt1(scores.saglik)}/100).`;
    if (Number.isFinite(derived.favokMarjiBu)) cumle += ` FAVÖK marjı %${fmt1(derived.favokMarjiBu)} olarak hesaplanıyor.`;
    if (Number.isFinite(derived.netBorcFavok)) {
      cumle += ` Net borç/FAVÖK oranı ${fmt1(derived.netBorcFavok)}x düzeyinde` +
        (derived.netBorcFavok > 3 ? ', bu oran borçluluk açısından takip gerektiriyor.' : ', kaldıraç görece kontrollü görünüyor.');
    }
    p.push(cumle);
  } else {
    p.push(`${c.name} için bilanço verileri eksik olduğundan Şirket Sağlığı ekseni hesaplanamadı.`);
  }

  if (Number.isFinite(scores.degerleme)) {
    const ucuzMu = scores.degerleme >= 55;
    let cumle = `Fiyat ve hisse sayısından hesaplanan çarpanlara göre şirket, sektör ortalamasına kıyasla ${ucuzMu ? 'daha ucuz' : 'daha pahalı'} görünüyor (Değerleme Puanı: ${fmt1(scores.degerleme)}/100).`;
    if (Number.isFinite(derived.cFk)) cumle += ` Hesaplanan F/K: ${fmt1(derived.cFk)}x.`;
    cumle += ` Bu, tek başına bir al/sat gerekçesi değil; şirketin kalite ve büyüme profiliyle birlikte değerlendirilmesi gereken bir gözlemdir.`;
    p.push(cumle);
  }

  const riskCumleler = [];
  if (Number.isFinite(scores.risk)) riskCumleler.push(`Risk Puanı ${fmt1(scores.risk)}/100 (yüksek puan, düşük risk anlamına gelir)`);
  const trustLabel = managementTrustLabel(scores.yonetim);
  if (trustLabel) riskCumleler.push(`yönetimin verdiği sözlerin gerçekleşme oranı %${fmt1(scores.yonetim)} (${trustLabel})`);
  if (riskCumleler.length) {
    p.push(`Risk ve yönetim güvenilirliği tarafında: ${riskCumleler.join('; ')}. ` +
      (Number.isFinite(scores.risk) && scores.risk < 45
        ? 'Kaldıraç ve/veya kazanç oynaklığı ortalamanın üzerinde; pozisyon büyüklüğü buna göre değerlendirilebilir.'
        : 'Risk göstergeleri şimdilik yönetilebilir seviyede görünüyor.'));
  }

  const ekCumleler = [];
  if (Number.isFinite(scores.sektorUyum)) ekCumleler.push(`sektör görünümü puanı ${fmt1(scores.sektorUyum)}/100`);
  if (Number.isFinite(scores.portfoyUyum)) ekCumleler.push(`portföy uyum puanı ${fmt1(scores.portfoyUyum)}/100`);
  if (Number.isFinite(scores.kapEtki)) ekCumleler.push(`geçmiş KAP açıklamalarına piyasa tepkisi ortalama olarak ${scores.kapEtki >= 50 ? 'olumlu' : 'olumsuz'} yönde (${fmt1(scores.kapEtki)}/100)`);
  if (ekCumleler.length) p.push(`Tamamlayıcı göstergeler: ${ekCumleler.join('; ')}.`);

  const tier = tierFor(scores.genel);
  p.push(`Genel değerlendirme: ${tier.label} (${Number.isFinite(scores.genel) ? fmt1(scores.genel) : '—'}/100). ` +
    `Bu rapor bir alım-satım tavsiyesi değildir; yalnızca girilen verilerin gerekçeli bir okumasıdır. Nihai karar size aittir.`);

  return p;
}

/* ================================================================
   RADAR CHART (canvas)
================================================================ */
const RADAR_AXES = [
  { key: 'saglik', label: 'Sağlık' },
  { key: 'risk', label: 'Risk' },
  { key: 'degerleme', label: 'Değerleme' },
  { key: 'sektorUyum', label: 'Sektör' },
  { key: 'portfoyUyum', label: 'Portföy' },
  { key: 'yonetim', label: 'Yönetim' },
  { key: 'kapEtki', label: 'KAP' }
];

function drawRadar(canvas, scores) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) / 2 - 46;
  const n = RADAR_AXES.length;
  const angleFor = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const lineColor = 'rgba(201,162,39,0.28)';
  const brass = '#c9a227';
  const text = '#9aa5ac';

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 4; ring++) {
    const r = (R * ring) / 4;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = angleFor(i % n);
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = text;
  ctx.font = '11px ui-monospace, monospace';
  RADAR_AXES.forEach((axis, i) => {
    const a = angleFor(i);
    const x2 = cx + R * Math.cos(a), y2 = cy + R * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const lx = cx + (R + 18) * Math.cos(a);
    const ly = cy + (R + 18) * Math.sin(a);
    ctx.textAlign = Math.abs(Math.cos(a)) < 0.2 ? 'center' : (Math.cos(a) > 0 ? 'left' : 'right');
    ctx.textBaseline = Math.sin(a) > 0.4 ? 'top' : (Math.sin(a) < -0.4 ? 'bottom' : 'middle');
    ctx.fillText(axis.label, lx, ly);
  });

  const pts = RADAR_AXES.map((axis, i) => {
    const val = Number.isFinite(scores[axis.key]) ? scores[axis.key] : 0;
    const r = (R * clamp(val, 0, 100)) / 100;
    const a = angleFor(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(201,162,39,0.18)';
  ctx.fill();
  ctx.strokeStyle = brass;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = brass;
  pts.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ================================================================
   UI WIRING
================================================================ */
const els = {};
function cacheEls() {
  [
    'companyList', 'emptyListNote', 'newCompanyBtn', 'companyForm', 'deleteCompanyBtn',
    'dashboardEmpty', 'dashboard', 'verdictStamp', 'verdictTier', 'verdictTicker', 'verdictName',
    'verdictScore', 'radarCanvas', 'scoreLedger', 'warningsPanel', 'warningsList', 'reportBody',
    'kapPanel', 'kapTableBody', 'kapEntries', 'addKapBtn', 'sektorGorunumOut',
    'positionPanel', 'posCost', 'posValue', 'posPnl', 'posWeight',
    'mulFk', 'mulFkSektor', 'mulPddd', 'mulPdddSektor', 'mulFdfavok', 'mulFdfavokSektor',
    'fvLow', 'fvHigh', 'fvMarker', 'fvNote',
    'kapRaporPanel', 'kapRaporList', 'kapRaporEntries', 'addKapRaporBtn',
    'editBenchmarkBtn', 'benchmarkForm', 'saveBenchmarkBtn', 'bm_bist_baslangic', 'bm_bist_guncel',
    'pfTotalCost', 'pfTotalValue', 'pfPnl', 'pfVsBenchmark', 'pfEmptyNote',
    'sectorBalance', 'sectorBars', 'sectorNarrative',
    'refreshDovizBtn', 'macroUsd', 'macroEur', 'm_tufe', 'm_faiz', 'm_cds', 'm_pmi',
    'macroUpdated', 'saveMacroBtn', 'macroError'
  ].forEach(id => { els[id] = document.getElementById(id); });
}

function readForm() {
  const val = (id) => document.getElementById(id).value;
  const num = (id) => { const v = val(id); return v === '' ? null : parseFloat(v); };
  return {
    id: state.activeId || ('c_' + Date.now()),
    name: val('f_name').trim() || 'İsimsiz Şirket',
    ticker: val('f_ticker').trim().toUpperCase() || '—',
    sector: val('f_sector').trim(),
    satisBu: num('f_satis_bu'), satisOnceki: num('f_satis_onceki'),
    favokBu: num('f_favok_bu'), favokOnceki: num('f_favok_onceki'),
    netkarBu: num('f_netkar_bu'), netkarOnceki: num('f_netkar_onceki'),
    netborcBu: num('f_netborc_bu'), netborcOnceki: num('f_netborc_onceki'),
    ozkaynakBu: num('f_ozkaynak_bu'), ozkaynakOnceki: num('f_ozkaynak_onceki'),
    fkSektor: num('f_fk_sektor'), pdddSektor: num('f_pddd_sektor'), fdfavokSektor: num('f_fdfavok_sektor'),
    sozVerilen: num('f_soz_verilen'), sozGerceklesen: num('f_soz_gerceklesen'),
    guncelFiyat: num('f_guncel_fiyat'), fiyatTarihi: val('f_fiyat_tarihi') || null,
    maliyetFiyati: num('f_maliyet_fiyati'), adet: num('f_adet'), toplamHisse: num('f_toplam_hisse'),
    sektorGorunum: num('f_sektor_gorunum'),
    kap: state.kapDraft.slice(),
    kapRapor: state.kapRaporDraft.slice()
  };
}

function fillForm(c) {
  const set = (id, v) => { document.getElementById(id).value = (v === null || v === undefined) ? '' : v; };
  set('f_name', c.name); set('f_ticker', c.ticker); set('f_sector', c.sector);
  set('f_satis_bu', c.satisBu); set('f_satis_onceki', c.satisOnceki);
  set('f_favok_bu', c.favokBu); set('f_favok_onceki', c.favokOnceki);
  set('f_netkar_bu', c.netkarBu); set('f_netkar_onceki', c.netkarOnceki);
  set('f_netborc_bu', c.netborcBu); set('f_netborc_onceki', c.netborcOnceki);
  set('f_ozkaynak_bu', c.ozkaynakBu); set('f_ozkaynak_onceki', c.ozkaynakOnceki);
  set('f_fk_sektor', c.fkSektor); set('f_pddd_sektor', c.pdddSektor); set('f_fdfavok_sektor', c.fdfavokSektor);
  set('f_soz_verilen', c.sozVerilen); set('f_soz_gerceklesen', c.sozGerceklesen);
  set('f_guncel_fiyat', c.guncelFiyat); set('f_fiyat_tarihi', c.fiyatTarihi);
  set('f_maliyet_fiyati', c.maliyetFiyati); set('f_adet', c.adet); set('f_toplam_hisse', c.toplamHisse);
  set('f_sektor_gorunum', c.sektorGorunum || 5);
  els.sektorGorunumOut.textContent = c.sektorGorunum || 5;
  state.kapDraft = (c.kap || []).map(k => ({ ...k }));
  state.kapRaporDraft = (c.kapRapor || []).map(k => ({ ...k }));
  renderKapEntries();
  renderKapRaporEntries();
}

function clearForm() {
  els.companyForm.reset();
  els.sektorGorunumOut.textContent = '5';
  state.kapDraft = [];
  state.kapRaporDraft = [];
  renderKapEntries();
  renderKapRaporEntries();
}

/* KAP etki kayıtları */
function renderKapEntries() {
  els.kapEntries.innerHTML = '';
  state.kapDraft.forEach((row, i) => {
    const div = document.createElement('div');
    div.className = 'kap-entry';
    div.innerHTML = `
      <input type="text" placeholder="Açıklama başlığı" value="${escapeAttr(row.title || '')}" data-i="${i}" data-f="title">
      <select data-i="${i}" data-f="sign">
        <option value="pos" ${row.sign === 'pos' ? 'selected' : ''}>Pozitif</option>
        <option value="neg" ${row.sign === 'neg' ? 'selected' : ''}>Negatif</option>
        <option value="notr" ${(!row.sign || row.sign === 'notr') ? 'selected' : ''}>Nötr</option>
      </select>
      <button type="button" class="kap-remove" data-i="${i}" data-kind="kap" title="Kaydı sil">✕</button>
    `;
    els.kapEntries.appendChild(div);

    const reactionRow = document.createElement('div');
    reactionRow.className = 'kap-entry';
    reactionRow.style.marginTop = '-4px';
    reactionRow.innerHTML = `
      <input type="number" step="any" placeholder="Ertesi gün fiyat tepkisi (%)" value="${row.reaction ?? ''}" data-i="${i}" data-f="reaction" style="grid-column: 1 / span 2;">
      <span></span>
    `;
    els.kapEntries.appendChild(reactionRow);
  });
}

/* KAP faaliyet raporu linkleri */
function renderKapRaporEntries() {
  els.kapRaporEntries.innerHTML = '';
  state.kapRaporDraft.forEach((row, i) => {
    const div = document.createElement('div');
    div.className = 'kap-rapor-entry';
    div.innerHTML = `
      <input type="text" placeholder="Yıl" value="${escapeAttr(row.yil || '')}" data-i="${i}" data-f="yil">
      <input type="url" placeholder="KAP bildirim linki (https://...)" value="${escapeAttr(row.url || '')}" data-i="${i}" data-f="url">
      <button type="button" class="kap-remove" data-i="${i}" data-kind="kaprapor" title="Kaydı sil">✕</button>
    `;
    els.kapRaporEntries.appendChild(div);

    const ozetRow = document.createElement('div');
    ozetRow.className = 'kap-rapor-entry-ozet';
    ozetRow.innerHTML = `
      <textarea placeholder="Kendi kısa özetin (opsiyonel)" data-i="${i}" data-f="ozet">${escapeHtml(row.ozet || '')}</textarea>
    `;
    els.kapRaporEntries.appendChild(ozetRow);
  });
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

(function wireDelegatedEvents() {
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.closest && t.closest('#kapEntries')) {
      const i = parseInt(t.dataset.i, 10);
      const f = t.dataset.f;
      if (!Number.isNaN(i) && state.kapDraft[i]) {
        state.kapDraft[i][f] = f === 'reaction' ? (t.value === '' ? null : parseFloat(t.value)) : t.value;
      }
    }
    if (t.closest && t.closest('#kapRaporEntries')) {
      const i = parseInt(t.dataset.i, 10);
      const f = t.dataset.f;
      if (!Number.isNaN(i) && state.kapRaporDraft[i]) {
        state.kapRaporDraft[i][f] = t.value;
      }
    }
    if (t.id === 'f_sektor_gorunum') els.sektorGorunumOut.textContent = t.value;
  });

  document.addEventListener('click', (e) => {
    const rm = e.target.closest && e.target.closest('.kap-remove');
    if (rm) {
      const i = parseInt(rm.dataset.i, 10);
      if (rm.dataset.kind === 'kap') { state.kapDraft.splice(i, 1); renderKapEntries(); }
      else { state.kapRaporDraft.splice(i, 1); renderKapRaporEntries(); }
    }
  });
})();

/* ---------------- Render: company list ---------------- */
function renderCompanyList() {
  els.companyList.innerHTML = '';
  els.emptyListNote.hidden = state.companies.length > 0;
  state.companies.forEach(c => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'company-row' + (c.id === state.activeId ? ' is-active' : '');
    btn.type = 'button';
    btn.innerHTML = `<span>${escapeHtml(c.name)}</span><span class="ticker">${escapeHtml(c.ticker)}</span>`;
    btn.addEventListener('click', () => selectCompany(c.id));
    li.appendChild(btn);
    els.companyList.appendChild(li);
  });
}

/* ---------------- Render: per-company dashboard ---------------- */
function renderDashboard(c) {
  if (!c) {
    els.dashboardEmpty.hidden = false;
    els.dashboard.hidden = true;
    return;
  }
  els.dashboardEmpty.hidden = true;
  els.dashboard.hidden = false;

  const result = computeScores(c);
  const { scores, notes, derived } = result;
  const tier = tierFor(scores.genel);

  els.verdictStamp.className = 'verdict-stamp ' + tier.cls;
  els.verdictTier.textContent = tier.label;
  els.verdictTicker.textContent = c.ticker + (c.sector ? ' · ' + c.sector : '');
  els.verdictName.textContent = c.name;
  els.verdictScore.textContent = Number.isFinite(scores.genel) ? fmt1(scores.genel) : '—';

  drawRadar(els.radarCanvas, scores);

  els.scoreLedger.innerHTML = RADAR_AXES.map((axis, i) => {
    const v = scores[axis.key];
    const pct = Number.isFinite(v) ? clamp(v, 0, 100) : 0;
    return `<li>
      <span class="idx">${String(i + 1).padStart(2, '0')}</span>
      <span>
        ${axis.label}
        <div class="score-bar"><span style="width:${pct}%"></span></div>
      </span>
      <span class="score-val">${Number.isFinite(v) ? fmt1(v) : '—'}</span>
    </li>`;
  }).join('');

  if (notes.warnings.length) {
    els.warningsPanel.hidden = false;
    els.warningsList.innerHTML = notes.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('');
  } else {
    els.warningsPanel.hidden = true;
  }

  // Pozisyon & Değerleme
  const posVal = positionValue(c), posCost = costValue(c);
  const hasPosition = posVal !== null || posCost !== null;
  els.positionPanel.hidden = !hasPosition && !Number.isFinite(derived.cFk) && !Number.isFinite(c.fkSektor);
  if (!els.positionPanel.hidden) {
    els.posCost.textContent = posCost !== null ? fmtMoney(posCost) : '—';
    els.posValue.textContent = posVal !== null ? fmtMoney(posVal) : '—';
    if (posVal !== null && posCost !== null && posCost !== 0) {
      const pnlPct = ((posVal - posCost) / posCost) * 100;
      els.posPnl.textContent = fmtPct(pnlPct);
      els.posPnl.style.color = pnlPct >= 0 ? 'var(--green)' : 'var(--red)';
    } else { els.posPnl.textContent = '—'; els.posPnl.style.color = ''; }
    els.posWeight.textContent = Number.isFinite(derived.agirlik) ? '%' + fmt1(derived.agirlik) : '—';

    els.mulFk.textContent = fmtMulti(derived.cFk);
    els.mulFkSektor.textContent = fmtMulti(c.fkSektor);
    els.mulPddd.textContent = fmtMulti(derived.cPddd);
    els.mulPdddSektor.textContent = fmtMulti(c.pdddSektor);
    els.mulFdfavok.textContent = fmtMulti(derived.cFdFavok);
    els.mulFdfavokSektor.textContent = fmtMulti(c.fdfavokSektor);

    const fv = fairValueRange(c);
    if (fv) {
      els.fvLow.textContent = fv.low.toFixed(2) + ' ₺';
      els.fvHigh.textContent = fv.high.toFixed(2) + ' ₺';
      let markerPct = 50;
      if (Number.isFinite(c.guncelFiyat) && fv.high > fv.low) {
        markerPct = clamp(((c.guncelFiyat - fv.low) / (fv.high - fv.low)) * 100, 0, 100);
      }
      els.fvMarker.style.left = markerPct + '%';
      let konum = 'aralığın içinde';
      if (Number.isFinite(c.guncelFiyat)) {
        if (c.guncelFiyat < fv.low) konum = 'aralığın altında (ucuz uçta)';
        else if (c.guncelFiyat > fv.high) konum = 'aralığın üstünde (pahalı uçta)';
      }
      els.fvNote.textContent = `Güncel fiyat, sektör ortalama çarpanlarına göre olası ${konum}. Bu bir hedef fiyat değildir — girilen sektör ortalamaları değişirse aralık da değişir.`;
    } else {
      els.fvLow.textContent = '—'; els.fvHigh.textContent = '—';
      els.fvMarker.style.left = '50%';
      els.fvNote.textContent = 'Değer aralığı hesaplamak için toplam hisse sayısı ve en az bir sektör ortalama çarpanı gerekiyor.';
    }
  }

  const paragraphs = generateReport(c, result);
  els.reportBody.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');

  if (c.kap && c.kap.length) {
    els.kapPanel.hidden = false;
    els.kapTableBody.innerHTML = c.kap.map(k => {
      const signCls = k.sign === 'pos' ? 'pos' : k.sign === 'neg' ? 'neg' : 'notr';
      const signLabel = k.sign === 'pos' ? 'Pozitif' : k.sign === 'neg' ? 'Negatif' : 'Nötr';
      return `<tr><td>${escapeHtml(k.title || '—')} <span class="tag ${signCls}">${signLabel}</span></td><td>${fmtPct(k.reaction)}</td></tr>`;
    }).join('');
  } else {
    els.kapPanel.hidden = true;
  }

  if (c.kapRapor && c.kapRapor.length) {
    els.kapRaporPanel.hidden = false;
    els.kapRaporList.innerHTML = c.kapRapor.map(r => `
      <li>
        <a href="${escapeAttr(r.url || '#')}" target="_blank" rel="noopener">${escapeHtml(r.yil || 'Rapor')} → KAP'ta Aç</a>
        ${r.ozet ? `<p class="kap-rapor-ozet">${escapeHtml(r.ozet)}</p>` : ''}
      </li>`).join('');
  } else {
    els.kapRaporPanel.hidden = true;
  }
}

/* ---------------- Render: portfolio-wide summary ---------------- */
function renderPortfolioSummary() {
  const rows = state.companies
    .map(c => ({ c, val: positionValue(c), cost: costValue(c) }))
    .filter(r => r.val !== null && r.cost !== null);

  if (!rows.length) {
    els.pfEmptyNote.hidden = false;
    els.pfTotalCost.textContent = '—';
    els.pfTotalValue.textContent = '—';
    els.pfPnl.textContent = '—';
    els.pfVsBenchmark.textContent = '—';
    els.sectorBalance.hidden = true;
    return;
  }
  els.pfEmptyNote.hidden = true;

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalValue = rows.reduce((s, r) => s + r.val, 0);
  const pnlPct = totalCost !== 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;

  els.pfTotalCost.textContent = fmtMoney(totalCost);
  els.pfTotalValue.textContent = fmtMoney(totalValue);
  els.pfPnl.textContent = pnlPct !== null ? fmtPct(pnlPct) : '—';

  const { bist100Baslangic, bist100Guncel } = state.benchmark || {};
  if (Number.isFinite(bist100Baslangic) && Number.isFinite(bist100Guncel) && bist100Baslangic !== 0 && pnlPct !== null) {
    const bistChange = ((bist100Guncel - bist100Baslangic) / bist100Baslangic) * 100;
    const fark = pnlPct - bistChange;
    els.pfVsBenchmark.textContent = (fark >= 0 ? '+' : '') + fark.toFixed(1) + ' puan';
    els.pfVsBenchmark.style.color = fark >= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    els.pfVsBenchmark.textContent = 'Endeks girilmedi';
    els.pfVsBenchmark.style.color = '';
  }

  // Sektör dağılımı
  const bySector = {};
  rows.forEach(r => {
    const sec = r.c.sector && r.c.sector.trim() ? r.c.sector.trim() : 'Diğer';
    bySector[sec] = (bySector[sec] || 0) + r.val;
  });
  const sectorEntries = Object.entries(bySector).sort((a, b) => b[1] - a[1]);

  els.sectorBalance.hidden = false;
  els.sectorBars.innerHTML = sectorEntries.map(([sec, val]) => {
    const pct = (val / totalValue) * 100;
    return `<li>
      <span>${escapeHtml(sec)}</span>
      <div class="sector-bar-track"><div class="sector-bar-fill" style="width:${clamp(pct, 0, 100)}%"></div></div>
      <span class="sector-bar-pct">%${fmt1(pct)}</span>
    </li>`;
  }).join('');

  const narrativeParts = [];
  if (sectorEntries.length) {
    const [topSec, topVal] = sectorEntries[0];
    const topPct = (topVal / totalValue) * 100;
    narrativeParts.push(`Portföyünün en büyük dilimi %${fmt1(topPct)} ile ${topSec} sektöründe.`);
    if (topPct > 40) {
      narrativeParts.push(`Bu oran %40'ın üzerinde — tek sektöre bağımlılık riski taşıyor, o sektörü etkileyecek bir gelişme portföyünün tamamını orantısız etkileyebilir.`);
    }
    if (sectorEntries.length < 3) {
      narrativeParts.push(`Yalnızca ${sectorEntries.length} sektörde pozisyonun var — çeşitlendirme sınırlı görünüyor.`);
    } else {
      narrativeParts.push(`${sectorEntries.length} farklı sektöre yayılmışsın, bu yoğunlaşma riskini azaltıyor.`);
    }
  }
  els.sectorNarrative.innerHTML = narrativeParts.map(t => `<p>${escapeHtml(t)}</p>`).join('');
}

/* ---------------- Actions ---------------- */
function selectCompany(id) {
  state.activeId = id;
  const c = state.companies.find(x => x.id === id);
  els.companyForm.hidden = !c;
  if (c) fillForm(c);
  renderCompanyList();
  renderDashboard(c);
}

function startNewCompany() {
  state.activeId = null;
  els.companyForm.hidden = false;
  clearForm();
  renderCompanyList();
  renderDashboard(null);
  document.getElementById('f_name').focus();
}

function handleSubmit(e) {
  e.preventDefault();
  const ref = rvCompaniesRef();
  if (!ref) return;
  const data = readForm();
  const { id, ...fields } = data;
  state.activeId = id;
  const submitBtn = els.companyForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  ref.doc(id).set(fields)
    .then(() => { renderDashboard({ id, ...fields }); })
    .catch((err) => alert('Kaydedilemedi: ' + err.message))
    .finally(() => { submitBtn.disabled = false; });
}

function handleDelete() {
  const ref = rvCompaniesRef();
  if (!ref || !state.activeId) return;
  const c = state.companies.find(x => x.id === state.activeId);
  if (!c) return;
  if (!confirm(`"${c.name}" kaydını silmek istediğinize emin misiniz?`)) return;
  ref.doc(state.activeId).delete()
    .then(() => { state.activeId = null; els.companyForm.hidden = true; renderDashboard(null); })
    .catch((err) => alert('Silinemedi: ' + err.message));
}

function handleSaveBenchmark() {
  const ref = rvSettingsRef();
  if (!ref) return;
  const num = (id) => { const v = document.getElementById(id).value; return v === '' ? null : parseFloat(v); };
  const data = { bist100Baslangic: num('bm_bist_baslangic'), bist100Guncel: num('bm_bist_guncel') };
  ref.set(data, { merge: true })
    .then(() => { els.benchmarkForm.hidden = true; })
    .catch((err) => alert('Kaydedilemedi: ' + err.message));
}

/* ---------------- Init ---------------- */
function init() {
  cacheEls();
  renderCompanyList();
  renderDashboard(null);
  renderPortfolioSummary();

  els.newCompanyBtn.addEventListener('click', startNewCompany);
  els.companyForm.addEventListener('submit', handleSubmit);
  els.deleteCompanyBtn.addEventListener('click', handleDelete);
  els.addKapBtn.addEventListener('click', () => {
    state.kapDraft.push({ title: '', sign: 'notr', reaction: null });
    renderKapEntries();
  });
  els.addKapRaporBtn.addEventListener('click', () => {
    state.kapRaporDraft.push({ yil: '', url: '', ozet: '' });
    renderKapRaporEntries();
  });
  els.editBenchmarkBtn.addEventListener('click', () => {
    els.benchmarkForm.hidden = !els.benchmarkForm.hidden;
  });
  els.saveBenchmarkBtn.addEventListener('click', handleSaveBenchmark);

  els.refreshDovizBtn.addEventListener('click', rvFetchDovizKurlari);
  els.saveMacroBtn.addEventListener('click', handleSaveMacro);
  rvFetchDovizKurlari();
}

document.addEventListener('DOMContentLoaded', init);
