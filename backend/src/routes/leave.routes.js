const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { uploadSuratIzin } = require('../middlewares/upload.middleware');
const { ROLES } = require('../utils/constants');
const ctrl = require('../controllers/leave.controller');

router.use(authenticate);

router.post('/', authorize(ROLES.PEGAWAI), uploadSuratIzin.single('file'), asyncHandler(ctrl.create));
router.get('/me', authorize(ROLES.PEGAWAI), asyncHandler(ctrl.myLeaves));

router.get('/', authorize(ROLES.ADMIN, ROLES.PIMPINAN), asyncHandler(ctrl.getAll));
router.put('/:id/review', authorize(ROLES.ADMIN), asyncHandler(ctrl.review));
router.put('/:id/decision', authorize(ROLES.PIMPINAN), asyncHandler(ctrl.decide));

module.exports = router;
