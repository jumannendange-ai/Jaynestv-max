// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/routes/profile.js
//  Profile ya mtumiaji, watch history, devices
//
//  GET   /api/profile              — profile kamili
//  PATCH /api/profile              — sasisisha jina/picha
//  GET   /api/profile/history      — channels ulizotazama
//  POST  /api/profile/history      — hifadhi watch event
//  GET   /api/profile/devices      — devices ulioingia
//  DELETE /api/profile/devices/:id — toa device
// ═══════════════════════════════════════════════════════════════

const express        = require('express');
const { supabaseRequest } = require('../utils/supabase');
const authMiddleware      = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/profile ──────────────────────────────────────────
router.get('/', async (req, res) => {
  const uid = req.user.user_id;

  const result = await supabaseRequest(
    `/profiles?id=eq.${uid}&select=*`,
    'GET', null, true
  );

  if (!result.success || !result.data?.length) {
    return res.status(404).json({ success: false, error: 'Profile haipatikani.' });
  }

  const profile = result.data[0];
  const now     = new Date();

  const trialActive = profile.trial_end && new Date(profile.trial_end) > now;
  const subActive   = profile.sub_end   && new Date(profile.sub_end)   > now;

  return res.json({
    success : true,
    profile : {
      ...profile,
      subscription_status : subActive ? 'active' : trialActive ? 'trial' : 'expired',
      days_left           : subActive
        ? Math.ceil((new Date(profile.sub_end) - now) / 86400000)
        : trialActive
        ? Math.ceil((new Date(profile.trial_end) - now) / 86400000)
        : 0,
    },
  });
});

// ── PATCH /api/profile ────────────────────────────────────────
router.patch('/', async (req, res) => {
  const uid = req.user.user_id;
  const allowed = ['full_name', 'phone', 'avatar_url'];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, error: 'Hakuna mabadiliko yaliyotolewa.' });
  }

  updates.updated_at = new Date().toISOString();

  const result = await supabaseRequest(
    `/profiles?id=eq.${uid}`,
    'PATCH', updates, true
  );

  if (!result.success) {
    return res.status(500).json({ success: false, error: 'Imeshindwa kusasisha profile.' });
  }

  return res.json({ success: true, message: 'Profile imesasishwa.' });
});

// ── GET /api/profile/history ──────────────────────────────────
router.get('/history', async (req, res) => {
  const uid   = req.user.user_id;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const result = await supabaseRequest(
    `/watch_history?user_id=eq.${uid}&select=*&order=last_watched.desc&limit=${limit}`,
    'GET', null, true
  );

  return res.json({
    success : true,
    count   : (result.data || []).length,
    history : result.data || [],
  });
});

// ── POST /api/profile/history — hifadhi watch event ──────────
router.post('/history', async (req, res) => {
  const uid              = req.user.user_id;
  const { channel_id, duration_seconds = 0 } = req.body;

  if (!channel_id) {
    return res.status(400).json({ success: false, error: 'channel_id inahitajika.' });
  }

  // Angalia kama ipo tayari — update badala ya insert
  const existing = await supabaseRequest(
    `/watch_history?user_id=eq.${uid}&channel_id=eq.${channel_id}&select=id,duration_seconds`,
    'GET', null, true
  );

  if (existing.data?.length) {
    const prev = existing.data[0];
    await supabaseRequest(
      `/watch_history?id=eq.${prev.id}`,
      'PATCH',
      {
        last_watched     : new Date().toISOString(),
        duration_seconds : (prev.duration_seconds || 0) + duration_seconds,
      },
      true
    );
  } else {
    await supabaseRequest('/watch_history', 'POST', {
      user_id          : uid,
      channel_id,
      last_watched     : new Date().toISOString(),
      duration_seconds,
    }, true);
  }

  return res.json({ success: true });
});

// ── GET /api/profile/devices ──────────────────────────────────
router.get('/devices', async (req, res) => {
  const uid = req.user.user_id;

  const result = await supabaseRequest(
    `/profiles?id=eq.${uid}&select=devices`,
    'GET', null, true
  );

  const devices = result.data?.[0]?.devices || [];
  return res.json({ success: true, devices });
});

// ── DELETE /api/profile/devices/:device_id ────────────────────
router.delete('/devices/:device_id', async (req, res) => {
  const uid       = req.user.user_id;
  const { device_id } = req.params;

  const profileRes = await supabaseRequest(
    `/profiles?id=eq.${uid}&select=devices`,
    'GET', null, true
  );

  const devices    = profileRes.data?.[0]?.devices || [];
  const newDevices = devices.filter(d => d.id !== device_id);

  await supabaseRequest(
    `/profiles?id=eq.${uid}`,
    'PATCH',
    { devices: newDevices },
    true
  );

  return res.json({ success: true, message: 'Device imeondolewa.' });
});

module.exports = router;
