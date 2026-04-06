// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/utils/keepAlive.js
//  Zuia Render.com kukulala (free tier inazima baada ya dakika 15)
// ═══════════════════════════════════════════════════════════════

const axios = require('axios');

const SITE_URL    = process.env.SITE_URL || '';
const INTERVAL_MS = 14 * 60 * 1000; // kila dakika 14

function startKeepAlive() {
  if (!SITE_URL) {
    console.log('[keepAlive] SITE_URL haijawekwa — keep-alive imezimwa.');
    return;
  }

  setInterval(async () => {
    try {
      await axios.get(`${SITE_URL}/api/health`, { timeout: 10000 });
      console.log(`[keepAlive] ✅ Ping ${new Date().toISOString()}`);
    } catch (err) {
      console.warn(`[keepAlive] ⚠️ Ping imeshindwa: ${err.message}`);
    }
  }, INTERVAL_MS);

  console.log(`[keepAlive] 🟢 Imeanza — ping kila dakika 14 → ${SITE_URL}`);
}

module.exports = { startKeepAlive };
