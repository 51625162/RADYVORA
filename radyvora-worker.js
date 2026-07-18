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
  "bu_donem": {
    "satis": number|null, "brut_kar": number|null, "favok": number|null,
    "faaliyet_kari": number|null, "net_kar": number|null,
    "donen_varlik": number|null, "duran_varlik": number|null,
    "kv_yukumluluk": number|null, "uv_yukumluluk": number|null,
    "net_borc": number|null, "ozkaynaklar": number|null,
    "isletme_nakit": number|null, "yatirim_nakit": number|null, "finansman_nakit": number|null
  },
  "onceki_donem": { /* bu_donem ile aynı alanlar, karşılaştırmalı önceki dönem */ }
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
    '(PDF veya Excel\'den metne çevrilmiş hali) verilecek. Görevin SADECE aşağıdaki JSON şemasına uygun, ' +
    'başka hiçbir açıklama, önsöz veya kod bloğu işareti olmadan bir JSON döndürmek:\n' +
    FINANCIALS_SCHEMA_HINT +
    '\nTüm rakamları milyon TL (mn ₺) cinsinden, düz ondalıklı sayı olarak ver (binlik ayraç kullanma, ondalık için nokta kullan). ' +
    '"bu_donem" belgedeki en güncel/son dönem sütunu, "onceki_donem" ise karşılaştırmalı önceki dönem sütunudur. ' +
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

    return new Response(JSON.stringify({ error: 'Bilinmeyen action: ' + body.action }), { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  },
};
