const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const ctrl = require('../controllers/adminAccount.controller');

// Seluruh endpoint manajemen akun Admin/Pimpinan hanya untuk Admin
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', asyncHandler(ctrl.getAll));
router.get('/:id', asyncHandler(ctrl.getById));
router.post('/', asyncHandler(ctrl.create));
router.put('/:id', asyncHandler(ctrl.update));
router.patch('/:id/status', asyncHandler(ctrl.setStatus));
router.post('/:id/reset-password', asyncHandler(ctrl.resetPassword));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
