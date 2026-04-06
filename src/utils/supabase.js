// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/utils/supabase.js
//  Supabase REST API helper
// ═══════════════════════════════════════════════════════════════

const axios = require('axios');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_KEY         = process.env.SUPABASE_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function headers(useServiceKey = false) {
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_KEY;
  return {
    'apikey'        : key,
    'Authorization' : `Bearer ${key}`,
    'Content-Type'  : 'application/json',
    'Prefer'        : 'return=representation',
  };
}

async function supabaseRequest(path, method = 'GET', body = null, useServiceKey = false) {
  try {
    const res = await axios({
      method,
      url     : `${SUPABASE_URL}/rest/v1${path}`,
      headers : headers(useServiceKey),
      data    : body || undefined,
      validateStatus: () => true,
    });
    return { success: res.status < 300, status: res.status, data: res.data };
  } catch (err) {
    return { success: false, status: 0, data: null, error: err.message };
  }
}

async function supabaseAuth(path, body) {
  try {
    const res = await axios.post(
      `${SUPABASE_URL}/auth/v1${path}`,
      body,
      { headers: headers(false), validateStatus: () => true }
    );
    return { success: res.status < 300, status: res.status, data: res.data };
  } catch (err) {
    return { success: false, status: 0, data: null, error: err.message };
  }
}

async function supabaseAdminPost(path, body) {
  try {
    const res = await axios.post(
      `${SUPABASE_URL}/auth/v1${path}`,
      body,
      {
        headers: {
          'apikey'        : SUPABASE_SERVICE_KEY,
          'Authorization' : `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type'  : 'application/json',
        },
        validateStatus: () => true,
      }
    );
    return { success: res.status < 300, status: res.status, data: res.data };
  } catch (err) {
    return { success: false, status: 0, data: null, error: err.message };
  }
}

module.exports = { supabaseRequest, supabaseAuth, supabaseAdminPost };
