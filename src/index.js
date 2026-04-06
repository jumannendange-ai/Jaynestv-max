require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { startKeepAlive } = require('./utils/keepAlive');

const channelsRoutes = require('./routes/channels');
const epgRoutes = require('./routes/epg');
const searchRoutes = require('./routes/search');
const updateRoutes = require('./routes/update');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: 'Ombi nyingi sana. Jaribu tena baadaye.' },
});
app.use('/api/', limiter);

app.use('/api/channels', channelsRoutes);
app.use('/api/epg', epgRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/update', updateRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'JAYNES MAX TV API',
    version: '2.0.0',
    time: new Date().toISOString(),
    uptime_s: Math.floor(process.uptime()),
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint haipatikani.' });
});

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, error: 'Hitilafu ya seva. Jaribu tena.' });
});

app.listen(PORT, () => {
  console.log(`✅ JAYNES MAX TV API v2 — port ${PORT}`);
  startKeepAlive();
});
