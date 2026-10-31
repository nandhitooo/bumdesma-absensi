'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('attendances', {
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
      qr_code_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'qr_codes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      schedule_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'work_schedules', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tanggal: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      jam_masuk: { type: Sequelize.DATE, allowNull: true },
      jam_pulang: { type: Sequelize.DATE, allowNull: true },
      status: {
        type: Sequelize.ENUM('tepat_waktu', 'terlambat', 'alpa', 'izin_cuti'),
        allowNull: false,
        defaultValue: 'alpa',
      },
      checkout_status: {
        type: Sequelize.ENUM('normal', 'lembur', 'belum_pulang'),
        allowNull: true,
      },
      overtime_minutes: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      late_minutes: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      latitude_in: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude_in: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      distance_in_meters: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      latitude_out: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude_out: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      distance_out_meters: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      is_manual_correction: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      corrected_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admin_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
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
    await queryInterface.addIndex('attendances', ['user_id', 'tanggal'], { unique: true });
    await queryInterface.addIndex('attendances', ['tanggal']);
    await queryInterface.addIndex('attendances', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('attendances');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_attendances_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_attendances_checkout_status";');
  },
};
