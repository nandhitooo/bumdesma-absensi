const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const { ROLES } = require("../utils/constants");
const ctrl = require("../controllers/user.controller");

router.use(authenticate);

// Read-only: Admin & Pimpinan sama-sama boleh melihat daftar pegawai
// (dipakai halaman Absensi & Laporan untuk menampilkan seluruh pegawai,
// termasuk yang "Belum Absen").
router.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.PIMPINAN),
  asyncHandler(ctrl.getAll),
);
router.get(
  "/:id",
  authorize(ROLES.ADMIN, ROLES.PIMPINAN),
  asyncHandler(ctrl.getById),
);

// Mengubah data: khusus Admin
router.post("/", authorize(ROLES.ADMIN), asyncHandler(ctrl.create));
router.put("/:id", authorize(ROLES.ADMIN), asyncHandler(ctrl.update));
router.patch(
  "/:id/status",
  authorize(ROLES.ADMIN),
  asyncHandler(ctrl.setStatus),
);
router.post(
  "/:id/reset-password",
  authorize(ROLES.ADMIN),
  asyncHandler(ctrl.resetPassword),
);
router.delete("/:id", authorize(ROLES.ADMIN), asyncHandler(ctrl.remove));

module.exports = router;
