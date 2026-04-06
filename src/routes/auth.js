// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/routes/auth.js
//  Authentication: Register · Login · Refresh · Reset Password
//
//  POST /api/auth/register         — usajili mpya
//  POST /api/auth/login            — ingia → JWT tokens
//  POST /api/auth/refresh          — refresh access token
//  POST /api/auth/reset-password   — omba reset ya nywila
//  GET  /api/auth/me               — maelezo ya mtumiaji (protected)
// ═══════════════════════════════════════════════════════════════

const express    = require('express');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const { supabaseAuth, supabaseRequest, supabaseAdminPost } = require('../utils/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET          = process.env.JWT_SECRET;
const JWT_EXPIRES_IN      = process.env.JWT_EXPIRES_IN      || '1h';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// ── Helper: tengeneza JWT tokens zote mbili ───────────────────
function makeTokens(user) {
  const payload = {
    user_id  : user.id,
    email    : user.email,
    plan     : user.plan     || 'trial',
    sub_end  : user.sub_end  || null,
    trial_end: user.trial_end || null,
  };

  const accessToken  = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ user_id: user.id }, JWT_SECRET + '_refresh', { expiresIn: JWT_REFRESH_EXPIRES });

  return { accessToken, refreshToken, payload };
}

// ── Helper: pata profile ya mtumiaji ─────────────────────────
async function getProfile(userId) {
  const res = await supabaseRequest(
    `/profiles?id=eq.${userId}&select=*`,
    'GET', null, true
  );
  return res.data?.[0] || null;
}

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/register
//  Body: { full_name, email, password, phone? }
// ════════════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
  const { full_name, email, password, phone } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'full_name, email, na password zinahitajika.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Nywila lazima iwe na herufi 6 au zaidi.',
    });
  }

  // ── Jisajili kwa Supabase Auth ────────────────────────────
  const authRes = await supabaseAuth('/signup', { email, password });

  if (!authRes.success) {
    const msg = authRes.data?.msg || authRes.data?.message || 'Usajili umeshindwa.';
    // Supabase hutoa 422 kama email tayari ipo
    const status = authRes.status === 422 ? 409 : 400;
    return res.status(status).json({ success: false, error: msg });
  }

  const userId = authRes.data?.user?.id;
  if (!userId) {
    return res.status(500).json({ success: false, error: 'Hitilafu ya seva wakati wa usajili.' });
  }

  // ── Unda profile — trial inaanza moja kwa moja ───────────
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 3); // siku 3 za trial

  await supabaseRequest('/profiles', 'POST', {
    id        : userId,
    email,
    full_name,
    phone     : phone || null,
    plan      : 'trial',
    trial_end : trialEnd.toISOString(),
    sub_end   : null,
    devices   : [],
    created_at: new Date().toISOString(),
  }, true);

  // ── Rejesha tokens ────────────────────────────────────────
  const profile = {
    id       : userId,
    email,
    plan     : 'trial',
    trial_end: trialEnd.toISOString(),
    sub_end  : null,
  };

  const { accessToken, refreshToken } = makeTokens(profile);

  return res.status(201).json({
    success       : true,
    message       : 'Umesajiliwa! Trial ya siku 3 imeanza.',
    access_token  : accessToken,
    refresh_token : refreshToken,
    expires_in    : 3600,
    user: {
      id        : userId,
      email,
      full_name,
      plan      : 'trial',
      trial_end : trialEnd.toISOString(),
    },
  });
});

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/login
//  Body: { email, password }
// ════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email na password zinahitajika.' });
  }

  // ── Login kwa Supabase Auth ───────────────────────────────
  const authRes = await supabaseAuth('/token?grant_type=password', { email, password });

  if (!authRes.success) {
    return res.status(401).json({ success: false, error: 'Email au nywila si sahihi.' });
  }

  const userId = authRes.data?.user?.id;
  if (!userId) {
    return res.status(500).json({ success: false, error: 'Hitilafu ya seva wakati wa kuingia.' });
  }

  // ── Pata profile na subscription status ──────────────────
  const profile = await getProfile(userId);

  if (!profile) {
    return res.status(404).json({ success: false, error: 'Profile haipatikani. Wasiliana na msaada.' });
  }

  // ── Angalia kama amezuiwa ─────────────────────────────────
  if (profile.is_banned) {
    return res.status(403).json({ success: false, error: 'Akaunti yako imezuiwa. Wasiliana na msaada.' });
  }

  // ── Tengeneza tokens ──────────────────────────────────────
  const { accessToken, refreshToken } = makeTokens(profile);

  const now          = new Date();
  const subActive    = profile.sub_end   && new Date(profile.sub_end)   > now;
  const trialActive  = profile.trial_end && new Date(profile.trial_end) > now;
  const subStatus    = subActive ? 'active' : trialActive ? 'trial' : 'expired';

  return res.json({
    success       : true,
    access_token  : accessToken,
    refresh_token : refreshToken,
    expires_in    : 3600,
    user: {
      id                  : profile.id,
      email               : profile.email,
      full_name           : profile.full_name,
      plan                : profile.plan,
      subscription_status : subStatus,
      trial_end           : profile.trial_end,
      sub_end             : profile.sub_end,
      days_left           : subActive
        ? Math.ceil((new Date(profile.sub_end)   - now) / 86400000)
        : trialActive
        ? Math.ceil((new Date(profile.trial_end) - now) / 86400000)
        : 0,
    },
  });
});

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/refresh
//  Body: { refresh_token }
// ════════════════════════════════════════════════════════════════
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ success: false, error: 'refresh_token inahitajika.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(refresh_token, JWT_SECRET + '_refresh');
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Refresh token imeisha. Ingia tena.'
      : 'Refresh token batili.';
    return res.status(401).json({ success: false, error: msg });
  }

  // ── Pata profile ya sasa ──────────────────────────────────
  const profile = await getProfile(decoded.user_id);
  if (!profile) {
    return res.status(404).json({ success: false, error: 'Mtumiaji haipatikani.' });
  }

  const { accessToken, refreshToken: newRefreshToken } = makeTokens(profile);

  return res.json({
    success       : true,
    access_token  : accessToken,
    refresh_token : newRefreshToken,
    expires_in    : 3600,
  });
});

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/reset-password
//  Body: { email }
// ════════════════════════════════════════════════════════════════
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email inahitajika.' });
  }

  // Supabase inatuma email ya reset — hatuwezi kusema ikiwa email ipo (security)
  await supabaseAdminPost('/recover', { email });

  return res.json({
    success : true,
    message : 'Kama email ipo, utapata barua pepe ya kubadilisha nywila.',
  });
});

// ════════════════════════════════════════════════════════════════
//  GET /api/auth/me — profile ya sasa (protected)
// ════════════════════════════════════════════════════════════════
router.get('/me', authMiddleware, async (req, res) => {
  const profile = await getProfile(req.user.user_id);

  if (!profile) {
    return res.status(404).json({ success: false, error: 'Profile haipatikani.' });
  }

  const now         = new Date();
  const subActive   = profile.sub_end   && new Date(profile.sub_end)   > now;
  const trialActive = profile.trial_end && new Date(profile.trial_end) > now;

  return res.json({
    success: true,
    user: {
      ...profile,
      subscription_status : subActive ? 'active' : trialActive ? 'trial' : 'expired',
      days_left           : subActive
        ? Math.ceil((new Date(profile.sub_end)   - now) / 86400000)
        : trialActive
        ? Math.ceil((new Date(profile.trial_end) - now) / 86400000)
        : 0,
    },
  });
});

module.exports = router;
