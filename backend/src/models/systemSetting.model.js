const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// Menyimpan parameter sistem: jam kerja, radius geofencing, koordinat kantor,
// hari libur nasional, dsb sebagai pasangan key-value agar fleksibel diubah Admin
// melalui halaman Pengaturan tanpa perlu migrasi skema baru.
class SystemSetting extends Model {}

SystemSetting.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SystemSetting',
    tableName: 'system_settings',
  }
);

module.exports = SystemSetting;
