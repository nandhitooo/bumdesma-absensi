const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { ATTENDANCE_STATUS, CHECKOUT_STATUS } = require('../utils/constants');

class Attendance extends Model {
  static associate(models) {
    Attendance.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Attendance.belongsTo(models.QrCode, { foreignKey: 'qr_code_id', as: 'qrCode' });
    Attendance.belongsTo(models.WorkSchedule, { foreignKey: 'schedule_id', as: 'schedule' });
    Attendance.belongsTo(models.AdminAccount, { foreignKey: 'corrected_by', as: 'correctedByAdmin' });
  }
}

Attendance.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    qr_code_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Null jika data hasil koreksi manual Admin (bukan hasil scan)',
    },
    schedule_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    tanggal: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    jam_masuk: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    jam_pulang: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ATTENDANCE_STATUS)),
      allowNull: false,
      defaultValue: ATTENDANCE_STATUS.ALPA,
      comment: 'Status kehadiran: tepat_waktu, terlambat, alpa, izin_cuti',
    },
    checkout_status: {
      type: DataTypes.ENUM(...Object.values(CHECKOUT_STATUS)),
      allowNull: true,
      comment: 'normal, lembur, atau belum_pulang',
    },
    overtime_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Durasi lembur dalam menit, dihitung saat absen pulang',
    },
    late_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Selisih menit keterlambatan dari jam masuk + toleransi',
    },
    latitude_in: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude_in: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    distance_in_meters: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    latitude_out: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude_out: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    distance_out_meters: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    is_manual_correction: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    corrected_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin yang melakukan koreksi manual, jika ada',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Attendance',
    tableName: 'attendances',
    indexes: [
      { unique: true, fields: ['user_id', 'tanggal'] }, // satu record per pegawai per hari
    ],
  }
);

module.exports = Attendance;
