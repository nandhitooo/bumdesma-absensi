'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('leaves', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      jenis: {
        type: Sequelize.ENUM('izin', 'cuti'),
        allowNull: false,
      },
      tanggal_mulai: { type: Sequelize.DATEONLY, allowNull: false },
      tanggal_selesai: { type: Sequelize.DATEONLY, allowNull: false },
      alasan: { type: Sequelize.TEXT, allowNull: false },
      file_lampiran: { type: Sequelize.STRING, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'diteruskan', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      reviewed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admin_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      decided_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admin_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      decided_at: { type: Sequelize.DATE, allowNull: true },
      catatan_keputusan: { type: Sequelize.TEXT, allowNull: true },
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
    await queryInterface.addIndex('leaves', ['user_id']);
    await queryInterface.addIndex('leaves', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('leaves');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_leaves_jenis";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_leaves_status";');
  },
};
