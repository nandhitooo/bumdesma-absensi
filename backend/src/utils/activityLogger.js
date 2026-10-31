const { ActivityLog } = require('../models');
const { ROLES } = require('./constants');

/**
 * Mencatat aktivitas ke tabel activity_logs untuk kebutuhan audit trail.
 * Dipanggil "fire-and-forget" - kegagalan pencatatan log tidak boleh
 * menggagalkan request utama.
 *
 * Aktor ditentukan otomatis dari req.user/req.actorType (pegawai -> user_id,
 * admin/pimpinan -> admin_id). Untuk kasus sebelum autentikasi berhasil
 * (mis. percobaan login gagal), aktor bisa dioverride lewat parameter
 * `override`: { userId } atau { adminId }.
 */
async function logActivity(req, action, description = null, override = null) {
  try {
    let actorType = req?.actorType || null;
    let userId = override?.userId ?? null;
    let adminId = override?.adminId ?? null;

    if (!override) {
      if (actorType === ROLES.PEGAWAI) {
        userId = req?.user?.id || null;
      } else if (actorType) {
        adminId = req?.user?.id || null;
      }
    } else {
      actorType = userId ? ROLES.PEGAWAI : override?.adminId ? 'admin' : actorType;
    }

    await ActivityLog.create({
      user_id: userId,
      admin_id: adminId,
      actor_type: actorType,
      action,
      description,
      ip_address: req?.ip || req?.connection?.remoteAddress || null,
      user_agent: req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.error('[ActivityLog] Gagal mencatat log:', err.message);
  }
}

module.exports = { logActivity };
