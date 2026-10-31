"use strict";

// Konversi istilah "karyawan" -> "pegawai" pada nilai yang tersimpan di database.
// - users.role bertipe STRING dengan default 'karyawan' (migration
//   20260801110302-add-role-to-users.js): default kolom diubah ke 'pegawai'
//   dan semua baris lama bernilai 'karyawan' di-update.
// - activity_logs.actor_type adalah ENUM PostgreSQL
//   ('karyawan','admin','pimpinan') sejak migration
//   20260101000014-add-actor-columns-to-activity-logs.js: ENUM dibuat ulang
//   dengan label 'pegawai' menggantikan 'karyawan'.
//
// Migration ini idempotent: aman dijalankan ulang pada database yang sudah
// dikonversi, dan aman pada database yang actor_type-nya belum ber-ENUM
// (mis. dibuat manual tanpa migration 20260101000014).
//
// CATATAN JWT: token akses lama masih membawa actorType/role 'karyawan' dan
// akan diterima middleware sampai kedaluwarsa. Nilai 'karyawan' tidak dikenal
// authorize() baru, sehingga request dengan token lama akan ditolak 403
// sampai pengguna login ulang. Konsekuensi ini disengaja.

const ROLE_ENUM_TYPE = "enum_activity_logs_actor_type";

// Cek apakah sebuah label sudah ada di dalam tipe ENUM PostgreSQL. Dipakai
// supaya RENAME VALUE tidak dijalankan dua kali (label lama sudah hilang) -
// tanpa ini, menjalankan ulang migrasi pada database yang sudah dikonversi
// gagal dengan '"karyawan" is not an existing enum label'.
async function enumLabelExists(sequelize, typeName, label) {
  const rows = await sequelize.query(
    `SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = :typeName
        AND e.enumlabel = :label
      LIMIT 1;`,
    { replacements: { typeName, label } },
  );
  return Array.isArray(rows) && rows[0].length > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;

    // ---- users.role: default kolom + data ----
    const usersTable = await queryInterface.describeTable("users");
    if (usersTable.role) {
      await sequelize.query(
        `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'pegawai';`,
      );
      await sequelize.query(
        `UPDATE "users" SET "role" = 'pegawai' WHERE "role" = 'karyawan';`,
      );
    }

    // ---- activity_logs.actor_type: ENUM relabel + data ----
    const logsTable = await queryInterface.describeTable("activity_logs");
    if (logsTable.actor_type) {
      const enumType = await sequelize.query(
        `SELECT t.typname
           FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = :typeName
            AND n.nspname = CURRENT_SCHEMA();`,
        { replacements: { typeName: ROLE_ENUM_TYPE } },
      );
      const enumExists = Array.isArray(enumType) && enumType[0].length > 0;

      if (enumExists) {
        // RENAME VALUE otomatis mengubah label pada semua baris yang memakai
        // nilai lama - TIDAK boleh UPDATE dulu: 'pegawai' belum valid sebelum
        // label ENUM-nya ada (migration pertama gagal persis karena ini).
        // Lewati kalau label 'karyawan' sudah tidak ada (sudah dikonversi).
        const needsRename = await enumLabelExists(
          sequelize,
          ROLE_ENUM_TYPE,
          "karyawan",
        );
        if (needsRename) {
          await sequelize.query(
            `ALTER TYPE "${ROLE_ENUM_TYPE}" RENAME VALUE 'karyawan' TO 'pegawai';`,
          );
        }
      } else {
        // Kolom ada tetapi bukan ENUM (varchar, dibuat manual): konversi data
        // dulu di domain varchar, baru ubah tipe kolomnya ke ENUM.
        await sequelize.query(
          `UPDATE "activity_logs" SET "actor_type" = 'pegawai' WHERE "actor_type" = 'karyawan';`,
        );
        await sequelize.query(
          `ALTER TABLE "activity_logs"
             ALTER COLUMN "actor_type" DROP DEFAULT,
             ALTER COLUMN "actor_type" TYPE "enum_activity_logs_actor_type"
               USING (CASE "actor_type"
                 WHEN 'karyawan' THEN 'pegawai'
                 ELSE "actor_type"::text END)::"enum_activity_logs_actor_type";`,
        );
      }
    } else {
      // Kolom belum ada (skenario DB yang dibuat manual tanpa menjalankan
      // 20260101000014). Pastikan ENUM dengan label baru ada, lalu tambahkan
      // kolomnya lewat raw SQL agar tidak dobel membuat tipe.
      await sequelize.query(
        `DO $dummy$
         BEGIN
           IF NOT EXISTS (
             SELECT 1 FROM pg_type t
             JOIN pg_namespace n ON n.oid = t.typnamespace
             WHERE t.typname = '${ROLE_ENUM_TYPE}'
               AND n.nspname = CURRENT_SCHEMA()
           ) THEN
             CREATE TYPE "${ROLE_ENUM_TYPE}" AS ENUM ('pegawai', 'admin', 'pimpinan');
           END IF;
         END
         $dummy$;`,
      );
      await sequelize.query(
        `ALTER TABLE "activity_logs" ADD COLUMN "actor_type" "${ROLE_ENUM_TYPE}";`,
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;

    // ---- users.role: kembalikan default + data ----
    const usersTable = await queryInterface.describeTable("users");
    if (usersTable.role) {
      await sequelize.query(
        `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'karyawan';`,
      );
      await sequelize.query(
        `UPDATE "users" SET "role" = 'karyawan' WHERE "role" = 'pegawai';`,
      );
    }

    // ---- activity_logs.actor_type: kembalikan ENUM (data ikut ter-relabel) ----
    const logsTable = await queryInterface.describeTable("activity_logs");
    if (logsTable.actor_type) {
      const needsRename = await enumLabelExists(
        sequelize,
        ROLE_ENUM_TYPE,
        "pegawai",
      );
      if (needsRename) {
        await sequelize.query(
          `ALTER TYPE "${ROLE_ENUM_TYPE}" RENAME VALUE 'pegawai' TO 'karyawan';`,
        );
      }
    }
  },
};
