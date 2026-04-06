// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/routes/nbc.js
//  NBC channels placeholder
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();

router.get('/', (_req, res) => {
  res.json({
    success  : true,
    message  : 'NBC routes zinaendelezwa.',
    channels : [],
  });
});

module.exports = router;
