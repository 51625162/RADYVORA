/* ============================================================
   RADYVORA — AI Aracı Sunucu (Cloudflare Worker)
   Bu dosyanın TAMAMINI Cloudflare Worker'ının "Edit Code" ekranına
   yapıştır ve "Deploy" de. Ayrıca Worker Settings > Variables and
   Secrets kısmından ANTHROPIC_API_KEY adında bir secret eklemen
   gerekiyor (bkz. AI-KURULUM.md).

   Bu Worker şu an tek bir işlev yapıyor: KAP'tan yüklenen bilanço
   PDF'ini veya Excel'den çıkarılan metni okuyup Özet Bilanço/Gelir
   Tablosu/Nakit Akış alanlarını JSON olarak döndürüyor. İleride aynı
   Worker'a yeni "action" tipleri eklenerek (KAP özetleme, CDS/PMI
   haber taraması gibi) genişletilebilir.
============================================================ */

const RADYVORA_ALLOWED_ORIGIN = '*';
// Güvenliği artırmak istersen '*' yerine kendi GitHub Pages adresini yaz, örn:
// const RADYVORA_ALLOWED_ORIGIN = 'https://51625162.github.io';

const FINANCIALS_SCHEMA_HINT = `{
  "periods": [
    {
      "period_label": string,  // belgede yazan dönem etiketi, örn. "2026/6" veya "2026 2. Çeyrek"
      "satis": number|null, "brut_kar": number|null, "favok": number|null,
      "faaliyet_kari": number|null, "net_kar": number|null,
      "donen_varlik": number|null, "duran_varlik": number|null,
      "kv_yukumluluk": number|null, "uv_yukumluluk": number|null,
      "net_borc": number|null, "ozkaynaklar": number|null,
      "isletme_nakit": number|null, "yatirim_nakit": number|null, "finansman_nakit": number|null,
      "donem_sonu_nakit": number|null
    }
    /* belgede kaç farklı dönem (sütun) varsa hepsi için birer nesne, bu dizinin içine sırayla eklenir */
  ]
}`;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': RADYVORA_ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handleExtractFinancials(body, env) {
  const { kind, data } = body;
  if (!data) {
    return new Response(JSON.stringify({ error: 'Veri gönderilmedi.' }), { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }

  const systemPrompt =
    'Sen bir finansal veri çıkarma asistanısın. Sana bir Türkiye şirketinin KAP bilanço/gelir tablosu/nakit akış tablosu ' +
    '(PDF veya Excel\'den metne çevrilmiş hali) verilecek. Belgede genellikle birden fazla dönem (sütun) olur — ' +
    'örneğin cari dönem ve karşılaştırmalı önceki dönem, bazen daha fazlası. Görevin SADECE aşağıdaki JSON şemasına ' +
    'uygun, başka hiçbir açıklama, önsöz veya kod bloğu işareti olmadan bir JSON döndürmek:\n' +
    FINANCIALS_SCHEMA_HINT +
    '\nTüm rakamları milyon TL (mn ₺) cinsinden, düz ondalıklı sayı olarak ver (binlik ayraç kullanma, ondalık için nokta kullan). ' +
    'Belgede kaç dönem/sütun görürsen "periods" dizisine hepsini ayrı ayrı ekle (en güncel dönem dizinin ilk elemanı olsun). ' +
    'Her dönem için "period_label" alanına belgede o sütunun başlığında yazan tarihi/dönemi olduğu gibi yaz. ' +
    'Bir kalemi belgede bulamazsan o alanı null yap, tahmin etme.';

  const contentBlocks = [];
  if (kind === 'pdf') {
    contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
  } else {
    contentBlocks.push({ type: 'text', text: data });
  }
  contentBlocks.push({ type: 'text', text: 'Yukarıdaki belgeden mali tablo kalemlerini çıkar ve yalnızca şemaya uygun JSON döndür.' });

  let aiRes;
  try {
    aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Anthropic API\'ye ulaşılamadı: ' + e.message }), { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }

  const aiJson = await aiRes.json();
  if (!aiRes.ok) {
    const msg = (aiJson && aiJson.error && aiJson.error.message) || 'AI isteği başarısız oldu.';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }

  const text = (aiJson.content || []).map((b) => b.text || '').join('');
  const cleaned = text.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'AI yanıtı JSON olarak ayrıştırılamadı.', raw: text }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
}

/* ================================================================
   TCMB EVDS — TÜFE Yıllık % ve Fonlama Maliyeti (Politika Faizi
   göstergesi olarak kullanılır). Ayrı bir EVDS API anahtarı gerekir
   (env.EVDS_API_KEY) — bkz. EVDS-KURULUM.md.

   Not: TP.APIFON4, TCMB'nin "Ağırlıklı Ortalama Fonlama Maliyeti"
   serisidir — resmi ilan edilen 1 hafta repo faiziyle pratikte çok
   yakından hareket eder ama birebir aynı seri değildir. Bu farkı
   kullanıcıya açıkça belirtiyoruz (script.js tarafında).
================================================================ */
function evdsDateFmt(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

async function handleGetMacro(env) {
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json' };
  if (!env.EVDS_API_KEY) {
    return new Response(JSON.stringify({ error: 'EVDS API anahtarı Worker\'a eklenmedi (bkz. EVDS-KURULUM.md).' }), { status: 400, headers });
  }

  const today = new Date();
  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 2);

  const url = `https://evds2.tcmb.gov.tr/service/evds/series=TP.FG.J0-TP.APIFON4&startDate=${evdsDateFmt(start)}&endDate=${evdsDateFmt(today)}&type=json&frequency=5`;

  let res;
  try {
    res = await fetch(url, { headers: { key: env.EVDS_API_KEY } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'EVDS\'ye ulaşılamadı: ' + e.message }), { status: 502, headers });
  }
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'EVDS isteği başarısız oldu (kod ' + res.status + '). API anahtarını kontrol et.' }), { status: 500, headers });
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'EVDS yanıtı okunamadı.' }), { status: 500, headers });
  }

  const items = json.items || [];
  const tufeItems = items.filter(it => it.TP_FG_J0 !== null && it.TP_FG_J0 !== undefined && it.TP_FG_J0 !== '');
  const faizItems = items.filter(it => it.TP_APIFON4 !== null && it.TP_APIFON4 !== undefined && it.TP_APIFON4 !== '');

  let tufeYillik = null;
  let asOf = null;
  if (tufeItems.length >= 13) {
    const last = tufeItems[tufeItems.length - 1];
    const yearAgo = tufeItems[tufeItems.length - 13];
    const lastVal = parseFloat(last.TP_FG_J0);
    const yearAgoVal = parseFloat(yearAgo.TP_FG_J0);
    if (Number.isFinite(lastVal) && Number.isFinite(yearAgoVal) && yearAgoVal !== 0) {
      tufeYillik = ((lastVal / yearAgoVal) - 1) * 100;
    }
    asOf = last.Tarih;
  }

  let faiz = null;
  if (faizItems.length) {
    const lastFaiz = faizItems[faizItems.length - 1];
    const v = parseFloat(lastFaiz.TP_APIFON4);
    if (Number.isFinite(v)) faiz = v;
    if (!asOf) asOf = lastFaiz.Tarih;
  }

  return new Response(JSON.stringify({ tufe_yillik: tufeYillik, faiz, asOf }), { headers });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Geçersiz istek gövdesi.' }), { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
    }

    if (body.action === 'extract_financials') {
      return handleExtractFinancials(body, env);
    }
    if (body.action === 'get_macro') {
      return handleGetMacro(env);
    }

    return new Response(JSON.stringify({ error: 'Bilinmeyen action: ' + body.action }), { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  },
};
