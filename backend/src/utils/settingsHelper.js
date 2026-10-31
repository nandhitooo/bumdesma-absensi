const { SystemSetting } = require('../models');

/**
 * Cache in-memory untuk system_settings.
 *
 * getSettingsMap() dipanggil di jalur yang sangat panas: setiap absen
 * masuk/pulang (attendance.controller scan) dan setiap ekspor laporan.
 * Dulu itu berarti satu `SELECT * FROM system_settings` untuk tiap request,
 * padahal isinya sangat jarang berubah (radius geofence, jam kerja, dsb).
 * Cache TTL pendek memotong query berulang itu tanpa memaksa restart server
 * saat setting diubah: setSetting() langsung membatalkan cache, dan tulisan
 * langsung ke tabel akan ter-refresh paling lama dalam CACHE_TTL_MS.
 */
const CACHE_TTL_MS = 30 * 1000;

let cache = null; // { map, expiresAt }

/** Buang cache; dipakai setiap kali setting ditulis lewat aplikasi. */
function invalidateSettingsCache() {
  cache = null;
}

/**
 * Mengambil seluruh baris system_settings dan mengembalikannya sebagai object key-value.
 * Nilai numerik yang valid otomatis dikonversi ke Number agar mudah dipakai di logika bisnis.
 */
async function getSettingsMap() {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.map;
  }

  const rows = await SystemSetting.findAll();
  const map = {};
  for (const row of rows) {
    const asNumber = Number(row.value);
    map[row.key] = row.value !== null && !Number.isNaN(asNumber) && row.value.trim() !== ''
      ? asNumber
      : row.value;
  }

  cache = { map, expiresAt: Date.now() + CACHE_TTL_MS };
  return map;
}

async function getSetting(key, fallback = null) {
  const row = await SystemSetting.findOne({ where: { key } });
  return row ? row.value : fallback;
}

async function setSetting(key, value, description) {
  const [row] = await SystemSetting.findOrCreate({
    where: { key },
    defaults: { value: String(value), description },
  });
  row.value = String(value);
  if (description) row.description = description;
  await row.save();

  // Penting: tanpa ini perubahan setting baru terpakai setelah TTL habis.
  invalidateSettingsCache();

  return row;
}

module.exports = { getSettingsMap, getSetting, setSetting, invalidateSettingsCache };
