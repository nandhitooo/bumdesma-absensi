const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/push.controller');

// Semua endpoint push butuh sesi login (JWT Bearer dari app mobile).
router.use(authenticate);

// Dipanggil app saat login: mendaftarkan token FCM perangkat atas NIP yang login.
router.post('/register', asyncHandler(ctrl.register));
// Dipanggil app saat logout: melepas ikatan token <-> user.
router.post('/unregister', asyncHandler(ctrl.unregister));

module.exports = router;
