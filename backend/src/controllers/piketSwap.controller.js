const { Op } = require('sequelize');
const { PiketSwap, PiketSchedule, User } = require('../models');
const { success, failure } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyUser } = require('../utils/notifier');
const { NOTIFICATION_TYPE, PIKET_SWAP_STATUS } = require('../utils/constants');

// Status yang berarti permintaan tukar masih berjalan (belum final).
const ACTIVE_STATUSES = [
  PIKET_SWAP_STATUS.MENUNGGU_PENGGANTI,
  PIKET_SWAP_STATUS.MENUNGGU_ADMIN,
];

const includePeople = [
  { model: User, as: 'requester', attributes: ['id', 'nip', 'name'] },
  { model: User, as: 'replacement', attributes: ['id', 'nip', 'name'] },
];

function formatTanggal(tanggal) {
  return new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// GET /api/piket/swaps?status=&start=&end=
// Menampilkan permintaan tukar untuk halaman Piket admin (filter per tanggal
// supaya sejalan dengan jadwal yang sedang ditampilkan).
const getAll = async (req, res) => {
  const { status, start, end } = req.query;
  const where = {};
  if (status) where.status = status;
  if (start && end) where.tanggal = { [Op.between]: [start, end] };

  const rows = await PiketSwap.findAll({
    where,
    include: includePeople,
    order: [['created_at', 'DESC']],
  });
  return success(res, { data: rows });
};

// POST /api/piket/:id/swap  (Admin mencatat permintaan tukar)
// Body: { replacementUserId }
// Tahap 1: status menunggu_pengganti - menunggu kesediaan pegawai pengganti
// yang dicatat Admin (sesuai kebijakan: pegawai hanya bicara lisan ke Admin).
const requestSwap = async (req, res) => {
  const { replacementUserId } = req.body;
  if (!replacementUserId) {
    return failure(res, {
      statusCode: 422,
      message: 'replacementUserId (pegawai pengganti) wajib diisi.',
    });
  }

  const schedule = await PiketSchedule.findByPk(req.params.id, {
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
  });
  if (!schedule) {
    return failure(res, {
      statusCode: 404,
      message: 'Jadwal piket tidak ditemukan.',
    });
  }

  if (replacementUserId === schedule.user_id) {
    return failure(res, {
      statusCode: 422,
      message: 'Pegawai pengganti tidak boleh sama dengan pegawai yang digantikan.',
    });
  }

  const replacement = await User.findOne({
    where: { id: replacementUserId, status: 'active' },
  });
  if (!replacement) {
    return failure(res, {
      statusCode: 404,
      message: 'Pegawai pengganti tidak ditemukan atau tidak aktif.',
    });
  }

  // Pengganti tidak boleh sudah punya jadwal piket pada tanggal yang sama.
  const clash = await PiketSchedule.findOne({
    where: { user_id: replacementUserId, tanggal: schedule.tanggal },
  });
  if (clash) {
    return failure(res, {
      statusCode: 409,
      message: `${replacement.name} sudah memiliki jadwal piket pada tanggal tersebut.`,
    });
  }

  const existing = await PiketSwap.findOne({
    where: {
      piket_schedule_id: schedule.id,
      status: { [Op.in]: ACTIVE_STATUSES },
    },
  });
  if (existing) {
    return failure(res, {
      statusCode: 409,
      message: 'Sudah ada permintaan tukar yang berjalan untuk jadwal ini.',
    });
  }

  const swap = await PiketSwap.create({
    piket_schedule_id: schedule.id,
    tanggal: schedule.tanggal,
    requester_user_id: schedule.user_id,
    replacement_user_id: replacementUserId,
    status: PIKET_SWAP_STATUS.MENUNGGU_PENGGANTI,
  });

  await logActivity(
    req,
    'AJUKAN_TUKAR_PIKET',
    `Admin mencatat permintaan tukar piket ${schedule.tanggal}: ` +
      `${schedule.user?.name ?? schedule.user_id} digantikan ${replacement.name}`
  );

  return success(res, {
    statusCode: 201,
    message:
      `Permintaan tukar piket dicatat. Catat kesediaan ${replacement.name} ` +
      'sebelum memberi keputusan akhir.',
    data: swap,
  });
};

// PUT /api/piket/swaps/:swapId/agree  (Admin mencatat kesediaan pengganti)
// Tahap 2: menunggu_pengganti -> menunggu_admin.
const markAgreed = async (req, res) => {
  const swap = await PiketSwap.findByPk(req.params.swapId, {
    include: includePeople,
  });
  if (!swap) {
    return failure(res, {
      statusCode: 404,
      message: 'Permintaan tukar tidak ditemukan.',
    });
  }
  if (swap.status !== PIKET_SWAP_STATUS.MENUNGGU_PENGGANTI) {
    return failure(res, {
      statusCode: 400,
      message: 'Permintaan tukar ini sudah melewati tahap kesediaan pengganti.',
    });
  }

  swap.status = PIKET_SWAP_STATUS.MENUNGGU_ADMIN;
  swap.agreed_at = new Date();
  await swap.save();

  await logActivity(
    req,
    'KESEDIAAN_TUKAR_PIKET',
    `Kesediaan ${swap.replacement?.name ?? 'pegawai pengganti'} menggantikan piket ${swap.tanggal} dicatat Admin`
  );

  return success(res, {
    message: 'Kesediaan pegawai pengganti dicatat. Menunggu keputusan Admin.',
    data: swap,
  });
};

// PUT /api/piket/swaps/:swapId/decision  (Keputusan akhir Admin)
// Body: { decision: 'approved'|'rejected', catatan }
// Tahap 3. Jika approved: jadwal dialihkan ke pengganti + notifikasi otomatis.
const decide = async (req, res) => {
  const { decision, catatan } = req.body;

  if (![PIKET_SWAP_STATUS.APPROVED, PIKET_SWAP_STATUS.REJECTED].includes(decision)) {
    return failure(res, {
      statusCode: 422,
      message: 'decision harus "approved" atau "rejected".',
    });
  }

  const swap = await PiketSwap.findByPk(req.params.swapId, {
    include: includePeople,
  });
  if (!swap) {
    return failure(res, {
      statusCode: 404,
      message: 'Permintaan tukar tidak ditemukan.',
    });
  }
  if (swap.status !== PIKET_SWAP_STATUS.MENUNGGU_ADMIN) {
    return failure(res, {
      statusCode: 400,
      message:
        'Kesediaan pegawai pengganti harus dicatat terlebih dahulu sebelum keputusan akhir.',
    });
  }

  if (decision === PIKET_SWAP_STATUS.APPROVED) {
    const schedule = await PiketSchedule.findByPk(swap.piket_schedule_id);
    if (!schedule) {
      return failure(res, {
        statusCode: 404,
        message: 'Jadwal piket asal tidak ditemukan.',
      });
    }

    const clash = await PiketSchedule.findOne({
      where: { user_id: swap.replacement_user_id, tanggal: swap.tanggal },
    });
    if (clash) {
      return failure(res, {
        statusCode: 409,
        message:
          'Pegawai pengganti sudah memiliki jadwal piket pada tanggal tersebut.',
      });
    }

    // Pindahkan jadwal: penugasan berpindah ke pegawai pengganti.
    schedule.user_id = swap.replacement_user_id;
    schedule.assigned_by = req.user.id;
    schedule.notification_sent = false;
    await schedule.save();

    const tanggalFormatted = formatTanggal(swap.tanggal);
    await notifyUser({
      userId: swap.replacement_user_id,
      type: NOTIFICATION_TYPE.PIKET,
      title: 'Jadwal Piket Sabtu',
      message: `Anda ditugaskan piket pada ${tanggalFormatted}${
        swap.requester?.name ? ` (menggantikan ${swap.requester.name})` : ''
      }. Mohon hadir sesuai jadwal.`,
      data: { piketScheduleId: schedule.id, tanggal: schedule.tanggal },
      sentBy: req.user.id,
    });
    await notifyUser({
      userId: swap.requester_user_id,
      type: NOTIFICATION_TYPE.PIKET,
      title: 'Jadwal Piket Dialihkan',
      message: `Jadwal piket Anda pada ${tanggalFormatted} telah dialihkan ke ${
        swap.replacement?.name ?? 'pegawai pengganti'
      }.`,
      data: { piketSwapId: swap.id, tanggal: swap.tanggal },
      sentBy: req.user.id,
    });

    schedule.notification_sent = true;
    await schedule.save();
  }

  swap.status = decision;
  swap.decided_by = req.user.id;
  swap.decided_at = new Date();
  swap.catatan = catatan || null;
  await swap.save();

  await logActivity(
    req,
    'KEPUTUSAN_TUKAR_PIKET',
    `Admin ${
      decision === PIKET_SWAP_STATUS.APPROVED ? 'menyetujui' : 'menolak'
    } tukar piket ${swap.tanggal}`
  );

  return success(res, {
    message:
      decision === PIKET_SWAP_STATUS.APPROVED
        ? 'Tukar piket disetujui. Jadwal telah dialihkan dan notifikasi dikirim ke kedua pegawai.'
        : 'Permintaan tukar piket ditolak.',
    data: swap,
  });
};

// DELETE /api/piket/swaps/:swapId  (batalkan permintaan yang masih berjalan)
const cancel = async (req, res) => {
  const swap = await PiketSwap.findByPk(req.params.swapId);
  if (!swap) {
    return failure(res, {
      statusCode: 404,
      message: 'Permintaan tukar tidak ditemukan.',
    });
  }
  if (!ACTIVE_STATUSES.includes(swap.status)) {
    return failure(res, {
      statusCode: 400,
      message: 'Hanya permintaan tukar yang masih berjalan yang dapat dibatalkan.',
    });
  }

  swap.status = PIKET_SWAP_STATUS.CANCELLED;
  await swap.save();

  await logActivity(
    req,
    'BATAL_TUKAR_PIKET',
    `Admin membatalkan permintaan tukar piket ${swap.tanggal}`
  );

  return success(res, { message: 'Permintaan tukar dibatalkan.', data: swap });
};

module.exports = { getAll, requestSwap, markAgreed, decide, cancel };
