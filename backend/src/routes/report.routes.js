const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const ctrl = require('../controllers/report.controller');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.PIMPINAN));

router.get('/summary', asyncHandler(ctrl.summary));
router.get('/attendance/export', asyncHandler(ctrl.exportAttendance));

module.exports = router;
