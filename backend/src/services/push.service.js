const fs = require('fs');
const path = require('path');
// firebase-admin v14 memakai API modular lewat subpath export. Di v14
// admin.apps / admin.credential / admin.messaging pada root SUDAH TIDAK ADA
// (semuanya undefined) — memakainya membuat push selalu gagal dengan
// TypeError yang tertelan try/catch di pushToUser, sehingga notif bar
// tidak pernah muncul tanpa error yang kelihatan.
const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { PushToken, User } = require('../models');

/**
 * Push notification FCM ke notif bar HP pegawai.
 *
 * Inisialisasi firebase-admin dibungkus try/catch: kalau kredensial service
 * account belum di-setup (mis. laptop dev tanpa GOOGLE_APPLICATION_CREDENTIALS),
 * server tetap hidup dan notifikasi in-app (tabel notifications) tetap jalan —
 * hanya push ke notif bar yang dilewati dengan warning sekali.
 */
let initWarned = false;

/**
 * Path file service account dari GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Nilai relatif di-resolve terhadap ROOT PROJECT, bukan cwd server, supaya
 * .env yang sama bisa dipakai di Windows maupun CachyOS. Path absolut seperti
 * C:\secrets\x.json atau /home/user/x.json tidak portable antar OS, jadi
 * sebaiknya selalu isi nilai relatif (mis. secrets/firebase-service-account.json).
 */
function resolveCredentialPath() {
  const raw = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.resolve(__dirname, '..', '..', raw);
}

function warnOnce(message) {
  if (initWarned) return;
  initWarned = true;
  console.warn(message);
}

function ensureInit() {
  if (getApps().length > 0) return true;
  try {
    const credentialPath = resolveCredentialPath();

    if (credentialPath) {
      if (!fs.existsSync(credentialPath)) {
        warnOnce(
          '[push] Firebase admin tidak terinisialisasi — push FCM dilewati.' +
            '\n       File service account tidak ditemukan: ' +
            credentialPath +
            '\n       Perbaiki GOOGLE_APPLICATION_CREDENTIALS di .env backend.'
        );
        return false;
      }
      // Pakai cert eksplisit: tidak bergantung pada cwd server saat start,
      // dan path relatif di .env otomatis portabel antar OS.
      initializeApp({ credential: cert(credentialPath) });
      return true;
    }

    // Tanpa env var: andalkan Application Default Credentials
    // (mis. metadata server saat dideploy di Cloud Run/GCP).
    initializeApp();
    return true;
  } catch (err) {
    warnOnce(
      '[push] Firebase admin tidak terinisialisasi — push FCM dilewati.' +
        '\n       Set GOOGLE_APPLICATION_CREDENTIALS di .env backend' +
        '\n       Error: ' +
        (err && err.message ? err.message : err)
    );
    return false;
  }
}

const TYPE_TO_CHANNEL = {
  piket: 'piket',
  izin_cuti: 'izin_cuti',
};

/**
 * Kirim push FCM ke seluruh perangkat milik satu pegawai (by user id),
 * lalu bersihkan token yang sudah tidak valid (app diuninstall dsb).
 *
 * @param {string} userId - UUID user penerima (tabel users.id)
 * @param {object} payload
 * @param {string} payload.title - Judul di notif bar
 * @param {string} payload.message - Isi notif
 * @param {'piket'|'izin_cuti'} [payload.type] - Menentukan channel Android
 * @param {string|number} [payload.notificationId] - ID baris notifikasi in-app
 * @returns {Promise<void>} Tidak pernah throw — push gagal tidak boleh
 *          menggagalkan alur bisnis (keputusan izin, kirim notif piket).
 */
async function pushToUser(userId, { title, message, type, notificationId }) {
  try {
    if (!ensureInit()) return;

    const rows = await PushToken.findAll({
      where: { user_id: userId },
      include: [{ model: User, as: 'user', attributes: ['id', 'nip', 'name'] }],
    });
    if (rows.length === 0) return;

    const channelId = TYPE_TO_CHANNEL[type] || 'izin_cuti';

    // "notification" payload -> otomatis ditampilkan OS saat app background/
    // terminated. "data" -> dibaca app untuk pilih channel & deeplink saat
    // foreground (FcmPushService.showRemoteMessage) dan jaring pengaman
    // background handler (firebaseMessagingBackgroundHandler).
    const messagePayload = {
      tokens: rows.map((r) => r.token),
      notification: { title, body: message },
      android: {
        priority: 'high',
        // Channel harus sama dengan yang dibuat app
        // (lib/services/fcm_push_service.dart).
        channel_id: channelId,
      },
      apns: {
        payload: { aps: { sound: 'default' } },
      },
      data: {
        type: type || '',
        notification_id: notificationId != null ? String(notificationId) : '',
      },
    };

    const res = await getMessaging().sendEachForMulticast(messagePayload);

    // Token invalid/expired -> hapus supaya tabel tidak menumpuk sampah.
    const invalid = res.responses
      .map((r, i) => (r.success ? null : rows[i].token))
      .filter(Boolean);
    if (invalid.length > 0) {
      await PushToken.destroy({ where: { token: invalid } });
    }
  } catch (err) {
    // Jangan pernah biarkan kegagalan push menggagalkan request utama
    // (decision izin, notify piket) yang sudah sukses tersimpan di DB.
    console.error('[push] Gagal mengirim FCM:', err && err.message ? err.message : err);
  }
}

// ensureInit & resolveCredentialPath diekspor untuk keperluan diagnostik
// (scripts/check-push.js / `npm run push:check`), bukan untuk dipanggil
// dari alur bisnis biasa.
module.exports = { pushToUser, ensureInit, resolveCredentialPath };
