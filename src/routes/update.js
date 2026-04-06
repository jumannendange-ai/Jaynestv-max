const express = require('express');
const router = express.Router();

const LATEST = {
  version: '2.0.0',
  code: 2,
  url: process.env.APK_URL || '',
  notes: 'JAYNES MAX TV v2 — Toleo jipya',
  forced: false,
};

router.get('/', (req, res) => {
  const clientCode = parseInt(req.query.code || '0');
  res.json({
    success: true,
    update_available: clientCode < LATEST.code,
    latest: LATEST,
  });
});

module.exports = router;
