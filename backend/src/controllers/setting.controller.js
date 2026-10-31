const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { QrCode, WorkSchedule } = require('../models');
const { success, failure } = require('../utils/response');
const { getSettingsMap, setSetting } = require('../utils/settingsHelper');
const { logActivity } = require('../utils/activityLogger');

const QR_DIR = path.join(__dirname, '..', '..', 'uploads', 'qrcode');
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

// GET /api/settings  -> seluruh parameter sistem (radius, koordinat, jam kerja, libur)
const getSettings = async (req, res) => {
  const settings = await getSettingsMap();
  const schedules = await WorkSchedule.findAll({ order: [['day_type', 'ASC']] });
  return success(res, { data: { settings, workSchedules: schedules } });
};

// PUT /api/settings  (Admin - update parameter sistem)
// Body bebas berisi pasangan key-value, contoh:
// { office_latitude, office_longitude, geofence_radius_meters, national_holidays: [...] }
const updateSettings = async (req, res) => {
  const updatable = ['office_latitude', 'office_longitude', 'geofence_radius_meters', 'national_holidays'];
  const updates = {};

  for (const key of updatable) {
    if (req.body[key] !== undefined) {
      const value = key === 'national_holidays' ? JSON.stringify(req.body[key]) : req.body[key];
      await setSetting(key, value);
      updates[key] = req.body[key];
    }
  }

  await logActivity(req, 'UPDATE_SETTINGS', `Admin memperbarui parameter sistem: ${Object.keys(updates).join(', ')}`);

  return success(res, { message: 'Parameter sistem berhasil diperbarui.', data: updates });
};

// PUT /api/settings/work-schedule/:dayType  (Admin - update jam kerja/toleransi)
const updateWorkSchedule = async (req, res) => {
  const { dayType } = req.params;
  const { start_time, end_time, late_tolerance_minutes, is_active } = req.body;

  const schedule = await WorkSchedule.findOne({ where: { day_type: dayType } });
  if (!schedule) return failure(res, { statusCode: 404, message: 'Jadwal kerja tidak ditemukan.' });

  if (start_time !== undefined) schedule.start_time = start_time;
  if (end_time !== undefined) schedule.end_time = end_time;
  if (late_tolerance_minutes !== undefined) schedule.late_tolerance_minutes = late_tolerance_minutes;
  if (is_active !== undefined) schedule.is_active = is_active;
  await schedule.save();

  await logActivity(req, 'UPDATE_WORK_SCHEDULE', `Admin memperbarui jadwal kerja "${dayType}"`);

  return success(res, { message: 'Jadwal kerja berhasil diperbarui.', data: schedule });
};

// GET /api/settings/qr-code  -> QR Code statis yang sedang aktif
const getActiveQrCode = async (req, res) => {
  const qrCode = await QrCode.findOne({ where: { is_active: true }, order: [['generated_at', 'DESC']] });
  if (!qrCode) {
    return failure(res, { statusCode: 404, message: 'Belum ada QR Code yang di-generate.' });
  }
  return success(res, { data: qrCode });
};

// POST /api/settings/qr-code/generate  (Admin - generate/regenerasi QR Code statis)
// Menonaktifkan token lama (jika ada) lalu membuat token unik baru + gambar PNG-nya.
const generateQrCode = async (req, res) => {
  // Nonaktifkan seluruh QR Code sebelumnya - hanya satu token statis yang aktif pada satu waktu
  await QrCode.update({ is_active: false }, { where: { is_active: true } });

  const rawToken = `BUMDESMA-PODORUKUN-${uuidv4()}`;
  const token = crypto.createHash('sha256').update(rawToken).digest('hex');

  const fileName = `qr-absensi-${Date.now()}.png`;
  const filePath = path.join(QR_DIR, fileName);
  await QRCode.toFile(filePath, token, { errorCorrectionLevel: 'H', width: 512 });

  const qrCode = await QrCode.create({
    token,
    image_path: `/uploads/qrcode/${fileName}`,
    is_active: true,
    generated_by: req.user.id,
    generated_at: new Date(),
  });

  await logActivity(req, 'GENERATE_QR_CODE', 'Admin men-generate/regenerasi QR Code absensi statis');

  return success(res, {
    statusCode: 201,
    message: 'QR Code baru berhasil digenerate. QR Code lama otomatis dinonaktifkan.',
    data: qrCode,
  });
};

module.exports = {
  getSettings,
  updateSettings,
  updateWorkSchedule,
  getActiveQrCode,
  generateQrCode,
};
