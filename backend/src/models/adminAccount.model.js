const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { USER_STATUS } = require('../utils/constants');

// Tabel `admin_accounts` khusus menyimpan akun Admin & Pimpinan (website),
// terpisah dari tabel `users` yang hanya berisi data Pegawai.
const ADMIN_ROLES = Object.freeze({
  ADMIN: 'admin',
  PIMPINAN: 'pimpinan',
});

class AdminAccount extends Model {
  static associate(models) {
    AdminAccount.hasMany(models.Leave, { foreignKey: 'reviewed_by', as: 'leavesReviewed' });
    AdminAccount.hasMany(models.Leave, { foreignKey: 'decided_by', as: 'leavesDecided' });
    AdminAccount.hasMany(models.QrCode, { foreignKey: 'generated_by', as: 'generatedQrCodes' });
    AdminAccount.hasMany(models.Attendance, { foreignKey: 'corrected_by', as: 'correctedAttendances' });
    AdminAccount.hasMany(models.PiketSchedule, { foreignKey: 'assigned_by', as: 'assignedPiketSchedules' });
    AdminAccount.hasMany(models.ActivityLog, { foreignKey: 'admin_account_id', as: 'activityLogs' });
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
      comment: 'Dipakai sebagai username login Admin/Pimpinan (bukan NIP pegawai)',
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
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
    paranoid: true, // soft delete -> deleted_at
  }
);

AdminAccount.ROLES = ADMIN_ROLES;

module.exports = AdminAccount;
