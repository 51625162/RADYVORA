/* ============================================================
   RADYVORA — AI Worker Yapılandırması
   AI-KURULUM.md dosyasındaki adım 4'te aldığın Cloudflare Worker
   adresini aşağıya yapıştır. Örnek:

   const RV_WORKER_URL = "https://radyvora-ai.senin-adin.workers.dev";

   Bu adres gizli değildir, olduğu gibi bırakabilirsin (gerçek sır
   olan Anthropic API anahtarı yalnızca Worker içinde, secret olarak
   duruyor — bkz. AI-KURULUM.md adım 3).
   ============================================================ */

const RV_WORKER_URL = "BURAYA_WORKER_URL_YAPISTIR";

function rvWorkerConfigured() {
  return typeof RV_WORKER_URL === 'string'
    && RV_WORKER_URL.startsWith('https://')
    && !RV_WORKER_URL.includes('BURAYA_');
}
