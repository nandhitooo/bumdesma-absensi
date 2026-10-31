const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');
const { success, failure } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { invalidateSettingsCache } = require('../utils/settingsHelper');

// Nama tabel fisik yang ikut di-backup, urut mengikuti ketergantungan FK
// (parent dulu) supaya restore bisa langsung jalan secara berurutan.
// `piket_swaps` WAJIB ada di sini: FK-nya ke piket_schedules/users bersifat
// ON DELETE CASCADE, jadi tanpa barisnya restore akan menghapus swap lewat
// cascade tanpa pernah mengembalikannya (data tukar jadwal hilang diam-diam).
const BACKUP_TABLES = [
  'admin_accounts',
  'users',
  'work_schedules',
  'system_settings',
  'qr_codes',
  'attendances',
  'leaves',
  'piket_schedules',
  'piket_swaps',
  'notifications',
  'push_tokens',
  'activity_logs',
];

// Penanda format file backup. Restore memakainya untuk memastikan file berasal
// dari skema yang kompatibel, dan supaya perubahan format di masa depan bisa
// dideteksi alih-alih ditebak dari bentuk datanya.
const BACKUP_FORMAT = 'bumdesma-absensi-backup';
// v2 = menyertakan tabel `piket_swaps` dan men-serialisasi kolom JSONB.
// File lama (v1 / tanpa penanda) tetap bisa dibaca; tabel yang tidak ada di
// dalam file tidak akan disentuh saat restore.
const BACKUP_FORMAT_VERSION = 2;

// GET /api/backup/export  (Admin - unduh backup JSON seluruh data)
// Mengembalikan file JSON berisi seluruh isi tabel (termasuk password hash,
// karena ini backup penuh untuk pemulihan bencana). File cukup sensitif:
// hanya Admin yang boleh mengunduh.
const exportBackup = async (req, res) => {
  const backup = {
    meta: {
      app: 'BUMDESMA Podo Rukun LKD - Sistem Absensi',
      format: BACKUP_FORMAT,
      version: BACKUP_FORMAT_VERSION,
      generated_at: new Date().toISOString(),
      generated_by: req.user?.name || 'unknown',
      tables: BACKUP_TABLES,
    },
    data: {},
  };

  try {
    for (const table of BACKUP_TABLES) {
      const [rows] = await sequelize.query(`SELECT * FROM "${table}"`);
      backup.data[table] = rows;
    }
  } catch (err) {
    return failure(res, {
      statusCode: 500,
      message: `Gagal membaca tabel untuk backup: ${err.message}`,
    });
  }

  await logActivity(req, 'EXPORT_BACKUP', 'Admin mengunduh backup data sistem');

  const fileName = `backup-bumdesma-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fileName}"`,
  );
  return res.status(200).send(JSON.stringify(backup, null, 2));
};

// POST /api/backup/restore  (Admin - pulihkan data dari file backup JSON)
// PROSES DESTRUKTIF: seluruh baris pada tabel tujuan DIHAPUS dulu, lalu
// diisi ulang dari isi file. Semuanya berjalan dalam satu transaksi - kalau
// ada kegagalan di tengah jalan, database kembali ke kondisi semula.
// Wajib mengirim field `confirm` bernilai "RESTORE" sebagai konfirmasi
// eksplisit dari user, selain sudah dilindungi authorize(ADMIN) di route.
const RESTORE_CONFIRM_TEXT = 'RESTORE';

// Kolom bertipe JSON/JSONB dikembalikan oleh `sequelize.query('SELECT * ...')`
// sebagai object JS (mis. notifications.data -> { piketScheduleId, tanggal }),
// tetapi queryInterface.bulkInsert() meng-escape nilai mentah lewat
// SqlString.escape() yang tidak mengenal object dan melempar:
//   Invalid value { tanggal: ..., piketScheduleId: ... }
// Akibatnya seluruh transaksi restore rollback. Serialisasi nilai kolom JSON ke
// string dulu supaya Postgres menerimanya sebagai literal untuk tipe jsonb.
async function jsonColumnsFor(queryInterface, table, transaction) {
  const description = await queryInterface.describeTable(table, { transaction });
  return Object.entries(description)
    .filter(
      ([, def]) =>
        typeof def.type === 'string' && def.type.toUpperCase().includes('JSON'),
    )
    .map(([column]) => column);
}

function serializeJsonColumns(row, columns) {
  const copy = { ...row };
  for (const column of columns) {
    const value = copy[column];
    if (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      !Buffer.isBuffer(value)
    ) {
      copy[column] = JSON.stringify(value);
    }
  }
  return copy;
}

const restoreBackup = async (req, res) => {
  // req.file diisi multer (memoryStorage) dari route.
  if (!req.file || !req.file.buffer) {
    return failure(res, {
      statusCode: 422,
      message: 'File backup JSON wajib diunggah.',
    });
  }

  if ((req.body?.confirm || '').trim().toUpperCase() !== RESTORE_CONFIRM_TEXT) {
    return failure(res, {
      statusCode: 422,
      message: `Konfirmasi wajib diisi dengan teks "${RESTORE_CONFIRM_TEXT}" untuk melakukan restore.`,
    });
  }

  let backup;
  try {
    backup = JSON.parse(req.file.buffer.toString('utf8'));
  } catch {
    return failure(res, {
      statusCode: 422,
      message: 'File bukan JSON yang valid.',
    });
  }

  if (!backup || backup.meta == null || typeof backup.data !== 'object' || backup.data == null) {
    return failure(res, {
      statusCode: 422,
      message: 'Struktur file backup tidak dikenali (butuh bagian meta & data).',
    });
  }

  const unknownTables = Object.keys(backup.data).filter(
    (t) => !BACKUP_TABLES.includes(t),
  );
  if (unknownTables.length > 0) {
    return failure(res, {
      statusCode: 422,
      message: `File backup memuat tabel yang tidak dikenal: ${unknownTables.join(', ')}.`,
    });
  }

  // `format` absen = file lama (sebelum penanda format ada) -> tetap diterima.
  if (backup.meta.format != null && backup.meta.format !== BACKUP_FORMAT) {
    return failure(res, {
      statusCode: 422,
      message: `Format file backup tidak dikenali: ${backup.meta.format}.`,
    });
  }

  const fileVersion = Number(backup.meta.version);
  if (Number.isFinite(fileVersion) && fileVersion > BACKUP_FORMAT_VERSION) {
    return failure(res, {
      statusCode: 422,
      message: `File backup dibuat oleh versi aplikasi yang lebih baru (v${fileVersion} > v${BACKUP_FORMAT_VERSION}). Perbarui aplikasi sebelum restore.`,
    });
  }

  // Sebuah file backup hanya mengganti tabel yang memang dibawanya. Tabel yang
  // tidak ada di file (mis. backup lama yang belum memuat `piket_swaps`) TIDAK
  // dihapus, supaya restore file lama tidak mengosongkan data yang tidak ada di
  // dalamnya. Tabel yang dikirim eksplisit sebagai [] tetap dikosongkan.
  const tablesInFile = BACKUP_TABLES.filter((t) => Array.isArray(backup.data[t]));
  const missingTables = BACKUP_TABLES.filter((t) => !Array.isArray(backup.data[t]));

  const restoredCounts = {};
  for (const table of missingTables) restoredCounts[table] = 0;

  try {
    await sequelize.transaction(async (t) => {
      const queryInterface = sequelize.getQueryInterface();

      // Hapus baris hanya pada tabel yang ada di file (anak dulu, induk
      // belakang) supaya FK tidak menghentikan proses. TRUNCATE ... CASCADE
      // juga bisa, tapi DELETE memberi perilaku yang sama di dalam transaksi
      // dan lebih aman terhadap tabel yang mungkin punya trigger.
      for (const table of [...tablesInFile].reverse()) {
        await sequelize.query(`DELETE FROM "${table}"`, { transaction: t });
      }

      // Isi ulang: induk dulu sesuai urutan BACKUP_TABLES.
      for (const table of tablesInFile) {
        const rows = backup.data[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          restoredCounts[table] = 0;
          continue;
        }
        // bulkInsert menangani quoting kolom & konversi tipe (Date, dsb), tapi
        // tidak bisa meng-escape object -> kolom JSON/JSONB diserialisasi dulu.
        const jsonColumns = await jsonColumnsFor(queryInterface, table, t);
        const prepared =
          jsonColumns.length === 0
            ? rows
            : rows.map((row) => serializeJsonColumns(row, jsonColumns));
        await queryInterface.bulkInsert(table, prepared, { transaction: t });
        restoredCounts[table] = rows.length;
      }
    });
  } catch (err) {
    return failure(res, {
      statusCode: 500,
      message: `Restore gagal, database dikembalikan ke kondisi semula: ${err.message}`,
    });
  }

  // system_settings baru saja diganti isinya; buang cache in-memory supaya
  // pembacaan berikutnya tidak memakai nilai lama sampai TTL 30 detik habis.
  invalidateSettingsCache();

  await logActivity(
    req,
    'RESTORE_BACKUP',
    `Admin memulihkan data sistem dari file backup (${req.file.originalname})`,
  );

  return success(res, {
    message: 'Restore data berhasil.',
    data: {
      source_file: req.file.originalname,
      backup_format_version: Number.isFinite(fileVersion) ? fileVersion : null,
      backup_generated_at: backup.meta.generated_at || null,
      restored: restoredCounts,
      // Tabel yang tidak ada di file -> nilainya TIDAK disentuh (lihat komentar
      // di atas). Dikembalikan supaya admin tahu cakupan restore sesungguhnya.
      missing_tables: missingTables,
    },
  });
};

// GET /api/backup/stats  (Admin - ringkasan jumlah baris per tabel)
const backupStats = async (req, res) => {
  const stats = {};
  try {
    for (const table of BACKUP_TABLES) {
      const [rows] = await sequelize.query(
        `SELECT COUNT(*)::int AS count FROM "${table}"`,
      );
      stats[table] = rows[0]?.count ?? 0;
    }
  } catch (err) {
    return failure(res, {
      statusCode: 500,
      message: `Gagal membaca statistik tabel: ${err.message}`,
    });
  }

  return success(res, { data: { tables: stats, generated_at: new Date().toISOString() } });
};

module.exports = { exportBackup, backupStats, restoreBackup, BACKUP_TABLES };
