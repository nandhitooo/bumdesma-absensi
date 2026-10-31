const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { LEAVE_TYPE, LEAVE_STATUS } = require('../utils/constants');

class Leave extends Model {
  static associate(models) {
    Leave.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Leave.belongsTo(models.AdminAccount, { foreignKey: 'reviewed_by', as: 'reviewedByAdmin' });
    Leave.belongsTo(models.AdminAccount, { foreignKey: 'decided_by', as: 'decidedByPimpinan' });
  }
}

Leave.init(
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
    jenis: {
      type: DataTypes.ENUM(...Object.values(LEAVE_TYPE)),
      allowNull: false,
    },
    tanggal_mulai: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    tanggal_selesai: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    alasan: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    file_lampiran: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Path file surat pendukung yang diunggah pegawai',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(LEAVE_STATUS)),
      allowNull: false,
      defaultValue: LEAVE_STATUS.PENDING,
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin yang meninjau & meneruskan pengajuan ke Pimpinan',
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    decided_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Pimpinan yang memberikan keputusan akhir',
    },
    decided_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    catatan_keputusan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Leave',
    tableName: 'leaves',
  }
);

module.exports = Leave;
