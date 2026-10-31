const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const ctrl = require('../controllers/activityLog.controller');

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', asyncHandler(ctrl.getAll));

module.exports = router;
