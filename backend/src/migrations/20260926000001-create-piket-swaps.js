'use strict';

const { PIKET_SWAP_STATUS } = require('../utils/constants');

const STATUS_ENUM = 'enum_piket_swaps_status';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Idempotent (mengikuti konvensi migrasi lain di repo ini): tabel mungkin
    // sudah dibuat manual di database, jadi jangan gagal kalau sudah ada.
    const tables = await queryInterface.showAllTables();
    if (tables.includes('piket_swaps')) return;

    await queryInterface.createTable('piket_swaps', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      piket_schedule_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'piket_schedules', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tanggal: { type: Sequelize.DATEONLY, allowNull: false },
      requester_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      replacement_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM(...Object.values(PIKET_SWAP_STATUS)),
        allowNull: false,
        defaultValue: PIKET_SWAP_STATUS.MENUNGGU_PENGGANTI,
      },
      agreed_at: { type: Sequelize.DATE, allowNull: true },
      decided_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admin_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      decided_at: { type: Sequelize.DATE, allowNull: true },
      catatan: { type: Sequelize.TEXT, allowNull: true },
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
    });
    await queryInterface.addIndex('piket_swaps', ['piket_schedule_id']);
    await queryInterface.addIndex('piket_swaps', ['tanggal']);
    await queryInterface.addIndex('piket_swaps', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('piket_swaps');
    // dropTable tidak menghapus tipe ENUM yang dibuat createTable, sehingga
    // sisa tipe bisa bentrok saat migrasi dijalankan ulang.
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "${STATUS_ENUM}";`
    );
  },
};
