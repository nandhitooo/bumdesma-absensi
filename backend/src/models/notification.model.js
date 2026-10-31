const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { NOTIFICATION_TYPE } = require('../utils/constants');

/// Notifikasi in-app yang ditampilkan di logo lonceng Dashboard mobile
/// (Gambar 3.24). Dibuat saat Admin menekan tombol "Kirim Notifikasi" pada
/// jadwal piket, atau otomatis saat Pimpinan memutuskan pengajuan izin/cuti.
class Notification extends Model {
  static associate(models) {
    Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Notification.belongsTo(models.AdminAccount, { foreignKey: 'sent_by', as: 'sentByAdmin' });
  }
}

Notification.init(
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
    type: {
      type: DataTypes.ENUM(...Object.values(NOTIFICATION_TYPE)),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sent_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
  }
);

module.exports = Notification;
