const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QrCode extends Model {
  static associate(models) {
    QrCode.hasMany(models.Attendance, { foreignKey: 'qr_code_id', as: 'attendances' });
    QrCode.belongsTo(models.AdminAccount, { foreignKey: 'generated_by', as: 'generator' });
  }
}

QrCode.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Token terenkripsi unik yang merepresentasikan identitas kantor',
    },
    image_path: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Path file gambar QR (.png) hasil generate',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'QR Code statis - hanya satu token aktif pada satu waktu',
    },
    generated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin yang men-generate/regenerasi QR Code',
    },
    generated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'QrCode',
    tableName: 'qr_codes',
  }
);

module.exports = QrCode;
