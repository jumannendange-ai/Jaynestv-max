// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/routes/subscription.js
//  Subscription na Malipo — MANUAL MODE
//
//  Mtumiaji anatuma pesa (M-Pesa/Tigo/Airtel) kisha anaweka
//  nambari ya uthibitisho. Admin anakagua na kuwasha subscription.
//
//  GET  /api/plans                    — plans zote na bei
//  GET  /api/sub/status               — hali ya subscription
//  POST /api/sub/initiate             — anza malipo (hupata maelekezo)
//  POST /api/sub/confirm              — mtumiaji anatuma proof ya malipo
//  GET  /api/sub/history              — historia ya payments za mtumiaji
//  GET  /api/sub/pending              — (admin) payments zinazosubiri
//  POST /api/sub/admin/verify         — (admin) thibitisha malipo
//  POST /api/sub/admin/reject         — (admin) kataa malipo
//  POST /api/sub/admin/grant          — (admin) weka subscription bila malipo
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const { supabaseRequest } = require('../utils/supabase');
const authMiddleware      = require('../middleware/auth');

const router = express.Router();

// ── Plans ─────────────────────────────────────────────────────
const PLANS = [
  {
    id            : 'basic',
    name          : 'Basic',
    emoji         : '🥉',
    price_monthly : 3000,
    price_yearly  : 30000,
    channels      : 80,
    max_devices   : 1,
    hd_quality    : false,
    sports_pack   : false,
    features      : ['Channels 80+', 'Ubora wa kawaida', 'Device 1', 'Trial siku 3'],
  },
  {
    id            : 'standard',
    name          : 'Standard',
    emoji         : '🥈',
    price_monthly : 5000,
    price_yearly  : 50000,
    channels      : 120,
    max_devices   : 2,
    hd_quality    : true,
    sports_pack   : true,
    popular       : true,
    features      : ['Channels 120+', 'HD Quality', 'Sports Pack', 'Devices 2', 'Trial siku 3'],
  },
  {
    id            : 'premium',
    name          : 'Premium',
    emoji         : '🥇',
    price_monthly : 9000,
    price_yearly  : 90000,
    channels      : 160,
    max_devices   : 4,
    hd_quality    : true,
    sports_pack   : true,
    features      : ['Channels 160+', 'HD Quality', 'Sports Pack', 'Devices 4', 'Trial siku 3', 'Msaada wa haraka'],
  },
];

// ── Nambari za malipo ─────────────────────────────────────────
const PAYMENT_NUMBERS = {
  vodacom : { name: 'M-Pesa (Vodacom)', number: process.env.MPESA_NUMBER  || '0744000000', tip: 'Ingiza PIN yako ya M-Pesa kuthibitisha' },
  tigo    : { name: 'Tigo Pesa',        number: process.env.TIGO_NUMBER   || '0655000000', tip: 'Ingiza PIN yako ya Tigo Pesa kuthibitisha' },
  airtel  : { name: 'Airtel Money',     number: process.env.AIRTEL_NUMBER || '0686000000', tip: 'Ingiza PIN yako ya Airtel Money kuthibitisha' },
  halo    : { name: 'Halo Pesa (TTCL)', number: process.env.HALO_NUMBER   || '0073000000', tip: 'Ingiza PIN yako ya Halo Pesa kuthibitisha' },
};

// ── Helpers ───────────────────────────────────────────────────
function isAdmin(req) {
  const emails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  return emails.includes(req.user?.email);
}

function calcSubEnd(plan, billingCycle = 'monthly') {
  const end = new Date();
  if (billingCycle === 'yearly') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setDate(end.getDate() + 30);
  }
  return end.toISOString();
}

function makeTxRef(userId) {
  const ts  = Date.now().toString(36).toUpperCase();
  const uid = userId.slice(0, 6).toUpperCase();
  return `JMTV-${uid}-${ts}`;
}

// ════════════════════════════════════════════════════════════════
//  GET /api/plans
// ════════════════════════════════════════════════════════════════
router.get('/', (_req, res) => {
  return res.json({
    success         : true,
    currency        : 'TZS',
    plans           : PLANS,
    payment_methods : Object.entries(PAYMENT_NUMBERS).map(([id, info]) => ({
      id,
      name  : info.name,
      number: info.number,
    })),
  });
});

// ════════════════════════════════════════════════════════════════
//  GET /api/sub/status
// ════════════════════════════════════════════════════════════════
router.get('/status', authMiddleware, async (req, res) => {
  const uid = req.user.user_id;

  const result = await supabaseRequest(
    `/profiles?id=eq.${uid}&select=plan,trial_end,sub_end`,
    'GET', null, true
  );

  if (!result.success || !result.data?.length) {
    return res.status(404).json({ success: false, error: 'Profile haipatikani.' });
  }

  const profile     = result.data[0];
  const now         = new Date();
  const subActive   = profile.sub_end   && new Date(profile.sub_end)   > now;
  const trialActive = profile.trial_end && new Date(profile.trial_end) > now;

  // Angalia malipo yanayosubiri
  const pendingRes = await supabaseRequest(
    `/payments?user_id=eq.${uid}&status=eq.pending_review&select=id,plan,amount,tx_ref,created_at&order=created_at.desc&limit=1`,
    'GET', null, true
  );

  return res.json({
    success          : true,
    status           : subActive ? 'active' : trialActive ? 'trial' : 'expired',
    plan             : profile.plan,
    sub_end          : profile.sub_end,
    trial_end        : profile.trial_end,
    days_left        : subActive
      ? Math.ceil((new Date(profile.sub_end)   - now) / 86400000)
      : trialActive
      ? Math.ceil((new Date(profile.trial_end) - now) / 86400000)
      : 0,
    pending_payment  : pendingRes.data?.[0] || null,
  });
});

// ════════════════════════════════════════════════════════════════
//  POST /api/sub/initiate
//  Body: { plan_id, method, billing_cycle? }
// ════════════════════════════════════════════════════════════════
router.post('/initiate', authMiddleware, async (req, res) => {
  const uid = req.user.user_id;
  const { plan_id, method = 'vodacom', billing_cycle = 'monthly' } = req.body;

  const plan = PLANS.find(p => p.id === plan_id);
  if (!plan) {
    return res.status(400).json({ success: false, error: 'Plan haipatikani.' });
  }

  const payMethod = PAYMENT_NUMBERS[method];
  if (!payMethod) {
    return res.status(400).json({
      success : false,
      error   : `Njia '${method}' haijulikani. Chagua: ${Object.keys(PAYMENT_NUMBERS).join(', ')}`,
    });
  }

  // Angalia malipo mengine yanayosubiri
  const existing = await supabaseRequest(
    `/payments?user_id=eq.${uid}&status=eq.pending_review&select=tx_ref`,
    'GET', null, true
  );
  if (existing.data?.length) {
    return res.status(409).json({
      success : false,
      error   : 'Una malipo yanayosubiri kukaguliwa. Subiri admin akagua kwanza.',
      tx_ref  : existing.data[0].tx_ref,
    });
  }

  const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const txRef  = makeTxRef(uid);

  // Hifadhi payment record
  await supabaseRequest('/payments', 'POST', {
    user_id      : uid,
    plan         : plan_id,
    amount,
    currency     : 'TZS',
    method,
    billing_cycle,
    tx_ref       : txRef,
    status       : 'initiated',
    provider_ref : null,
    created_at   : new Date().toISOString(),
  }, true);

  return res.json({
    success  : true,
    tx_ref   : txRef,
    plan     : plan.name,
    amount,
    currency : 'TZS',
    billing_cycle,

    instructions: {
      step1 : `Fungua ${payMethod.name} kwenye simu yako`,
      step2 : `Tuma TZS ${amount.toLocaleString()} kwa nambari: ${payMethod.number}`,
      step3 : `Tumia nambari hii kama kumbukumbu ya malipo: ${txRef}`,
      step4 : 'Baada ya kutuma, rudi hapa uweke nambari ya uthibitisho (transaction ID)',
      tip   : payMethod.tip,
    },

    payment_details : {
      method : payMethod.name,
      number : payMethod.number,
      amount : `TZS ${amount.toLocaleString()}`,
      ref    : txRef,
    },
  });
});

// ════════════════════════════════════════════════════════════════
//  POST /api/sub/confirm — mtumiaji anatuma proof ya malipo
//  Body: { tx_ref, proof_code }
//  proof_code = transaction ID kutoka M-Pesa/Tigo/Airtel SMS
// ════════════════════════════════════════════════════════════════
router.post('/confirm', authMiddleware, async (req, res) => {
  const uid = req.user.user_id;
  const { tx_ref, proof_code } = req.body;

  if (!tx_ref || !proof_code) {
    return res.status(400).json({ success: false, error: 'tx_ref na proof_code zinahitajika.' });
  }

  const payRes = await supabaseRequest(
    `/payments?tx_ref=eq.${tx_ref}&user_id=eq.${uid}&select=*`,
    'GET', null, true
  );

  if (!payRes.data?.length) {
    return res.status(404).json({ success: false, error: 'Malipo hayapatikani. Angalia tx_ref.' });
  }

  const payment = payRes.data[0];

  if (payment.status === 'success') {
    return res.json({ success: true, message: 'Malipo haya tayari yamekaguliwa.', already_verified: true });
  }

  if (payment.status === 'rejected') {
    return res.status(400).json({
      success : false,
      error   : 'Malipo haya yalikataliwa. Anzisha malipo mapya.',
      reason  : payment.reject_reason || null,
    });
  }

  // Sasisha → pending_review
  await supabaseRequest(
    `/payments?tx_ref=eq.${tx_ref}`,
    'PATCH',
    {
      status       : 'pending_review',
      provider_ref : proof_code.trim().toUpperCase(),
      updated_at   : new Date().toISOString(),
    },
    true
  );

  return res.json({
    success    : true,
    message    : '✅ Uthibitisho wako umepokewa! Admin atakagua na kuwasha subscription yako hivi karibuni (kawaida ndani ya dakika 30).',
    tx_ref,
    proof_code : proof_code.trim().toUpperCase(),
    status     : 'pending_review',
  });
});

// ════════════════════════════════════════════════════════════════
//  GET /api/sub/history — historia ya payments za mtumiaji
// ════════════════════════════════════════════════════════════════
router.get('/history', authMiddleware, async (req, res) => {
  const uid   = req.user.user_id;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  const result = await supabaseRequest(
    `/payments?user_id=eq.${uid}&select=id,plan,amount,currency,method,billing_cycle,tx_ref,provider_ref,status,reject_reason,created_at&order=created_at.desc&limit=${limit}`,
    'GET', null, true
  );

  return res.json({
    success  : true,
    count    : (result.data || []).length,
    payments : result.data || [],
  });
});

// ════════════════════════════════════════════════════════════════
//  GET /api/sub/pending — (admin) payments zinazosubiri ukaguzi
// ════════════════════════════════════════════════════════════════
router.get('/pending', authMiddleware, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Ruhusa ya admin inahitajika.' });
  }

  const result = await supabaseRequest(
    `/payments?status=eq.pending_review&select=id,user_id,plan,amount,currency,method,tx_ref,provider_ref,created_at&order=created_at.asc`,
    'GET', null, true
  );

  const payments = result.data || [];

  // Ongeza maelezo ya mtumiaji
  const enriched = await Promise.all(
    payments.map(async (p) => {
      const profileRes = await supabaseRequest(
        `/profiles?id=eq.${p.user_id}&select=email,full_name,phone`,
        'GET', null, true
      );
      return { ...p, user: profileRes.data?.[0] || { email: '?' } };
    })
  );

  return res.json({ success: true, count: enriched.length, payments: enriched });
});

// ════════════════════════════════════════════════════════════════
//  POST /api/sub/admin/verify — (admin) thibitisha malipo
//  Body: { tx_ref }
// ════════════════════════════════════════════════════════════════
router.post('/admin/verify', authMiddleware, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Ruhusa ya admin inahitajika.' });
  }

  const { tx_ref } = req.body;
  if (!tx_ref) {
    return res.status(400).json({ success: false, error: 'tx_ref inahitajika.' });
  }

  const payRes = await supabaseRequest(
    `/payments?tx_ref=eq.${tx_ref}&select=*`,
    'GET', null, true
  );

  if (!payRes.data?.length) {
    return res.status(404).json({ success: false, error: 'Malipo hayapatikani.' });
  }

  const payment = payRes.data[0];

  if (payment.status === 'success') {
    return res.json({ success: true, message: 'Malipo haya tayari yamekaguliwa.', already_done: true });
  }

  const subEnd = calcSubEnd(payment.plan, payment.billing_cycle || 'monthly');

  // Sasisha payment → success
  await supabaseRequest(
    `/payments?tx_ref=eq.${tx_ref}`,
    'PATCH',
    { status: 'success', updated_at: new Date().toISOString() },
    true
  );

  // Washa subscription
  await supabaseRequest(
    `/profiles?id=eq.${payment.user_id}`,
    'PATCH',
    { plan: payment.plan, sub_end: subEnd, updated_at: new Date().toISOString() },
    true
  );

  // Hifadhi kwenye subscriptions table
  await supabaseRequest('/subscriptions', 'POST', {
    user_id    : payment.user_id,
    plan       : payment.plan,
    start_date : new Date().toISOString(),
    end_date   : subEnd,
    is_active  : true,
    auto_renew : false,
    created_at : new Date().toISOString(),
  }, true);

  return res.json({
    success : true,
    message : `✅ Subscription ya '${payment.plan}' imewashwa.`,
    user_id : payment.user_id,
    plan    : payment.plan,
    sub_end : subEnd,
    tx_ref,
  });
});

// ════════════════════════════════════════════════════════════════
//  POST /api/sub/admin/reject — (admin) kataa malipo
//  Body: { tx_ref, reason? }
// ════════════════════════════════════════════════════════════════
router.post('/admin/reject', authMiddleware, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Ruhusa ya admin inahitajika.' });
  }

  const { tx_ref, reason } = req.body;
  if (!tx_ref) {
    return res.status(400).json({ success: false, error: 'tx_ref inahitajika.' });
  }

  await supabaseRequest(
    `/payments?tx_ref=eq.${tx_ref}`,
    'PATCH',
    {
      status        : 'rejected',
      reject_reason : reason || 'Malipo hayakuthibitishwa.',
      updated_at    : new Date().toISOString(),
    },
    true
  );

  return res.json({ success: true, message: 'Malipo yamekataliwa.', tx_ref });
});

// ════════════════════════════════════════════════════════════════
//  POST /api/sub/admin/grant — (admin) weka subscription bila malipo
//  Body: { user_id, plan, days?, billing_cycle? }
// ════════════════════════════════════════════════════════════════
router.post('/admin/grant', authMiddleware, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Ruhusa ya admin inahitajika.' });
  }

  const { user_id, plan, days, billing_cycle = 'monthly' } = req.body;

  if (!user_id || !plan) {
    return res.status(400).json({ success: false, error: 'user_id na plan zinahitajika.' });
  }

  let subEnd;
  if (days) {
    const end = new Date();
    end.setDate(end.getDate() + parseInt(days));
    subEnd = end.toISOString();
  } else {
    subEnd = calcSubEnd(plan, billing_cycle);
  }

  await supabaseRequest(
    `/profiles?id=eq.${user_id}`,
    'PATCH',
    { plan, sub_end: subEnd, updated_at: new Date().toISOString() },
    true
  );

  return res.json({
    success    : true,
    message    : `✅ Subscription ya '${plan}' imewekwa moja kwa moja.`,
    user_id,
    plan,
    sub_end    : subEnd,
    days_given : days || (billing_cycle === 'yearly' ? 365 : 30),
  });
});

module.exports = router;
