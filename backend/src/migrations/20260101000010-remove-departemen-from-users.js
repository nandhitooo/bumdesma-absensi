'use strict';

// Menyesuaikan skema database dengan ERD pada proposal (BAB 3): tabel
// `users` tidak memiliki kolom `departemen`. Aman dijalankan di environment
// manapun — kalau kolomnya memang belum pernah ada (seperti pada database
// kamu saat ini), migration ini tidak melakukan apa-apa.
module.exports = {
  up: async (queryInterface) => {
    const table = await queryInterface.describeTable('users');
    if (table.departemen) {
      await queryInterface.removeColumn('users', 'departemen');
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (!table.departemen) {
      await queryInterface.addColumn('users', 'departemen', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },
};
