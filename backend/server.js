require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/models');
const { validateEnv } = require('./src/config/validateEnv');
const { runRotationTopUp } = require('./src/utils/piketRotation');

const PORT = process.env.PORT || 5000;

// Giliran (cycle) piket dibuat otomatis: server mengisi jadwal beberapa pekan
// ke depan secara berkala, jadi Admin tidak perlu menekan tombol generate.
// Interval bisa diatur lewat env untuk pengujian; default 6 jam.
const ROTATION_TOPUP_INTERVAL_MS =
  Number(process.env.PIKET_ROTATION_TOPUP_MS) || 6 * 60 * 60 * 1000;

async function runRotationTopUpSafely(label) {
  try {
    const result = await runRotationTopUp();
    if (result && !result.skipped) {
      console.log(
        `🔁 Giliran piket (${label}): ${result.created} jadwal baru, ${result.notified} notifikasi terkirim.`
      );
    }
  } catch (err) {
    // Kegagalan giliran tidak boleh menjatuhkan server.
    console.error(`⚠️  Gagal mengisi giliran piket (${label}):`, err && err.message ? err.message : err);
  }
}

async function start() {
  // Gagal cepat kalau konfigurasi wajib belum lengkap, dengan pesan yang
  // jelas — bukan error 500 misterius di request pertama.
  try {
    validateEnv();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log('✅ Koneksi database PostgreSQL berhasil.');

    app.listen(PORT, () => {
      console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
      console.log(`   API Base URL: http://localhost:${PORT}/api`);
    });

    // Isi jadwal giliran saat start, lalu berkala. Tidak melakukan apa pun
    // kalau fitur giliran dinonaktifkan (lihat settingsHelper/piketRotation).
    await runRotationTopUpSafely('startup');
    const rotationTimer = setInterval(
      () => runRotationTopUpSafely('berkala'),
      ROTATION_TOPUP_INTERVAL_MS
    );
    rotationTimer.unref && rotationTimer.unref();
  } catch (err) {
    console.error('❌ Gagal terkoneksi ke database:', err.message);
    process.exit(1);
  }
}

start();
