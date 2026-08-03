/* ============================================================
   RADYVORA — AI Worker Yapılandırması
   ============================================================ */

const RV_WORKER_URL = "https://icy-cloud-c0c6.kasim-merkez-02.workers.dev";

function rvWorkerConfigured() {
  return typeof RV_WORKER_URL === 'string'
    && RV_WORKER_URL.startsWith('https://')
    && !RV_WORKER_URL.includes('BURAYA_');
}
