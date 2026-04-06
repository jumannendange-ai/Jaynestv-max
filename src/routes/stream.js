// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/routes/stream.js
//  Stream Proxy — inaficha URL halisi nyuma ya domain yako
//
//  Mfano:
//    GET /stream/azamsport1.mpd?token=JWT
//    → proxy → https://cdnblncr.azamtvltd.co.tz/live/...AzamSport1.mpd
//
//  Token ya saa 6 inahitajika — inabadilika kila ombi jipya
// ═══════════════════════════════════════════════════════════════

const express  = require('express');
const jwt      = require('jsonwebtoken');
const axios    = require('axios');
const https    = require('https');

const router = express.Router();

// ── Siri mbili tofauti: auth ya app (saa 1/30d) na stream (saa 6) ──
const STREAM_SECRET  = process.env.STREAM_SECRET  || process.env.JWT_SECRET + '_stream';
const STREAM_EXPIRES = process.env.STREAM_EXPIRES || '6h';

// ── Ramani: slug → URL halisi ya stream ─────────────────────────
// Ongeza channels zako hapa. Slug = jina linaloonekana kwa umma.
const CHANNEL_MAP = {
  // ── NBC PREMIER LEAGUE ─────────────────────────────────────
  'azamsport1' : {
    url      : 'https://cdnblncr.azamtvltd.co.tz/live/eds/AzamSport1/DASH/AzamSport1.mpd',
    type     : 'mpd',
    drm      : 'clearkey',
    key_id   : 'c31df1600afc33799ecac543331803f2',
    key      : 'dd2101530e222f545997d4c553787f85',
    category : 'NBC PREMIER LEAGUE',
    name     : 'AzamSports 1 HD',
    plan     : 'standard',   // plan inayohitajika kuona
  },
  'azamsport2' : {
    url      : 'https://cdnblncr.azamtvltd.co.tz/live/eds/AzamSport2/DASH/AzamSport2.mpd',
    type     : 'mpd',
    drm      : 'clearkey',
    key_id   : '739e7499125b31cc9948da8057b84cf9',
    key      : '1b7d44d798c351acc02f33ddfbb7682a',
    category : 'NBC PREMIER LEAGUE',
    name     : 'AzamSports 2 HD',
    plan     : 'standard',
  },
  'azamsport3' : {
    url      : 'https://cdnblncr.azamtvltd.co.tz/live/eds/AzamSport3/DASH/AzamSport3.mpd',
    type     : 'mpd',
    drm      : 'clearkey',
    key_id   : '2f12d7b889de381a9fb5326ca3aa166d',
    key      : '51c2d733a54306fdf89acd4c9d4f6005',
    category : 'NBC PREMIER LEAGUE',
    name     : 'AzamSports 3 HD',
    plan     : 'standard',
  },
  'azamsport4' : {
    url      : 'https://cdnblncr.azamtvltd.co.tz/live/eds/AzamSport4/DASH/AzamSport4.mpd',
    type     : 'mpd',
    drm      : 'clearkey',
    key_id   : '1606cddebd3c36308ec5072350fb790a',
    key      : '04ece212a9201531afdd91c6f468e0b3',
    category : 'NBC PREMIER LEAGUE',
    name     : 'AzamSports 4 HD',
    plan     : 'standard',
  },

  // ── TAMTHILIYA ─────────────────────────────────────────────
  'azamtwo' : {
    url      : 'https://cdnblncr.azamtvltd.co.tz/live/eds/AzamTwo/DASH/AzamTwo.mpd',
    type     : 'mpd',
    drm      : 'clearkey',
    key_id   : '3b92b644635f3bad9f7d09ded676ec47',
    key      : 'd012a9d5834f69be1313d4864d150a5f',
    category : 'TAMTHILIYA',
    name     : 'Azam Two',
    plan     : 'basic',
  },
  'sinema' : {
    url      : 'https://cdnblncr.azamtvltd.co.tz/live/eds/SinemaZetu/DASH/SinemaZetu.mpd',
    type     : 'mpd',
    drm      : 'clearkey',
    key_id   : 'd628ae37a8f0336b970f250d9699461e',
    key      : '1194c3d60bb494aabe9114ca46c2738e',
    category : 'TAMTHILIYA',
    name     : 'Sinema Zetu',
    plan     : 'basic',
  },

  // ── MUSIC ──────────────────────────────────────────────────
  'wasafi' : {
    url      : 'https://cdnblncr.azamtvltd.co.tz/live/eds/WasafiTV/DASH/WasafiTV.mpd',
    type     : 'mpd',
    drm      : 'clearkey',
    key_id   : '8714fe102679348e9c76cfd315dacaa0',
    key      : 'a8b86ceda831061c13c7c4c67bd77f8e',
    category : 'MUSIC',
    name     : 'Wasafi TV',
    plan     : 'basic',
  },
};

// ── Plan hierarchy ───────────────────────────────────────────
const PLAN_LEVEL = { trial: 0, free: 0, basic: 1, standard: 2, premium: 3 };

function planAllowed(userPlan, requiredPlan) {
  return (PLAN_LEVEL[userPlan] ?? 0) >= (PLAN_LEVEL[requiredPlan] ?? 1);
}

// ── HTTPS agent bila SSL verify (kwa Azam CDN) ───────────────
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ════════════════════════════════════════════════════════════════
//  1. POST /stream/token  — omba stream token (saa 6)
//     Body: { user_id, email, plan, sub_end }
//     Inahitaji: Bearer JWT ya app (kutoka auth/login)
// ════════════════════════════════════════════════════════════════
router.post('/token', (req, res) => {
  // Thibitisha app token kwanza
  const appToken = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!appToken) {
    return res.status(401).json({ success: false, error: 'Hujaingia. Token inahitajika.' });
  }

  let appDecoded;
  try {
    appDecoded = jwt.verify(appToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, error: 'Token ya app batili au imeisha.' });
  }

  // Angalia subscription — trial/free haziruhusiwi stream
  const plan    = appDecoded.plan    || 'free';
  const sub_end = appDecoded.sub_end || appDecoded.trial_end || '';

  if (plan !== 'trial' && sub_end && new Date(sub_end) < new Date()) {
    return res.status(403).json({ success: false, error: 'Subscription yako imeisha. Lipia ili kuendelea.' });
  }

  // Tengeneza stream token — inaisha saa 6
  const streamPayload = {
    uid  : appDecoded.user_id,
    plan,
    // IP ya mtumiaji — ongeza ulinzi zaidi
    ip   : req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress,
  };

  const streamToken = jwt.sign(streamPayload, STREAM_SECRET, { expiresIn: STREAM_EXPIRES });

  return res.json({
    success      : true,
    stream_token : streamToken,
    expires_in   : 21600,  // sekunde 21600 = saa 6
    expires_at   : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    usage        : 'Tumia stream_token kama ?token= kwenye /stream/:slug.mpd au /stream/:slug.m3u8',
  });
});

// ════════════════════════════════════════════════════════════════
//  2. GET /stream/channels  — orodha ya channels zilizopo
//     (hazionyeshi URLs halisi — slugs tu)
// ════════════════════════════════════════════════════════════════
router.get('/channels', (req, res) => {
  const appToken = (req.headers['authorization'] || '').replace('Bearer ', '');
  let userPlan = 'free';

  try {
    const d = jwt.verify(appToken, process.env.JWT_SECRET);
    userPlan = d.plan || 'free';
  } catch { /* haujaingia — onyesha tu basic channels */ }

  const channels = Object.entries(CHANNEL_MAP).map(([slug, ch]) => ({
    slug,
    name     : ch.name,
    category : ch.category,
    type     : ch.type,
    plan     : ch.plan,
    locked   : !planAllowed(userPlan, ch.plan),
    // URLs za proxy — hazioneshi URL halisi
    stream_url : `/stream/${slug}.${ch.type}`,
    token_url  : '/stream/token',
  }));

  return res.json({ success: true, count: channels.length, channels });
});

// ════════════════════════════════════════════════════════════════
//  3. GET /stream/:slug.mpd  — proxy ya DASH manifest
//  4. GET /stream/:slug.m3u8 — proxy ya HLS manifest
//     Query: ?token=STREAM_JWT
// ════════════════════════════════════════════════════════════════
router.get('/:filename', async (req, res) => {
  const { filename } = req.params;
  const token        = req.query.token || (req.headers['authorization'] || '').replace('Bearer ', '');

  // ── Gawanya jina na extension ─────────────────────────────
  const dotIdx = filename.lastIndexOf('.');
  if (dotIdx === -1) {
    return res.status(400).json({ success: false, error: 'Jina la channel halisahihi. Mfano: azamsport1.mpd' });
  }

  const slug = filename.slice(0, dotIdx).toLowerCase();
  const ext  = filename.slice(dotIdx + 1).toLowerCase();

  // ── Angalia channel ipo ───────────────────────────────────
  const channel = CHANNEL_MAP[slug];
  if (!channel) {
    return res.status(404).json({ success: false, error: `Channel '${slug}' haipatikani.` });
  }

  // ── Thibitisha stream token ───────────────────────────────
  if (!token) {
    return res.status(401).json({ success: false, error: 'Stream token inahitajika. Omba kwenye POST /stream/token.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, STREAM_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Stream token imeisha. Omba token mpya.'
      : 'Stream token batili.';
    return res.status(401).json({ success: false, error: msg });
  }

  // ── Angalia plan ya mtumiaji ─────────────────────────────
  if (!planAllowed(decoded.plan, channel.plan)) {
    return res.status(403).json({
      success : false,
      error   : `Channel hii inahitaji plan ya '${channel.plan}'. Plan yako: '${decoded.plan}'.`,
    });
  }

  // ── Proxy request kwenda Azam CDN ────────────────────────
  try {
    const upstream = await axios.get(channel.url, {
      responseType : 'stream',
      timeout      : 20000,
      httpsAgent,
      headers      : {
        'User-Agent' : 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
        'Referer'    : 'https://www.azammax.com/',
        'Origin'     : 'https://www.azammax.com',
      },
      validateStatus: () => true,
    });

    if (upstream.status !== 200) {
      return res.status(502).json({
        success : false,
        error   : `Azam CDN ilirudisha ${upstream.status}. Jaribu tena baadaye.`,
      });
    }

    // ── Set Content-Type sahihi ───────────────────────────
    const contentType = ext === 'm3u8'
      ? 'application/vnd.apple.mpegurl'
      : 'application/dash+xml';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store');

    // ── Rewrite URLs ndani ya manifest (mpd/m3u8) ─────────
    // Badala ya kurudisha stream moja kwa moja, soma kwanza ili tuweze kubadilisha URLs
    let body = '';
    upstream.data.setEncoding('utf8');
    upstream.data.on('data', chunk => { body += chunk; });
    upstream.data.on('end', () => {
      if (ext === 'mpd') {
        // DASH: Segments zinahusu relative URLs — zibadilishe zielekezee Azam CDN moja kwa moja
        // (segments hazipiti proxy — ni kubwa sana, ingeua server)
        const azamBase = channel.url.replace(/\/[^/]+\.mpd.*$/, '/');
        body = body.replace(/(media|initialization|BaseURL)="(?!https?:\/\/|\/\/)([^"]+)"/g,
          (m, attr, path) => `${attr}="${azamBase}${path}"`);
        body = body.replace(/<BaseURL>(?!https?:\/\/)([^<]+)<\/BaseURL>/g,
          (m, path) => `<BaseURL>${azamBase}${path}</BaseURL>`);
      } else if (ext === 'm3u8') {
        // HLS: Rewrite segment URLs
        const azamBase = channel.url.replace(/\/[^/]+\.m3u8.*$/, '/');
        body = body.split('\n').map(line => {
          if (line.startsWith('#') || !line.trim()) return line;
          if (line.startsWith('http')) return line;
          return azamBase + line;
        }).join('\n');
      }

      res.end(body);
    });

    upstream.data.on('error', () => {
      if (!res.headersSent) {
        res.status(502).json({ success: false, error: 'Stream ilikatika. Jaribu tena.' });
      }
    });

  } catch (err) {
    console.error(`[stream] Proxy error kwa ${slug}:`, err.message);
    return res.status(502).json({ success: false, error: 'Imeshindwa kufikia stream. Jaribu tena.' });
  }
});

// ── OPTIONS (CORS preflight) ──────────────────────────────────
router.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.status(200).end();
});

module.exports = { router, CHANNEL_MAP };
