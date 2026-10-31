const router = require('express').Router();

// Rate limit untuk endpoint auth didefinisikan di sini (sebelum dipasang ke
// router auth) supaya limiter berdiri sendiri di atas mount point /api/auth.
const rateLimit = require('express-rate-limit');

// Limiter longgar: refresh-token, change-password, dsb (pemakaian normal).
const generalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});

// Limiter ketat: login & lupa password - mencegah brute-force password/NIP.
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

// Wrapper: terapkan strict limiter hanya pada POST /login, /admin-login,
// /forgot-password di dalam router auth.
const strictLoginOnly = (req, res, next) => {
  const strictPaths = ['/login', '/admin-login', '/forgot-password'];
  if (req.method === 'POST' && strictPaths.includes(req.path)) {
    return strictAuthLimiter(req, res, next);
  }
  return next();
};

router.use('/auth', generalAuthLimiter, strictLoginOnly, require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/attendance', require('./attendance.routes'));
router.use('/leaves', require('./leave.routes'));
router.use('/piket', require('./piket.routes'));
router.use('/reports', require('./report.routes'));
router.use('/settings', require('./setting.routes'));
router.use('/activity-logs', require('./activityLog.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/push', require('./push.routes'));
router.use('/backup', require('./backup.routes'));

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sistem Manajemen Absensi Pegawai Berbasis QR Code - BUMDESMA Podo Rukun LKD API',
    version: '1.0.0',
  });
});

module.exports = router;
