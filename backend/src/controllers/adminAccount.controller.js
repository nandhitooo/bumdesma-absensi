const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { AdminAccount } = require('../models');
const { success, failure } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activityLogger');
const { USER_STATUS } = require('../utils/constants');

// Controller ini khusus mengelola akun Admin & Pimpinan (tabel admin_accounts),
// terpisah dari data Pegawai (tabel users, dikelola lewat user.controller.js).
// Hanya Admin yang boleh mengakses (lihat adminAccount.routes.js).

// GET /api/admin-accounts?role=&status=&search=&page=&limit=
const getAll = async (req, res) => {
  const { role, status, search } = req.query;
  const { page, limit, offset } = parsePagination(req.query);
  const where = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { username: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { rows, count } = await AdminAccount.findAndCountAll({
    where,
    attributes: { exclude: ['password'] },
    order: [['name', 'ASC']],
    limit,
    offset,
  });

  return success(res, {
    data: rows,
    meta: { total: count, page, limit },
  });
};

// GET /api/admin-accounts/:id
const getById = async (req, res) => {
  const account = await AdminAccount.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
  if (!account) return failure(res, { statusCode: 404, message: 'Akun tidak ditemukan.' });
  return success(res, { data: account });
};

// POST /api/admin-accounts  (Admin menambah akun Admin/Pimpinan baru)
const create = async (req, res) => {
  const { username, name, role, temporaryPassword } = req.body;

  if (!username || !name || !role || !temporaryPassword) {
    return failure(res, {
      statusCode: 422,
      message: 'Username, nama, role, dan password sementara wajib diisi.',
    });
  }

  if (!AdminAccount.ROLES || !Object.values(AdminAccount.ROLES).includes(role)) {
    return failure(res, { statusCode: 422, message: "Role harus 'admin' atau 'pimpinan'." });
  }

  const existing = await AdminAccount.findOne({ where: { username } });
  if (existing) {
    return failure(res, { statusCode: 409, message: 'Username sudah terdaftar.' });
  }

  const hashed = await bcrypt.hash(temporaryPassword, 10);
  const account = await AdminAccount.create({
    username,
    name,
    role,
    password: hashed,
    is_first_login: true,
  });

  await logActivity(req, 'CREATE_ADMIN_ACCOUNT', `Admin menambahkan akun ${role} baru: ${name} (${username})`);

  return success(res, {
    statusCode: 201,
    message: 'Akun berhasil ditambahkan.',
    data: account.toSafeJSON(),
  });
};

// PUT /api/admin-accounts/:id
const update = async (req, res) => {
  const account = await AdminAccount.findByPk(req.params.id);
  if (!account) return failure(res, { statusCode: 404, message: 'Akun tidak ditemukan.' });

  const { name, role } = req.body;
  if (name !== undefined) account.name = name;
  if (role !== undefined && AdminAccount.ROLES && Object.values(AdminAccount.ROLES).includes(role)) {
    account.role = role;
  }

  await account.save();
  await logActivity(req, 'UPDATE_ADMIN_ACCOUNT', `Admin memperbarui akun: ${account.name}`);

  return success(res, { message: 'Akun berhasil diperbarui.', data: account.toSafeJSON() });
};

// PATCH /api/admin-accounts/:id/status  (aktif / nonaktif)
const setStatus = async (req, res) => {
  const { status } = req.body;
  if (!Object.values(USER_STATUS).includes(status)) {
    return failure(res, { statusCode: 422, message: 'Status tidak valid.' });
  }

  const account = await AdminAccount.findByPk(req.params.id);
  if (!account) return failure(res, { statusCode: 404, message: 'Akun tidak ditemukan.' });

  account.status = status;
  await account.save();

  await logActivity(req, 'SET_ADMIN_ACCOUNT_STATUS', `Status akun ${account.name} diubah menjadi ${status}`);

  return success(res, { message: 'Status akun berhasil diperbarui.', data: account.toSafeJSON() });
};

// POST /api/admin-accounts/:id/reset-password
const resetPassword = async (req, res) => {
  const { temporaryPassword } = req.body;
  if (!temporaryPassword || temporaryPassword.length < 6) {
    return failure(res, { statusCode: 422, message: 'Password sementara minimal 6 karakter.' });
  }

  const account = await AdminAccount.findByPk(req.params.id);
  if (!account) return failure(res, { statusCode: 404, message: 'Akun tidak ditemukan.' });

  account.password = await bcrypt.hash(temporaryPassword, 10);
  account.is_first_login = true;
  await account.save();

  await logActivity(req, 'RESET_ADMIN_ACCOUNT_PASSWORD', `Admin mereset password akun: ${account.name}`);

  return success(res, { message: 'Password akun berhasil direset.' });
};

// DELETE /api/admin-accounts/:id (soft delete)
const remove = async (req, res) => {
  const account = await AdminAccount.findByPk(req.params.id);
  if (!account) return failure(res, { statusCode: 404, message: 'Akun tidak ditemukan.' });

  await account.destroy(); // paranoid: true -> soft delete
  await logActivity(req, 'DELETE_ADMIN_ACCOUNT', `Admin menghapus akun: ${account.name}`);

  return success(res, { message: 'Akun berhasil dihapus.' });
};

module.exports = { getAll, getById, create, update, setStatus, resetPassword, remove };
