'use strict';

// Tabel `admin_accounts` sudah ada secara fisik di database (dibuat di luar
// migration ini). Migration ini idempotent: kalau tabel sudah ada, dilewati
// saja supaya struktur asli tidak tersentuh; kalau belum ada (mis. instalasi
// baru), tabel dibuat mengikuti struktur yang sama persis.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('admin_accounts')) return;

    await queryInterface.createTable('admin_accounts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('admin', 'pimpinan'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      is_first_login: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
    await queryInterface.addIndex('admin_accounts', ['role']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('admin_accounts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_accounts_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_accounts_status";');
  },
};
