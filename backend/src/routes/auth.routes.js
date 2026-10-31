const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { authenticate } = require("../middlewares/auth.middleware");
const ctrl = require("../controllers/auth.controller");

router.post("/login", asyncHandler(ctrl.login));
router.post("/admin-login", asyncHandler(ctrl.adminLogin));
router.post("/refresh-token", asyncHandler(ctrl.refreshToken));
router.post(
  "/change-password",
  authenticate,
  asyncHandler(ctrl.changePassword),
);
router.post(
  "/change-username",
  authenticate,
  asyncHandler(ctrl.changeUsername),
);
router.post("/email", authenticate, asyncHandler(ctrl.updateEmail));
// Belum login (pegawai lupa password) -> TIDAK melewati authenticate.
router.post("/forgot-password", asyncHandler(ctrl.forgotPassword));
router.post("/reset-password", asyncHandler(ctrl.resetPassword));
router.get("/me", authenticate, asyncHandler(ctrl.me));
router.post("/logout", authenticate, asyncHandler(ctrl.logout));

module.exports = router;
