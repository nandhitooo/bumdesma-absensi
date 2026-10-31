const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/// FCM registration token per perangkat, dipakai backend untuk mengirim
/// push notification ke notif bar HP pegawai (lihat services/push.service.js).
/// Barisnya dibuat saat app mobile login (POST /api/push/register) dan
/// dihapus saat logout (POST /api/push/unregister).
class PushToken extends Model {
  static associate(models) {
    PushToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}

PushToken.init(
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
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    platform: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'android',
    },
  },
  {
    sequelize,
    modelName: 'PushToken',
    tableName: 'push_tokens',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'token'],
        name: 'push_tokens_user_token_unique',
      },
    ],
  }
);

module.exports = PushToken;
