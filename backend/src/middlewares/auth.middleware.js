const { verifyAccessToken } = require('../utils/jwt');
const { failure } = require('../utils/response');
const { User, AdminAccount } = require('../models');
const { ROLES } = require('../utils/constants');

/**
 * Memverifikasi JWT pada header Authorization: Bearer <token> dan melampirkan
 * data pengguna (tanpa password) ke req.user.
 *
 * Token menyimpan `actorType`: 'pegawai' (akun di tabel users, login pakai
 * NIP dari app mobile) atau 'admin' (akun di tabel admin_accounts, login
 * pakai username dari Website - bisa berperan Admin atau Pimpinan).
 * req.user.role selalu tersedia untuk kebutuhan authorize(): 'pegawai'
 * untuk pegawai, atau nilai admin_accounts.role ('admin'/'pimpinan').
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return failure(res, {
        statusCode: 401,
        message: 'Token autentikasi tidak ditemukan. Silakan login terlebih dahulu.',
      });
    }

    const decoded = verifyAccessToken(token);

    if (decoded.actorType === 'admin') {
      const admin = await AdminAccount.findByPk(decoded.id);
      if (!admin || admin.status !== 'active') {
        return failure(res, {
          statusCode: 401,
          message: 'Akun tidak ditemukan atau sudah dinonaktifkan.',
        });
      }
      req.user = admin.toSafeJSON();
      req.actorType = admin.role; // 'admin' | 'pimpinan'
    } else {
      const user = await User.findByPk(decoded.id);
      if (!user || user.status !== 'active') {
        return failure(res, {
          statusCode: 401,
          message: 'Akun tidak ditemukan atau sudah dinonaktifkan.',
        });
      }
      req.user = { ...user.toSafeJSON(), role: ROLES.PEGAWAI };
      req.actorType = ROLES.PEGAWAI;
    }

    next();
  } catch (err) {
    return failure(res, {
      statusCode: 401,
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }
}

/**
 * Membatasi akses endpoint hanya untuk role tertentu.
 * Contoh: authorize('admin'), authorize('admin', 'pimpinan')
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return failure(res, { statusCode: 401, message: 'Belum terautentikasi.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return failure(res, {
        statusCode: 403,
        message: 'Anda tidak memiliki akses untuk melakukan aksi ini.',
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
