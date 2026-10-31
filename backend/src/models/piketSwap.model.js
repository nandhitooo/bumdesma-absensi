const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { PIKET_SWAP_STATUS } = require('../utils/constants');

// Permintaan tukar jadwal piket (ganti orang di tanggal yang sama).
// Alurnya admin-mediated sesuai kebijakan: pegawai mengajukan secara lisan ke
// Admin, Admin mencatat permintaan, lalu kesediaan pegawai pengganti dicatat
// Admin sebelum keputusan akhir. Tidak ada endpoint pengajuan dari app mobile.
class PiketSwap extends Model {
  static associate(models) {
    PiketSwap.belongsTo(models.PiketSchedule, {
      foreignKey: 'piket_schedule_id',
      as: 'piketSchedule',
    });
    PiketSwap.belongsTo(models.User, {
      foreignKey: 'requester_user_id',
      as: 'requester',
    });
    PiketSwap.belongsTo(models.User, {
      foreignKey: 'replacement_user_id',
      as: 'replacement',
    });
    PiketSwap.belongsTo(models.AdminAccount, {
      foreignKey: 'decided_by',
      as: 'decidedByAdmin',
    });
  }
}

PiketSwap.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    piket_schedule_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Jadwal piket asal yang akan dialihkan',
    },
    tanggal: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Tanggal piket (disalin dari jadwal asal)',
    },
    requester_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Pegawai yang minta digantikan',
    },
    replacement_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Pegawai pengganti',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PIKET_SWAP_STATUS)),
      allowNull: false,
      defaultValue: PIKET_SWAP_STATUS.MENUNGGU_PENGGANTI,
    },
    agreed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Kapan kesediaan pegawai pengganti dicatat Admin',
    },
    decided_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin yang memberi keputusan akhir',
    },
    decided_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    catatan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PiketSwap',
    tableName: 'piket_swaps',
    indexes: [{ fields: ['piket_schedule_id'] }, { fields: ['tanggal'] }],
  }
);

module.exports = PiketSwap;
