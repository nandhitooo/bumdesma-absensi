/**
 * Validasi konfigurasi environment saat boot.
 *
 * Tujuan: gagal cepat dan jelas saat start, bukan gagal misterius saat runtime.
 * Sebelum ini, kalau JWT_SECRET kosong, server tetap "berhasil" start — dan
 * baru meledak sebagai error 500 di request login pertama
 * (`secretOrPrivateKey must have a value`).
 *
 * Aturan:
 *   - Masalah fatal  -> throw, server tidak dijalankan.
 *   - Peringatan     -> console.warn, server tetap jalan.
 */
const REQUIRED_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const MIN_SECRET_LENGTH = 32;

function validateEnv() {
  const problems = [];
  const warnings = [];

  for (const key of REQUIRED_SECRETS) {
    const value = (process.env[key] || '').trim();
    if (!value) {
      problems.push(`${key} kosong — token JWT tidak bisa ditandatangani/diverifikasi.`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      warnings.push(
        `${key} hanya ${value.length} karakter; disarankan minimal ${MIN_SECRET_LENGTH} karakter acak.`
      );
    }
  }

  if (
    process.env.JWT_SECRET &&
    process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    problems.push(
      'JWT_SECRET dan JWT_REFRESH_SECRET harus berbeda — kalau sama, refresh token bisa dipakai sebagai access token.'
    );
  }

  if (!process.env.DB_NAME && !process.env.DATABASE_URL) {
    warnings.push('DB_NAME/DATABASE_URL tidak diisi — pastikan koneksi database memang diatur di tempat lain.');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CORS_ORIGINS) {
      warnings.push('CORS_ORIGINS belum diisi di production — semua origin akan diizinkan.');
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      warnings.push('GOOGLE_APPLICATION_CREDENTIALS belum diisi — push notification FCM akan dilewati.');
    }
  }

  warnings.forEach((warning) => console.warn(`[env] ${warning}`));

  if (problems.length > 0) {
    console.error('[env] Konfigurasi environment tidak valid:');
    problems.forEach((problem) => console.error(`  - ${problem}`));
    throw new Error(
      'Konfigurasi environment tidak lengkap. Perbaiki .env backend, lihat daftar di atas.'
    );
  }
}

module.exports = { validateEnv };
