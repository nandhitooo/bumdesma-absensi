const { success, failure } = require('../utils/response');
const { PushToken, User } = require('../models');

/**
 * POST /api/push/register
 * Body: { nip, token, platform? }
 * Dipanggil app mobile setelah login (FcmPushService.start) dan setiap kali
 * FCM me-rotate token (onTokenRefresh).
 *
 * NOTE: `nip` di body dipakai sebagai verifikasi silang saja — identitas
 * yang dipercaya adalah req.user dari JWT (lihat auth.middleware.js), dan
 * pegawai hanya boleh mendaftarkan token untuk dirinya sendiri.
 */
const register = async (req, res) => {
  const { nip, token, platform } = req.body || {};

  if (!token || typeof token !== 'string') {
    return failure(res, { statusCode: 400, message: 'Token FCM wajib diisi.' });
  }

  const user = await User.findOne({ where: { nip: nip || req.user.nip } });
  if (!user) {
    return failure(res, { statusCode: 404, message: 'Pegawai tidak ditemukan.' });
  }
  if (req.user.nip !== user.nip) {
    return failure(res, {
      statusCode: 403,
      message: 'Tidak berhak mendaftarkan token untuk NIP lain.',
    });
  }

  await PushToken.upsert(
    {
      user_id: user.id,
      token,
      platform: platform === 'ios' ? 'ios' : 'android',
    },
    {
      fields: ['user_id', 'token', 'platform'], // conflict target: (user_id, token)
    }
  );

  return success(res, { message: 'Token push terdaftar.' });
};

/**
 * POST /api/push/unregister
 * Body: { nip, token }
 * Dipanggil app mobile saat logout (FcmPushService.stop). Token dihapus
 * supaya push tidak lagi terkirim ke perangkat yang sudah logout.
 */
const unregister = async (req, res) => {
  const { token } = req.body || {};

  if (!token || typeof token !== 'string') {
    return failure(res, { statusCode: 400, message: 'Token FCM wajib diisi.' });
  }
  if (req.user.nip !== (req.body?.nip || req.user.nip)) {
    return failure(res, { statusCode: 403, message: 'Tidak berhak.' });
  }

  await PushToken.destroy({
    where: { user_id: req.user.id, token },
  });

  return success(res, { message: 'Token push dilepas.' });
};

module.exports = { register, unregister };
