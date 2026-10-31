'use strict';

// Menyimpan kode OTP (di-hash, bukan disimpan mentah) dan waktu
// kedaluwarsanya untuk fitur "Lupa Password" pegawai. OTP dikirim ke
// email pemulihan yang sudah dikumpulkan lewat fitur wajib-isi-email
// (lihat migration 20260101000012-add-email-to-users.js).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');

    if (!table.reset_password_otp) {
      await queryInterface.addColumn('users', 'reset_password_otp', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Hash bcrypt dari kode OTP reset password yang sedang aktif',
      });
    }

    if (!table.reset_password_expires) {
      await queryInterface.addColumn('users', 'reset_password_expires', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('users');
    if (table.reset_password_otp) {
      await queryInterface.removeColumn('users', 'reset_password_otp');
    }
    if (table.reset_password_expires) {
      await queryInterface.removeColumn('users', 'reset_password_expires');
    }
  },
};
