const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const router = express.Router();
const cache = new NodeCache({ stdTTL: 300 });

router.get('/', async (req, res) => {
  try {
    const cached = cache.get('channels');
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const { data } = await axios.get(process.env.CHANNELS_API_URL, {
      headers: { 'Authorization': `Bearer ${process.env.CHANNELS_API_KEY}` },
      timeout: 10000,
    });

    cache.set('channels', data);
    res.json({ success: true, data, cached: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
