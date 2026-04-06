// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/routes/azam.js
//  Azam TV Channel Aggregator
//  Sources: BailaTV · ZimoTV · PixTVMax
//  (Node.js equivalent ya azam.php)
// ═══════════════════════════════════════════════════════════════

const express  = require('express');
const NodeCache = require('node-cache');
const { fetchUrl, extractStreamData } = require('../utils/fetchUrl');

const router = express.Router();
const cache  = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_CHANNELS) || 300 });

// ── CONFIG ────────────────────────────────────────────────────

const BAILATV_CHANNELS = [
  { url: 'https://bailatv.live/one.php',   name: 'Azam One',      category: 'TAMTHILIYA', image: 'https://i.postimg.cc/RFfMP31f/1770047388328-Master-Chef-Azam-ONE-poster-Image.webp' },
  { url: 'https://bailatv.live/kix.php',   name: 'Kix TV',        category: 'MUSIC',      image: 'https://i.postimg.cc/pTYdyxDW/1745514813150-Crown-TVPoster-Image.webp' },
  { url: 'https://bailatv.live/cheka.php', name: 'Cheka Plus TV', category: 'MUSIC',      image: 'https://i.postimg.cc/T2Fqj5jf/1746270439707-Cheka-Plus-TV-poster-Image.webp' },
  { url: 'https://bailatv.live/zama.php',  name: 'Zamaradi TV',   category: 'MUSIC',      image: 'https://i.postimg.cc/0rgLy7wK/Zamaradi-TV-d7c13bcf55a3290fd85d8155f0888e85.png' },
];

const ZIMO_KEY_MAP = {
  'sports 1' : { name: 'AzamSports 1 HD', key: 'c31df1600afc33799ecac543331803f2:dd2101530e222f545997d4c553787f85', category: 'NBC PREMIER LEAGUE' },
  'sports 2' : { name: 'AzamSports 2 HD', key: '739e7499125b31cc9948da8057b84cf9:1b7d44d798c351acc02f33ddfbb7682a', category: 'NBC PREMIER LEAGUE' },
  'sports 3' : { name: 'AzamSports 3 HD', key: '2f12d7b889de381a9fb5326ca3aa166d:51c2d733a54306fdf89acd4c9d4f6005', category: 'NBC PREMIER LEAGUE' },
  'sports 4' : { name: 'AzamSports 4 HD', key: '1606cddebd3c36308ec5072350fb790a:04ece212a9201531afdd91c6f468e0b3', category: 'NBC PREMIER LEAGUE' },
  'azm two'  : { name: 'Azam Two',        key: '3b92b644635f3bad9f7d09ded676ec47:d012a9d5834f69be1313d4864d150a5f', category: 'TAMTHILIYA' },
  'sinema'   : { name: 'Sinema Zetu',     key: 'd628ae37a8f0336b970f250d9699461e:1194c3d60bb494aabe9114ca46c2738e', category: 'TAMTHILIYA' },
  'utv'      : { name: 'UTV',             key: '31b8fc6289fe3ca698588a59d845160c:f8c4e73f419cb80db3bdf4a974e31894', category: 'OTHER CHANNELS' },
  'wasafi'   : { name: 'Wasafi TV',       key: '8714fe102679348e9c76cfd315dacaa0:a8b86ceda831061c13c7c4c67bd77f8e', category: 'MUSIC' },
  'zbc'      : { name: 'ZBC',             key: '2d60429f7d043a638beb7349ae25f008:f9b38900f31ce549425df1de2ea28f9d', category: 'OTHER CHANNELS' },
};

const ZIMO_CATEGORIES = [
  'local channels', 'international', 'sports',
  'movies', 'music', 'kids', 'news', 'religious',
];

// PixTVMax: catId => forcedCategory (null = kadiria kwa jina)
const PIXTV_CATEGORIES = {
  '1769178540796' : null,           // general — guessCategory()
  '1769178579863' : 'NEWS',         // News channels
  '1770127150580' : 'KIDS',         // Cartoon / Kids
  '1770122035820' : 'DOCUMENTARY',  // Documentary
};

// ── HELPERS ───────────────────────────────────────────────────

function streamType(url) {
  return url.endsWith('.m3u8') ? 'hls' : 'dash';
}

function buildChannel(name, category, url, image, key) {
  return { name, category, url, image: image || null, key: key || null, type: streamType(url) };
}

function guessCategory(title) {
  const t = title.toLowerCase();
  if (/sport|premier|liga/.test(t))          return 'SPORTS';
  if (/music|wasafi|cheka/.test(t))           return 'MUSIC';
  if (/news|habari|tv8/.test(t))              return 'NEWS';
  if (/movie|sinema|film/.test(t))            return 'MOVIES';
  if (/kid|cartoon|junior/.test(t))           return 'KIDS';
  if (/dini|imani|religi/.test(t))            return 'RELIGIOUS';
  if (/documentary|dokument/.test(t))         return 'DOCUMENTARY';
  return 'OTHER CHANNELS';
}

// ── SEHEMU 1: BAILATV ─────────────────────────────────────────

async function fetchBailaTV() {
  const results = await Promise.allSettled(
    BAILATV_CHANNELS.map(async (item) => {
      const html = await fetchUrl(item.url);
      if (!html) return null;
      const data = extractStreamData(html);
      if (!data.stream_url) return null;
      return buildChannel(item.name, item.category, data.stream_url, item.image, data.clear_key || null);
    })
  );
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

// ── SEHEMU 2: ZIMOTV ──────────────────────────────────────────

async function fetchZimoTV(seen) {
  const channels = [];

  await Promise.allSettled(
    ZIMO_CATEGORIES.map(async (cat) => {
      const body = await fetchUrl(
        `https://zimotv.com/mb/api/get-channels.php?category=${encodeURIComponent(cat)}`,
        { referer: 'https://zimotv.com/', ua: 'Mozilla/5.0' }
      );
      if (!body) return;

      let data;
      try { data = JSON.parse(body); } catch { return; }
      if (!Array.isArray(data?.channels)) return;

      for (const ch of data.channels) {
        const chUrl = (ch.url   || '').trim();
        const title = (ch.title || '').trim();
        if (!chUrl || !title || seen.has(chUrl)) continue;

        const titleLower = title.toLowerCase();
        let key      = null;
        let name     = title;
        let category = guessCategory(title);

        for (const [keyword, info] of Object.entries(ZIMO_KEY_MAP)) {
          if (titleLower.includes(keyword)) {
            key      = info.key;
            name     = info.name;
            category = info.category;
            break;
          }
        }

        // Ruka ZimoTV channels ambazo hazina clearkey
        if (!key) continue;

        seen.add(chUrl);
        channels.push(buildChannel(name, category, chUrl, ch.logo || null, key));
      }
    })
  );

  return channels;
}

// ── SEHEMU 3: PIXTVMAX ────────────────────────────────────────

async function fetchPixTVMax(seen) {
  const channels = [];

  await Promise.allSettled(
    Object.entries(PIXTV_CATEGORIES).map(async ([catId, forcedCategory]) => {
      const body = await fetchUrl(`https://pixtvmax.quest/api/categories/${catId}/channels`);
      if (!body) return;

      let data;
      try { data = JSON.parse(body); } catch { return; }
      if (!Array.isArray(data)) return;

      for (const ch of data) {
        let mpd     = (ch.mpd_url  || '').trim();
        const name    = (ch.name     || '').trim();
        const image   = ch.logo_url  || null;
        const drmType = (ch.drm_type || 'NONE').toUpperCase();

        if (!mpd) continue;

        // Ruka Widevine/PlayReady
        if (drmType === 'WIDEVINE' || drmType === 'PLAYREADY') continue;

        // Ruka kama tayari ipo
        if (seen.has(mpd)) continue;

        // ClearKey kutoka API
        let key = null;
        if (drmType === 'CLEARKEY' && ch.license_url) {
          key = ch.license_url;
        }

        // BailaTV proxy — chuja stream_url halisi
        if (mpd.includes('bailatv.live')) {
          const html = await fetchUrl(mpd);
          if (!html) continue;
          const streamData = extractStreamData(html);
          if (!streamData.stream_url) continue;
          mpd = streamData.stream_url;
          if (!key && streamData.clear_key) key = streamData.clear_key;
        }

        // Ruka MPD ambazo hazina clearkey (isipokuwa NONE)
        if (drmType !== 'NONE' && !key) continue;

        seen.add(mpd);
        const category = forcedCategory !== null ? forcedCategory : guessCategory(name);
        channels.push(buildChannel(name, category, mpd, image, key));
      }
    })
  );

  return channels;
}

// ── GET /api/azam ─────────────────────────────────────────────

router.get('/', async (req, res) => {
  const isDownload = req.query.download === '1';
  const cacheKey   = 'azam_channels';

  // Rejesha kutoka cache kama ipo
  const cached = cache.get(cacheKey);
  if (cached && !req.query.refresh) {
    if (isDownload) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=channels.json');
    }
    return res.json(cached);
  }

  try {
    const seen = new Set();

    const [bailaChannels, zimoChannels, pixtvChannels] = await Promise.all([
      fetchBailaTV(),
      fetchZimoTV(seen),
      fetchPixTVMax(seen),
    ]);

    // Unganisha na ondoa nakala kwa jina
    const allChannels   = [...bailaChannels, ...zimoChannels, ...pixtvChannels];
    const finalSeen     = new Set();
    const finalChannels = [];

    for (const ch of allChannels) {
      const nameKey = ch.name.toLowerCase().trim();
      if (finalSeen.has(nameKey)) continue;
      finalSeen.add(nameKey);
      finalChannels.push(ch);
    }

    // Panga kwa category kisha jina
    finalChannels.sort((a, b) => {
      const catDiff = a.category.localeCompare(b.category);
      return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name);
    });

    const payload = {
      success    : true,
      count      : finalChannels.length,
      fetched_at : new Date().toISOString(),
      channels   : finalChannels,
    };

    cache.set(cacheKey, payload);

    if (isDownload) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=channels.json');
    }

    return res.json(payload);

  } catch (err) {
    console.error('[azam] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Imeshindwa kupakua channels. Jaribu tena.' });
  }
});

module.exports = router;
