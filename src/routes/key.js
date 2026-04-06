// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/routes/key.js
//  PixTVMax ClearKey channel fetcher
//  (Node.js equivalent ya key.php)
// ═══════════════════════════════════════════════════════════════

const express   = require('express');
const NodeCache = require('node-cache');
const { fetchUrl } = require('../utils/fetchUrl');

const router = express.Router();
const cache  = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_CHANNELS) || 300 });

const PIXTV_API_URL = 'https://pixtvmax.quest/api/categories/1769090478198/channels';

// ── GET /api/key ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  const cached = cache.get('key_channels');
  if (cached && !req.query.refresh) return res.json(cached);

  const body = await fetchUrl(PIXTV_API_URL);

  if (!body) {
    return res.status(502).json({ success: false, error: 'PixTVMax API haipatikani.' });
  }

  let data;
  try { data = JSON.parse(body); } catch {
    return res.status(502).json({ success: false, error: 'PixTVMax ilirejesha data isiyosomeka.' });
  }

  if (!Array.isArray(data)) {
    return res.status(502).json({ success: false, error: 'Muundo wa data si sahihi.' });
  }

  const channels = [];

  for (const ch of data) {
    const mpd = (ch.mpd_url || '').trim();
    if (!mpd || !mpd.includes('.mpd')) continue;

    // ClearKey — toa kid na key kutoka headers
    let key = null;
    if (
      ch.drm_type === 'CLEARKEY' &&
      ch.headers?.kid &&
      ch.headers?.key
    ) {
      key = `${ch.headers.kid}:${ch.headers.key}`;
    }

    channels.push({
      id    : ch.id       || null,
      name  : ch.name     || '',
      image : ch.logo_url || null,
      url   : mpd,
      key,
      drm   : ch.drm_type || 'NONE',
    });
  }

  const payload = {
    success  : true,
    count    : channels.length,
    channels,
  };

  cache.set('key_channels', payload);
  return res.json(payload);
});

module.exports = router;
