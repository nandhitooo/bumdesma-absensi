#!/usr/bin/env node
/**
 * Cek kesiapan push notification FCM TANPA mengirim push ke siapa pun.
 *
 * Jalankan: npm run push:check
 *
 * Yang diperiksa:
 *   1. GOOGLE_APPLICATION_CREDENTIALS terisi di .env dan file-nya ketemu.
 *   2. firebase-admin berhasil diinisialisasi (project id terbaca).
 *   3. Berapa perangkat (FCM token) yang sudah terdaftar di tabel push_tokens.
 *
 * Kalau langkah 2 gagal, push ke notif bar HP tidak akan pernah terkirim —
 * tapi notifikasi in-app di panel lonceng tetap normal.
 */
require('dotenv').config();

const fs = require('fs');

/** Token FCM itu rahasia; cukup tampilkan awalnya saja. */
function maskToken(token) {
  if (!token) return '(kosong)';
  return token.length <= 16 ? `${token.slice(0, 4)}…` : `${token.slice(0, 12)}…`;
}

async function main() {
  const pushService = require('../src/services/push.service');
  const { PushToken, User, sequelize } = require('../src/models');

  let ok = true;
  let credentialPath = null;

  // --- 1. File service account -------------------------------------------------
  credentialPath = pushService.resolveCredentialPath();
  if (!credentialPath) {
    console.log('❌ GOOGLE_APPLICATION_CREDENTIALS belum diisi di .env backend.');
    console.log(
      '   Isi dengan path relatif: GOOGLE_APPLICATION_CREDENTIALS=secrets/firebase-service-account.json'
    );
    console.log(
      '   Ambil file-nya dari Firebase Console → Project settings → Service accounts → Generate new private key.'
    );
    ok = false;
  } else if (!fs.existsSync(credentialPath)) {
    console.log(`❌ File service account tidak ditemukan: ${credentialPath}`);
    console.log('   Cek lagi nilai GOOGLE_APPLICATION_CREDENTIALS di .env backend.');
    ok = false;
  } else {
    console.log(`✅ File service account ditemukan: ${credentialPath}`);
  }

  // --- 2. Inisialisasi firebase-admin -----------------------------------------
  if (ok) {
    const ready = pushService.ensureInit();
    if (ready) {
      let projectId = '(tidak terbaca)';
      try {
        projectId = JSON.parse(fs.readFileSync(credentialPath, 'utf8')).project_id || projectId;
      } catch (_) {
        // Nama project hanya untuk tampilan; bukan penyebab kegagalan.
      }
      console.log(`✅ firebase-admin siap — project: ${projectId}`);

      // Buktikan kredensialnya benar-benar diterima Google, bukan sekadar
      // file JSON yang bisa dibaca. getAccessToken() melakukan panggilan
      // autentikasi nyata ke Google (tidak mengirim push ke siapa pun).
      const { getApps } = require('firebase-admin/app');
      const credential = getApps()[0] && getApps()[0].options.credential;
      if (credential && typeof credential.getAccessToken === 'function') {
        try {
          const { access_token: accessToken } = await credential.getAccessToken();
          console.log(
            `✅ Kredensial FCM diterima Google (akses ${accessToken ? 'berhasil diperoleh' : 'kosong'}).`
          );
        } catch (err) {
          console.log(`❌ Kredensial FCM ditolak Google: ${err.message}`);
          console.log('   Cek apakah service account masih aktif dan key-nya belum dihapus/dirotasi.');
          ok = false;
        }
      }
    } else {
      console.log('❌ firebase-admin gagal diinisialisasi (lihat warning [push] di atas).');
      ok = false;
    }
  }

  // --- 3. Token yang sudah terdaftar -------------------------------------------
  try {
    const rows = await PushToken.findAll({
      include: [{ model: User, as: 'user', attributes: ['nip', 'name'] }],
      order: [['created_at', 'DESC']],
    });

    if (rows.length === 0) {
      console.log('⚠️  Belum ada perangkat terdaftar di tabel push_tokens.');
      console.log(
        '   Login di app mobile (dengan izin notifikasi diizinkan) supaya POST /api/push/register membuat barisnya.'
      );
    } else {
      const users = new Set(rows.map((r) => r.user_id));
      console.log(`✅ ${rows.length} token terdaftar dari ${users.size} pegawai:`);
      rows.slice(0, 10).forEach((row) => {
        const who = row.user ? `${row.user.nip} — ${row.user.name}` : row.user_id;
        console.log(`   • ${who} (${row.platform}) ${maskToken(row.token)}`);
      });
      if (rows.length > 10) console.log(`   … dan ${rows.length - 10} token lainnya.`);
    }
  } catch (err) {
    console.log(`⚠️  Gagal membaca tabel push_tokens: ${err.message}`);
    console.log('   Pastikan PostgreSQL jalan dan `npm run db:migrate` sudah dijalankan.');
    ok = false;
  } finally {
    await sequelize.close();
  }

  console.log('');
  console.log(
    ok
      ? '🎉 Konfigurasi push siap. Push akan terkirim setiap ada notifikasi in-app baru.'
      : '⚠️  Perbaiki poin di atas dulu; selama ini notifikasi in-app tetap jalan.'
  );
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ push:check gagal:', err.message);
  process.exit(1);
});
