const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const router = express.Router();
const cache = new NodeCache({ stdTTL: 600 });

router.get('/', async (req, res) => {
  const { channel } = req.query;
  const key = `epg_${channel || 'all'}`;
  const cached = cache.get(key);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  try {
    const url = channel
      ? `${process.env.EPG_API_URL}?channel=${channel}`
      : process.env.EPG_API_URL;

    const { data } = await axios.get(url, { timeout: 10000 });
    cache.set(key, data);
    res.json({ success: true, data, cached: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
