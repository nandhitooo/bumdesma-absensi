const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const multer = require('multer');
const ctrl = require('../controllers/backup.controller');

// Upload restore pakai memoryStorage supaya buffer JSON bisa langsung
// di-parse; batas 20 MB jauh melampaui kebutuhan file backup ukuran wajar.
const uploadBackup = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Endpoint backup/restore hanya untuk Admin
router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/export', asyncHandler(ctrl.exportBackup));
router.get('/stats', asyncHandler(ctrl.backupStats));
router.post(
  '/restore',
  uploadBackup.single('file'),
  asyncHandler(ctrl.restoreBackup),
);

module.exports = router;
