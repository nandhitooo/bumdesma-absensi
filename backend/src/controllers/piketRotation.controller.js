const { success, failure } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const rotation = require('../utils/piketRotation');

// Endpoint untuk fitur giliran (cycle) piket Sabtu.
// Konfigurasi + anggota disimpan lewat utils/piketRotation.js.

function failFromError(res, err) {
  if (err instanceof rotation.RotationError) {
    return failure(res, { statusCode: err.statusCode, message: err.message });
  }
  // Error tak terduga diteruskan ke error middleware lewat asyncHandler.
  throw err;
}

// GET /api/piket/rotation  (Admin, Pimpinan)
// Konfigurasi + daftar anggota + pratinjau giliran beberapa pekan ke depan.
const getRotation = async (req, res) => {
  const state = await rotation.previewRotation({});
  return success(res, { data: state });
};

// PUT /api/piket/rotation  (Admin)
// Body: { enabled?, start?, perSabtu?, weeksAhead? } — hanya field yang dikirim
// yang diubah.
const updateRotation = async (req, res) => {
  const { enabled, start, perSabtu, weeksAhead } = req.body || {};
  try {
    const config = await rotation.saveRotationConfig({ enabled, start, perSabtu, weeksAhead });
    await logActivity(req, 'UPDATE_GILIRAN_PIKET', 'Admin memperbarui pengaturan giliran piket');
    return success(res, { message: 'Pengaturan giliran piket disimpan.', data: config });
  } catch (err) {
    return failFromError(res, err);
  }
};

// PUT /api/piket/rotation/members  (Admin)
// Body: { userIds: [...] } — urutan array = urutan giliran.
const replaceMembers = async (req, res) => {
  const { userIds } = req.body || {};
  try {
    const members = await rotation.setMembers(userIds);
    await logActivity(
      req,
      'SET_GILIRAN_PIKET',
      `Admin menetapkan ${members.length} pegawai pada daftar giliran piket`
    );
    return success(res, { message: 'Daftar pegawai giliran disimpan.', data: members });
  } catch (err) {
    return failFromError(res, err);
  }
};

// POST /api/piket/rotation/generate  (Admin)
// Body opsional: { sampai: 'YYYY-MM-DD' } (Sabtu). Tanpa `sampai`, memakai
// `weeksAhead` dari pengaturan. Baris lama tidak tertimpa.
const generateRotation = async (req, res) => {
  const { sampai } = req.body || {};
  try {
    const result = await rotation.generateRotation({ sampai, actorId: req.user.id });
    await logActivity(
      req,
      'GENERATE_GILIRAN_PIKET',
      `Admin membuat jadwal giliran piket sampai ${result.saturdays.length > 0 ? result.saturdays[result.saturdays.length - 1].tanggal : '-'}`
    );
    return success(res, {
      statusCode: 201,
      message:
        result.created > 0
          ? `Jadwal giliran dibuat: ${result.created} jadwal baru, notifikasi dikirim ke ${result.notified} pegawai.`
          : 'Tidak ada jadwal baru — semua Sabtu pada rentang ini sudah ada.',
      data: result,
    });
  } catch (err) {
    return failFromError(res, err);
  }
};

module.exports = {
  getRotation,
  updateRotation,
  replaceMembers,
  generateRotation,
};
