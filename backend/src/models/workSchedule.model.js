const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { DAY_TYPE } = require('../utils/constants');

class WorkSchedule extends Model {
  static associate(models) {
    WorkSchedule.hasMany(models.Attendance, {
      foreignKey: 'schedule_id',
      as: 'attendances',
    });
  }
}

WorkSchedule.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    day_type: {
      type: DataTypes.ENUM(...Object.values(DAY_TYPE)),
      allowNull: false,
      unique: true,
      comment: 'reguler = Senin-Jumat, sabtu = jadwal piket Sabtu',
    },
    label: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Contoh: "Senin - Jumat" atau "Sabtu"',
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'Jam masuk, contoh 08:30:00',
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'Jam pulang normal, contoh 15:00:00',
    },
    late_tolerance_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'WorkSchedule',
    tableName: 'work_schedules',
  }
);

module.exports = WorkSchedule;
