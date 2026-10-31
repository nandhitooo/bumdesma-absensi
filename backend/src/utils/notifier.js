const { Notification } = require('../models');
const { pushToUser } = require('../services/push.service');

/**
 * Membuat satu notifikasi in-app untuk seorang pegawai. Notifikasi ini
 * yang dibaca oleh app mobile lewat GET /api/notifications dan ditampilkan
 * di panel lonceng Dashboard.
 *
 * Setelah baris in-app tersimpan, push FCM juga dikirim ke notif bar HP
 * pegawai (channel piket/izin_cuti — lihat services/push.service.js).
 * Push gagal tidak menggagalkan notifikasi in-app: pushToUser tidak pernah
 * throw.
 */
async function notifyUser({ userId, type, title, message, data = null, sentBy = null }) {
  const notification = await Notification.create({
    user_id: userId,
    type,
    title,
    message,
    data,
    sent_by: sentBy,
  });

  await pushToUser(userId, {
    title,
    message,
    type,
    notificationId: notification.id,
  });

  return notification;
}

/**
 * Membuat notifikasi yang sama untuk beberapa pegawai sekaligus,
 * lalu mengirim push FCM ke masing-masing penerima.
 */
async function notifyUsers({ userIds, type, title, message, data = null, sentBy = null }) {
  const rows = await Notification.bulkCreate(
    userIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      message,
      data,
      sent_by: sentBy,
    }))
  );

  // Push paralel; satu penerima gagal tidak menghentikan yang lain.
  await Promise.all(
    rows.map((notification) =>
      pushToUser(notification.user_id, {
        title,
        message,
        type,
        notificationId: notification.id,
      })
    )
  );

  return rows;
}

module.exports = { notifyUser, notifyUsers };
