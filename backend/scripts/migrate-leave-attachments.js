/**
 * Rapikan lampiran izin/cuti agar terpisah per kategori.
 *
 * Dua hal yang dikerjakan:
 *  1. Lampiran yang MASIH dirujuk baris `leaves` tetapi tersimpan langsung di
 *     uploads/surat-izin/<uuid>.pdf dipindah ke uploads/surat-izin/<jenis>/,
 *     lalu kolom `file_lampiran` diperbarui.
 *  2. File yatim (tidak dirujuk baris mana pun) dipindah ke
 *     uploads/surat-izin/_lama/ supaya tidak tercampur lampiran aktif. File
 *     tidak dihapus — masih bisa diperiksa manual.
 *
 * Idempotent: baris yang sudah memakai subfolder kategori dilewati, dan file
 * yang sudah berada di subfolder tidak disentuh. Aman dijalankan berulang.
 *
 *   node scripts/migrate-leave-attachments.js            # dry-run (default)
 *   node scripts/migrate-leave-attachments.js --apply    # benar-benar dipindah
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Leave, sequelize } = require('../src/models');
const { LEAVE_TYPE } = require('../src/utils/constants');

const APPLY = process.argv.includes('--apply');
const SURAT_DIR = path.join(__dirname, '..', 'uploads', 'surat-izin');
const LEGACY_DIR = path.join(SURAT_DIR, '_lama');
const PREFIX = '/uploads/surat-izin/';

const ringkasan = {
  dipindahKeKategori: 0,
  sudahRapi: 0,
  fileHilang: 0,
  jenisTidakDikenal: 0,
  yatimDipindah: 0,
};

function namaUnik(dir, nama) {
  let target = path.join(dir, nama);
  if (!fs.existsSync(target)) return target;
  const ext = path.extname(nama);
  const base = path.basename(nama, ext);
  let i = 1;
  do {
    target = path.join(dir, `${base}-${i}${ext}`);
    i += 1;
  } while (fs.existsSync(target));
  return target;
}

function pindahkan(sumber, tujuanDir) {
  if (!APPLY) return path.join(tujuanDir, path.basename(sumber));
  fs.mkdirSync(tujuanDir, { recursive: true });
  const tujuan = namaUnik(tujuanDir, path.basename(sumber));
  fs.renameSync(sumber, tujuan);
  return tujuan;
}

async function rapikanLampiranTerdaftar() {
  const rows = await Leave.findAll({
    where: { file_lampiran: { [Op.like]: `${PREFIX}%` } },
    attributes: ['id', 'jenis', 'file_lampiran'],
  });

  const dirujuk = new Set();

  for (const row of rows) {
    const rel = row.file_lampiran.slice(PREFIX.length); // "uuid.pdf" | "izin/uuid.pdf"
    dirujuk.add(path.basename(rel));

    if (rel.includes('/')) {
      ringkasan.sudahRapi += 1;
      continue;
    }

    if (!Object.values(LEAVE_TYPE).includes(row.jenis)) {
      ringkasan.jenisTidakDikenal += 1;
      console.log(`LEWATI  ${row.file_lampiran} (jenis "${row.jenis}" tidak dikenal)`);
      continue;
    }

    const sumber = path.join(SURAT_DIR, rel);
    if (!fs.existsSync(sumber)) {
      ringkasan.fileHilang += 1;
      console.log(`HILANG  ${row.file_lampiran} (baris ${row.id})`);
      continue;
    }

    console.log(
      `${APPLY ? 'PINDAH' : 'DRY   '}  ${row.file_lampiran}  ->  ${PREFIX}${row.jenis}/${rel}`,
    );
    pindahkan(sumber, path.join(SURAT_DIR, row.jenis));

    if (APPLY) {
      await row.update({ file_lampiran: `${PREFIX}${row.jenis}/${rel}` });
    }
    ringkasan.dipindahKeKategori += 1;
  }

  return dirujuk;
}

function rapikanFileYatim(dirujuk) {
  if (!fs.existsSync(SURAT_DIR)) return 0;

  for (const entri of fs.readdirSync(SURAT_DIR, { withFileTypes: true })) {
    if (!entri.isFile()) continue;
    if (entri.name === '.gitkeep') continue;
    if (dirujuk.has(entri.name)) continue;

    ringkasan.yatimDipindah += 1;
    console.log(
      `${APPLY ? 'YATIM ' : 'DRY   '}  ${PREFIX}${entri.name}  ->  ${PREFIX}_lama/${entri.name}`,
    );
    pindahkan(path.join(SURAT_DIR, entri.name), LEGACY_DIR);
  }

  return ringkasan.yatimDipindah;
}

(async () => {
  const dirujuk = await rapikanLampiranTerdaftar();
  rapikanFileYatim(dirujuk);

  console.log(
    `\nRingkasan: ${JSON.stringify(ringkasan)} ${APPLY ? '(diterapkan)' : '(dry-run — tambahkan --apply)'}`,
  );
  await sequelize.close();
})().catch(async (err) => {
  console.error('Gagal merapikan lampiran:', err.message);
  try {
    await sequelize.close();
  } catch (_) {
    /* abaikan */
  }
  process.exit(1);
});
