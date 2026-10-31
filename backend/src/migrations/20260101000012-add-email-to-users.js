'use strict';

// Ditambahkan agar pegawai bisa mendaftarkan email saat wajib ganti
// password pertama kali (Gambar 3.11 Flow Pegawai), untuk verifikasi jika
// suatu saat lupa password.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (!table.email) {
      await queryInterface.addColumn('users', 'email', {
        type: Sequelize.STRING(150),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('users');
    if (table.email) {
      await queryInterface.removeColumn('users', 'email');
    }
  },
};
