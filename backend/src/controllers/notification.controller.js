const { Notification } = require('../models');
const { success } = require('../utils/response');

// GET /api/notifications
// Dipanggil app mobile untuk mengisi panel lonceng di Dashboard (Gambar 3.24)
const getMine = async (req, res) => {
  const rows = await Notification.findAll({
    where: { user_id: req.user.id },
    order: [['created_at', 'DESC']],
    limit: 50,
  });
  return success(res, { data: rows });
};

// GET /api/notifications/unread-count
// Dipanggil ringan & sering (mis. tiap buka Dashboard) untuk badge lonceng,
// tanpa perlu narik seluruh daftar notifikasi.
const unreadCount = async (req, res) => {
  const count = await Notification.count({
    where: { user_id: req.user.id, is_read: false },
  });
  return success(res, { data: { count } });
};

// POST /api/notifications/read-all
// Dipanggil saat pegawai membuka panel notifikasi.
const markAllRead = async (req, res) => {
  await Notification.update(
    { is_read: true },
    { where: { user_id: req.user.id, is_read: false } }
  );
  return success(res, { message: 'Semua notifikasi ditandai sudah dibaca.' });
};

module.exports = { getMine, unreadCount, markAllRead };
