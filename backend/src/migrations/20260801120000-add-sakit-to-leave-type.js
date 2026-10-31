"use strict";

// Postgres tidak mengizinkan menghapus value ENUM (down tidak reversible
// tanpa rebuild tipe), jadi migration ini idempotent lewat IF NOT EXISTS.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_leaves_jenis\" ADD VALUE IF NOT EXISTS 'sakit';",
    );
  },
  down: async () => {
    // no-op — lihat catatan di atas.
  },
};
