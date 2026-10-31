const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// Daftar pegawai yang ikut giliran (cycle) piket Sabtu, beserta urutannya.
// Kolom `position` menentukan siapa yang piket lebih dulu; urutan diambil
// melingkar oleh utils/piketRotation.js.
class PiketRotationMember extends Model {
  static associate(models) {
    PiketRotationMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}

PiketRotationMember.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Pegawai yang ikut giliran piket',
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Urutan giliran (0-based)',
    },
  },
  {
    sequelize,
    modelName: 'PiketRotationMember',
    tableName: 'piket_rotation_members',
    indexes: [{ unique: true, fields: ['user_id'] }, { fields: ['position'] }],
  }
);

module.exports = PiketRotationMember;
