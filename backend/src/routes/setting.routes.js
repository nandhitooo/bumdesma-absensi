const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const { ROLES } = require("../utils/constants");
const ctrl = require("../controllers/setting.controller");

router.use(authenticate);

router.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.PIMPINAN, ROLES.PEGAWAI),
  asyncHandler(ctrl.getSettings),
);
router.put("/", authorize(ROLES.ADMIN), asyncHandler(ctrl.updateSettings));
router.put(
  "/work-schedule/:dayType",
  authorize(ROLES.ADMIN),
  asyncHandler(ctrl.updateWorkSchedule),
);

router.get(
  "/qr-code",
  authorize(ROLES.ADMIN, ROLES.PIMPINAN),
  asyncHandler(ctrl.getActiveQrCode),
);
router.post(
  "/qr-code/generate",
  authorize(ROLES.ADMIN),
  asyncHandler(ctrl.generateQrCode),
);

module.exports = router;
