/**
 * One-time maintenance script: deletes files in uploads/surat-izin/ that
 * are not referenced by any Leave.file_lampiran row — i.e. leftovers from
 * failed/retried submissions saved by Multer before the create() cleanup
 * fix was added.
 *
 * Usage (from the backend project root):
 *   node cleanup-orphaned-leave-files.js          # dry run, lists what would be deleted
 *   node cleanup-orphaned-leave-files.js --delete # actually deletes them
 */
const fs = require("fs");
const path = require("path");
const { Leave, sequelize } = require("./src/models");

const UPLOAD_DIR = path.join(__dirname, "uploads", "surat-izin");

async function main() {
  const shouldDelete = process.argv.includes("--delete");

  const leaves = await Leave.findAll({ attributes: ["file_lampiran"] });
  const referenced = new Set(
    leaves
      .map((l) => l.file_lampiran)
      .filter(Boolean)
      .map((p) => path.basename(p)),
  );

  const filesOnDisk = fs.existsSync(UPLOAD_DIR)
    ? fs.readdirSync(UPLOAD_DIR).filter((f) => f !== ".gitkeep")
    : [];

  const orphaned = filesOnDisk.filter((f) => !referenced.has(f));

  console.log(`Total file di disk: ${filesOnDisk.length}`);
  console.log(`Direferensikan oleh data Leave: ${referenced.size}`);
  console.log(`Orphan ditemukan: ${orphaned.length}`);

  if (orphaned.length === 0) {
    console.log("Tidak ada file orphan. Selesai.");
    await sequelize.close();
    return;
  }

  orphaned.forEach((f) => console.log(`  - ${f}`));

  if (!shouldDelete) {
    console.log("\nIni baru dry-run — tidak ada file yang dihapus.");
    console.log(
      "Jalankan lagi dengan --delete untuk benar-benar menghapusnya:",
    );
    console.log("  node cleanup-orphaned-leave-files.js --delete");
  } else {
    for (const f of orphaned) {
      fs.unlinkSync(path.join(UPLOAD_DIR, f));
    }
    console.log(`\n${orphaned.length} file orphan berhasil dihapus.`);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error("Gagal menjalankan cleanup:", err);
  process.exit(1);
});
