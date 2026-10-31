const { Op } = require('sequelize');
const { PiketSchedule, User } = require('../models');
const { success, failure } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyUser } = require('../utils/notifier');
const { NOTIFICATION_TYPE } = require('../utils/constants');
const { parsePagination } = require('../utils/pagination');

// GET /api/piket?start=&end=&search=&page=&limit=
// `start`/`end` membatasi rentang tanggal (dipakai halaman Admin per hari).
// `search` menyaring nama pegawai (case-insensitive). Pagination opsional:
// tanpa `page`/`limit` (mobile app) seluruh baris dikembalikan tanpa meta,
// jadi perilaku lama & app mobile tidak berubah.
const getAll = async (req, res) => {
  const { start, end, search, page, limit } = req.query;
  const where = {};
  if (start && end) where.tanggal = { [Op.between]: [start, end] };

  const include = [
    {
      model: User,
      as: 'user',
      attributes: ['id', 'nip', 'name'],
      where: search ? { name: { [Op.iLike]: `%${search}%` } } : undefined,
    },
  ];

  const options = {
    where,
    include,
    order: [
      ['tanggal', 'ASC'],
      ['id', 'ASC'],
    ],
  };

  if (page !== undefined || limit !== undefined) {
    const { page: currentPage, limit: perPage, offset } = parsePagination(req.query, {
      defaultLimit: 10,
    });
    const { rows, count } = await PiketSchedule.findAndCountAll({
      ...options,
      limit: perPage,
      offset,
      distinct: true,
    });

    return success(res, {
      data: rows,
      meta: { total: count, page: currentPage, limit: perPage },
    });
  }

  const rows = await PiketSchedule.findAll(options);
  return success(res, { data: rows });
};

// GET /api/piket/me
const myPiket = async (req, res) => {
  const rows = await PiketSchedule.findAll({
    where: { user_id: req.user.id },
    order: [['tanggal', 'DESC']],
  });
  return success(res, { data: rows });
};

// POST /api/piket  (Admin assign - bisa banyak pegawai sekaligus)
// Body: { tanggal, userIds: [] }
const assign = async (req, res) => {
  const { tanggal, userIds } = req.body;

  if (!tanggal || !Array.isArray(userIds) || userIds.length === 0) {
    return failure(res, {
      statusCode: 422,
      message: 'tanggal dan userIds (array) wajib diisi.',
    });
  }

  const dayOfWeek = new Date(`${tanggal}T00:00:00`).getDay();
  if (dayOfWeek !== 6) {
    return failure(res, { statusCode: 422, message: 'Jadwal piket hanya berlaku untuk hari Sabtu.' });
  }

  // Validasi bentuk UUID lebih dulu supaya id sampah tidak berujung error 500
  // dari Postgres ("invalid input syntax for type uuid"), dan buang duplikat.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uniqueUserIds = [...new Set(userIds)];
  const invalidIds = uniqueUserIds.filter(
    (id) => typeof id !== 'string' || !UUID_RE.test(id)
  );
  if (invalidIds.length > 0) {
    return failure(res, {
      statusCode: 422,
      message: 'Daftar userIds berisi ID yang tidak valid.',
      errors: invalidIds.map((id) => ({
        field: 'userIds',
        message: `ID tidak valid: ${String(id)}`,
      })),
    });
  }

  // Dulu findOrCreate dipanggil di dalam loop → N+1 query (1 SELECT + 1 INSERT
  // per pegawai). Sekarang satu INSERT ... ON CONFLICT DO NOTHING (aman karena
  // ada unique index (user_id, tanggal)) lalu satu SELECT untuk baris lengkap.
  await PiketSchedule.bulkCreate(
    uniqueUserIds.map((userId) => ({
      user_id: userId,
      tanggal,
      assigned_by: req.user.id,
    })),
    { ignoreDuplicates: true }
  );

  const created = await PiketSchedule.findAll({
    where: { tanggal, user_id: { [Op.in]: uniqueUserIds } },
    order: [['id', 'ASC']],
  });

  await logActivity(
    req,
    'ASSIGN_PIKET',
    `Admin menetapkan jadwal piket tanggal ${tanggal} untuk ${uniqueUserIds.length} pegawai`
  );

  // Auto-notify pegawai yang BARU ditugaskan (belum notification_sent):
  // mengikuti skema assign -> konfirmasi -> push ke akun pegawai, admin
  // tidak perlu lagi menekan tombol "Kirim Notifikasi" satu per satu.
  // Push gagal tidak pernah menggagalkan request (notifyUser menangani
  // errornya sendiri); baris lama yang sudah terkirim tidak dikirim ulang.
  const newlyAssigned = created.filter((row) => !row.notification_sent);
  if (newlyAssigned.length > 0) {
    const tanggalFormatted = new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    // Dikerjakan tanpa menahan response; kegagalan individual ditangani di
    // notifyUser/pushToUser (fire-and-forget sesuai kontrak activityLogger).
    for (const row of newlyAssigned) {
      notifyUser({
        userId: row.user_id,
        type: NOTIFICATION_TYPE.PIKET,
        title: 'Jadwal Piket Sabtu',
        message: `Anda ditugaskan piket pada ${tanggalFormatted}. Mohon hadir sesuai jadwal.`,
        data: { piketScheduleId: row.id, tanggal: row.tanggal },
        sentBy: req.user.id,
      }).then(() => {
        row.notification_sent = true;
        return row.save();
      }).catch((err) => console.error('[piket] Gagal mengirim notifikasi piket:', err && err.message ? err.message : err));
    }
  }

  const notifiedCount = newlyAssigned.length;

  return success(res, {
    statusCode: 201,
    message:
      notifiedCount > 0
        ? `Jadwal piket berhasil ditetapkan. Notifikasi sedang dikirim ke ${notifiedCount} pegawai baru.`
        : 'Jadwal piket berhasil ditetapkan. Semua pegawai yang dipilih sudah menerima notifikasi sebelumnya.',
    data: created,
  });
};

// POST /api/piket/:id/notify  (Admin - tombol "Kirim Notifikasi")
// Membuat notifikasi in-app untuk pegawai bersangkutan dan menandai
// notification_sent = true. Ini yang membuat badge lonceng di Dashboard
// mobile menyala dan mengisi panel notifikasi (Gambar 3.24).
const notify = async (req, res) => {
  const row = await PiketSchedule.findByPk(req.params.id, {
    include: [{ model: User, as: 'user', attributes: ['id', 'nip', 'name'] }],
  });

  if (!row) {
    return failure(res, { statusCode: 404, message: 'Jadwal piket tidak ditemukan.' });
  }

  const tanggalFormatted = new Date(`${row.tanggal}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  await notifyUser({
    userId: row.user_id,
    type: NOTIFICATION_TYPE.PIKET,
    title: 'Jadwal Piket Sabtu',
    message: `Anda ditugaskan piket pada ${tanggalFormatted}. Mohon hadir sesuai jadwal.`,
    data: { piketScheduleId: row.id, tanggal: row.tanggal },
    sentBy: req.user.id,
  });

  row.notification_sent = true;
  await row.save();

  await logActivity(
    req,
    'NOTIFY_PIKET',
    `Admin mengirim notifikasi piket kepada ${row.user?.name ?? row.user_id}`
  );

  return success(res, {
    message: `Notifikasi piket berhasil dikirim ke ${row.user?.name ?? 'pegawai'}.`,
    data: row,
  });
};

// DELETE /api/piket/:id
const remove = async (req, res) => {
  const row = await PiketSchedule.findByPk(req.params.id);
  if (!row) return failure(res, { statusCode: 404, message: 'Jadwal piket tidak ditemukan.' });

  await row.destroy();
  await logActivity(req, 'REMOVE_PIKET', `Admin menghapus jadwal piket ID ${req.params.id}`);

  return success(res, { message: 'Jadwal piket berhasil dihapus.' });
};

module.exports = { getAll, myPiket, assign, notify, remove };
