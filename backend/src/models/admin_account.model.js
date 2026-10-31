const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { ADMIN_ROLES, USER_STATUS } = require('../utils/constants');

/// Akun Admin & Pimpinan. Login pakai username + password di Website
/// (terpisah dari akun Pegawai di tabel `users`, yang login pakai NIP di
/// app mobile).
class AdminAccount extends Model {
  static associate(models) {
    AdminAccount.hasMany(models.PiketSchedule, { foreignKey: 'assigned_by', as: 'piketAssigned' });
    AdminAccount.hasMany(models.Leave, { foreignKey: 'reviewed_by', as: 'leavesReviewed' });
    AdminAccount.hasMany(models.Leave, { foreignKey: 'decided_by', as: 'leavesDecided' });
    AdminAccount.hasMany(models.Notification, { foreignKey: 'sent_by', as: 'notificationsSent' });
    AdminAccount.hasMany(models.Attendance, { foreignKey: 'corrected_by', as: 'attendanceCorrections' });
    AdminAccount.hasMany(models.ActivityLog, { foreignKey: 'admin_id', as: 'activityLogs' });
  }

  toSafeJSON() {
    const { password, ...safe } = this.toJSON();
    return safe;
  }
}

AdminAccount.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(...Object.values(ADMIN_ROLES)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(USER_STATUS)),
      allowNull: false,
      defaultValue: USER_STATUS.ACTIVE,
    },
    is_first_login: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AdminAccount',
    tableName: 'admin_accounts',
    paranoid: true,
  }
);

module.exports = AdminAccount;
