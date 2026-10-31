const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { success, failure } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activityLogger');
const { USER_STATUS } = require('../utils/constants');

// GET /api/users?status=&search=&page=&limit=
// Selalu daftar pegawai (tabel users) - akun Admin/Pimpinan ada di
// admin_accounts, tidak dikelola lewat endpoint ini.
const getAll = async (req, res) => {
  const { status, search } = req.query;
  const { page, limit, offset } = parsePagination(req.query);
  const where = {};
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { nip: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
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

// GET /api/users/:id
const getById = async (req, res) => {
  const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
  if (!user) return failure(res, { statusCode: 404, message: 'Pegawai tidak ditemukan.' });
  return success(res, { data: user });
};

// POST /api/users  (Admin menambah pegawai baru + password sementara)
const create = async (req, res) => {
  const { nip, name, jabatan, phone, temporaryPassword } = req.body;

  if (!nip || !name || !temporaryPassword) {
    return failure(res, {
      statusCode: 422,
      message: 'NIP, nama, dan password sementara wajib diisi.',
    });
  }

  const existing = await User.findOne({ where: { nip } });
  if (existing) {
    return failure(res, { statusCode: 409, message: 'NIP sudah terdaftar.' });
  }

  const hashed = await bcrypt.hash(temporaryPassword, 10);
  const user = await User.create({
    nip,
    name,
    password: hashed,
    jabatan,
    phone,
    is_first_login: true,
  });

  await logActivity(req, 'CREATE_USER', `Admin menambahkan pegawai baru: ${name} (${nip})`);

  return success(res, {
    statusCode: 201,
    message: 'Pegawai berhasil ditambahkan.',
    data: user.toSafeJSON(),
  });
};

// PUT /api/users/:id
const update = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return failure(res, { statusCode: 404, message: 'Pegawai tidak ditemukan.' });

  const { name, jabatan, phone } = req.body;
  if (name !== undefined) user.name = name;
  if (jabatan !== undefined) user.jabatan = jabatan;
  if (phone !== undefined) user.phone = phone;

  await user.save();
  await logActivity(req, 'UPDATE_USER', `Admin memperbarui data pegawai: ${user.name}`);

  return success(res, { message: 'Data pegawai berhasil diperbarui.', data: user.toSafeJSON() });
};

// PATCH /api/users/:id/status  (aktif / nonaktif)
const setStatus = async (req, res) => {
  const { status } = req.body;
  if (!Object.values(USER_STATUS).includes(status)) {
    return failure(res, { statusCode: 422, message: 'Status tidak valid.' });
  }

  const user = await User.findByPk(req.params.id);
  if (!user) return failure(res, { statusCode: 404, message: 'Pegawai tidak ditemukan.' });

  user.status = status;
  await user.save();

  await logActivity(req, 'SET_USER_STATUS', `Status pegawai ${user.name} diubah menjadi ${status}`);

  return success(res, { message: 'Status pegawai berhasil diperbarui.', data: user.toSafeJSON() });
};

// POST /api/users/:id/reset-password  (Admin mengatur ulang password sementara)
const resetPassword = async (req, res) => {
  const { temporaryPassword } = req.body;
  if (!temporaryPassword || temporaryPassword.length < 6) {
    return failure(res, { statusCode: 422, message: 'Password sementara minimal 6 karakter.' });
  }

  const user = await User.findByPk(req.params.id);
  if (!user) return failure(res, { statusCode: 404, message: 'Pegawai tidak ditemukan.' });

  user.password = await bcrypt.hash(temporaryPassword, 10);
  user.is_first_login = true;
  await user.save();

  await logActivity(req, 'RESET_PASSWORD', `Admin mereset password pegawai: ${user.name}`);

  return success(res, { message: 'Password pegawai berhasil direset.' });
};

// DELETE /api/users/:id (soft delete)
const remove = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return failure(res, { statusCode: 404, message: 'Pegawai tidak ditemukan.' });

  await user.destroy(); // paranoid: true -> soft delete
  await logActivity(req, 'DELETE_USER', `Admin menghapus data pegawai: ${user.name}`);

  return success(res, { message: 'Pegawai berhasil dihapus.' });
};

module.exports = { getAll, getById, create, update, setStatus, resetPassword, remove };
