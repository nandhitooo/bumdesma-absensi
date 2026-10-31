const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ActivityLog extends Model {
  static associate(models) {
    ActivityLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    ActivityLog.belongsTo(models.AdminAccount, { foreignKey: 'admin_id', as: 'admin' });
  }
}

ActivityLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Diisi jika aktor adalah pegawai',
    },
    admin_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Diisi jika aktor adalah Admin/Pimpinan',
    },
    actor_type: {
      type: DataTypes.ENUM('pegawai', 'admin', 'pimpinan'),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Contoh: LOGIN, SCAN_ABSENSI, KOREKSI_ABSENSI, GENERATE_QR, dsb',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ActivityLog',
    tableName: 'activity_logs',
    updatedAt: false, // log bersifat append-only
  }
);

module.exports = ActivityLog;
