"use strict";
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

// Data contoh Pegawai (tabel `users`). Akun Admin & Pimpinan sekarang ada
// di seeder terpisah, lihat 20260101000003-admin-accounts.js.
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const hash = (plain) => bcrypt.hashSync(plain, 10);

    await queryInterface.bulkInsert("users", [
      {
        id: uuidv4(),
        nip: "KAR001",
        name: "Contoh Pegawai",
        password: hash("Pegawai@123"),
        jabatan: "Staff Operasional",
        status: "active",
        is_first_login: true, // wajib ganti password saat login pertama
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        nip: "3124510004",
        name: "Fernandhito Dian Pratama",
        password: hash("12345678"),
        jabatan: "Tester",
        status: "active",
        is_first_login: false, // wajib ganti password saat login pertama
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete("users", { nip: ["KAR001"] }, {});
  },
};
