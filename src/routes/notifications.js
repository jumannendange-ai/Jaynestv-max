const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/send', async (req, res) => {
  const { title, message, url } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Title na message zinahitajika.' });
  }

  try {
    const payload = {
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ['All'],
      headings: { en: title },
      contents: { en: message },
      url: url || undefined,
    };

    const { data } = await axios.post('https://onesignal.com/api/v1/notifications', payload, {
      headers: {
        'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
