const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Tafuta neno.' });

  try {
    const { data } = await axios.get(process.env.CHANNELS_API_URL, {
      headers: { 'Authorization': `Bearer ${process.env.CHANNELS_API_KEY}` },
      timeout: 10000,
    });

    const results = (data || []).filter(ch =>
      ch.name?.toLowerCase().includes(q.toLowerCase())
    );

    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
