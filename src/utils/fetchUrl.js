// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/utils/fetchUrl.js
//  Shared HTTP helper (replaces PHP fetchUrl + cURL)
// ═══════════════════════════════════════════════════════════════

const axios = require('axios');

const DEFAULT_UA  = 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/112.0 Mobile Safari/537.36';
const DEFAULT_REF = 'https://bailatv.live/';
const TIMEOUT     = 15000;

/**
 * GET request — returns response body string or null on failure
 */
async function fetchUrl(url, options = {}) {
  try {
    const res = await axios.get(url, {
      timeout : options.timeout || TIMEOUT,
      headers : {
        'User-Agent' : options.ua      || DEFAULT_UA,
        'Referer'    : options.referer || DEFAULT_REF,
        'Accept'     : 'text/html,application/json,*/*',
        ...(options.headers || {}),
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      maxRedirects: 5,
      validateStatus: (s) => s < 500,
    });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch {
    return null;
  }
}

/**
 * POST request — returns parsed JSON or null on failure
 */
async function postJson(url, data, headers = {}) {
  try {
    const res = await axios.post(url, data, {
      timeout : TIMEOUT,
      headers : {
        'Content-Type' : 'application/json',
        'User-Agent'   : DEFAULT_UA,
        ...headers,
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      validateStatus: () => true,
    });
    return { status: res.status, data: res.data, headers: res.headers };
  } catch (err) {
    return { status: 0, data: null, headers: {}, error: err.message };
  }
}

/**
 * Toa streamUrl na clearKey kutoka HTML ya BailaTV
 */
function extractStreamData(html) {
  const streamMatch = html.match(/var\s+streamUrl\s*=\s*["']([^"']+)["']/);
  const keyMatch    = html.match(/var\s+clearKey\s*=\s*["']([^"']+)["']/);
  return {
    stream_url : streamMatch ? streamMatch[1].trim() : '',
    clear_key  : keyMatch    ? keyMatch[1].trim()    : '',
  };
}

module.exports = { fetchUrl, postJson, extractStreamData };
