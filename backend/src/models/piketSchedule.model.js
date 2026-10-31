const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class PiketSchedule extends Model {
  static associate(models) {
    PiketSchedule.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    PiketSchedule.belongsTo(models.AdminAccount, { foreignKey: 'assigned_by', as: 'assignedByAdmin' });
  }
}

PiketSchedule.init(
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
    tanggal: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Tanggal piket (hari Sabtu)',
    },
    assigned_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    notification_sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Asal baris: 'manual' (Admin assign) atau 'rotation' (giliran otomatis).
    source: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'manual',
    },
  },
  {
    sequelize,
    modelName: 'PiketSchedule',
    tableName: 'piket_schedules',
    indexes: [{ unique: true, fields: ['user_id', 'tanggal'] }],
  }
);

module.exports = PiketSchedule;
