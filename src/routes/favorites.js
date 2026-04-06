// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/routes/favorites.js
//  Channels za mtumiaji alizoweka favorite
//
//  GET    /api/favorites           — orodha ya favorites
//  POST   /api/favorites/add       — ongeza channel kwa favorites
//  DELETE /api/favorites/:channel_id — ondoa kutoka favorites
// ═══════════════════════════════════════════════════════════════

const express        = require('express');
const { supabaseRequest } = require('../utils/supabase');
const authMiddleware      = require('../middleware/auth');

const router = express.Router();

// Favorites zote zinahitaji login
router.use(authMiddleware);

// ── GET /api/favorites ────────────────────────────────────────
router.get('/', async (req, res) => {
  const uid = req.user.user_id;

  const result = await supabaseRequest(
    `/favorites?user_id=eq.${uid}&select=id,channel_id,created_at&order=created_at.desc`,
    'GET', null, true
  );

  if (!result.success) {
    return res.status(502).json({ success: false, error: 'Imeshindwa kupata favorites.' });
  }

  return res.json({
    success   : true,
    count     : (result.data || []).length,
    favorites : result.data || [],
  });
});

// ── POST /api/favorites/add ───────────────────────────────────
router.post('/add', async (req, res) => {
  const uid        = req.user.user_id;
  const { channel_id } = req.body;

  if (!channel_id) {
    return res.status(400).json({ success: false, error: 'channel_id inahitajika.' });
  }

  // Angalia kama tayari ipo
  const check = await supabaseRequest(
    `/favorites?user_id=eq.${uid}&channel_id=eq.${channel_id}&select=id`,
    'GET', null, true
  );

  if (check.data?.length) {
    return res.status(409).json({ success: false, error: 'Channel hii tayari ipo kwenye favorites.' });
  }

  const result = await supabaseRequest('/favorites', 'POST', {
    user_id    : uid,
    channel_id,
    created_at : new Date().toISOString(),
  }, true);

  if (!result.success) {
    return res.status(500).json({ success: false, error: 'Imeshindwa kuongeza favorite.' });
  }

  return res.status(201).json({ success: true, message: 'Imeongezwa kwa favorites.', favorite: result.data?.[0] || null });
});

// ── DELETE /api/favorites/:channel_id ────────────────────────
router.delete('/:channel_id', async (req, res) => {
  const uid        = req.user.user_id;
  const { channel_id } = req.params;

  const result = await supabaseRequest(
    `/favorites?user_id=eq.${uid}&channel_id=eq.${channel_id}`,
    'DELETE', null, true
  );

  if (!result.success) {
    return res.status(500).json({ success: false, error: 'Imeshindwa kuondoa favorite.' });
  }

  return res.json({ success: true, message: 'Imeondolewa kutoka favorites.' });
});

module.exports = router;
