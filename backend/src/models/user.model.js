const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");
const { USER_STATUS } = require("../utils/constants");

/// Akun Pegawai. Login pakai NIP + password sementara dari Admin, wajib
/// ganti password saat pertama kali login (Flow Pegawai). Akun Admin &
/// Pimpinan ada di model terpisah, lihat `admin_account.model.js`.
class User extends Model {
  static associate(models) {
    User.hasMany(models.Attendance, {
      foreignKey: "user_id",
      as: "attendances",
    });
    User.hasMany(models.Leave, { foreignKey: "user_id", as: "leaves" });
    User.hasMany(models.PiketSchedule, {
      foreignKey: "user_id",
      as: "piketSchedules",
    });
    User.hasMany(models.ActivityLog, {
      foreignKey: "user_id",
      as: "activityLogs",
    });
    User.hasMany(models.Notification, {
      foreignKey: "user_id",
      as: "notifications",
    });
  }

  toSafeJSON() {
    // reset_password_otp/expires dikecualikan juga - keduanya adalah
    // rahasia reset password aktif dan tidak boleh pernah sampai ke client,
    // sama seperti password itu sendiri.
    const { password, reset_password_otp, reset_password_expires, ...safe } =
      this.toJSON();
    return safe;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nip: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      comment:
        "Nomor Induk Pegawai, dipakai sebagai username login di app mobile",
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment:
        "Diisi pegawai saat wajib ganti password pertama kali, untuk verifikasi lupa password",
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    jabatan: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(USER_STATUS)),
      allowNull: false,
      defaultValue: USER_STATUS.ACTIVE,
    },
    is_first_login: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "True jika pegawai masih memakai password sementara dari Admin",
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reset_password_otp: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Hash bcrypt dari kode OTP reset password yang sedang aktif",
    },
    reset_password_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
    paranoid: true, // soft delete -> deleted_at
  },
);

module.exports = User;
