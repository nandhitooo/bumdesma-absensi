const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/notification.controller');

router.use(authenticate);

router.get('/', asyncHandler(ctrl.getMine));
router.get('/unread-count', asyncHandler(ctrl.unreadCount));
router.post('/read-all', asyncHandler(ctrl.markAllRead));

module.exports = router;
