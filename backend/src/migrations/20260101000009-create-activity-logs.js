'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('activity_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Terisi jika aksi dilakukan oleh pegawai (tabel users)',
      },
      admin_account_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admin_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Terisi jika aksi dilakukan oleh Admin/Pimpinan (tabel admin_accounts)',
      },
      action: { type: Sequelize.STRING(100), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      ip_address: { type: Sequelize.STRING(50), allowNull: true },
      user_agent: { type: Sequelize.STRING(255), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('activity_logs', ['user_id']);
    await queryInterface.addIndex('activity_logs', ['admin_account_id']);
    await queryInterface.addIndex('activity_logs', ['action']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('activity_logs');
  },
};
