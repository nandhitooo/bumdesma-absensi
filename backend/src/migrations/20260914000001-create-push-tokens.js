'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('push_tokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Pemilik token (pegawai yang login di app mobile)',
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'FCM registration token perangkat',
      },
      platform: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'android',
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
    });

    // Satu perangkat (token) hanya boleh terdaftar sekali per user.
    // Index prefix (user_id) juga mempercepat lookup pengirim by user.
    await queryInterface.addConstraint('push_tokens', {
      fields: ['user_id', 'token'],
      type: 'unique',
      name: 'push_tokens_user_token_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('push_tokens');
  },
};
