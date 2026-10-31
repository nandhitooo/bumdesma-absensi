'use strict';

// Fitur "cycle/giliran" piket:
// - `piket_rotation_members` menyimpan daftar pegawai yang ikut giliran beserta
//   urutannya (position). Tiap Sabtu, sistem mengambil `perSabtu` anggota
//   berikutnya secara melingkar -> tidak ada yang terlewat.
// - `piket_schedules.source` menandai asal baris: 'manual' (Admin assign) atau
//   'rotation' (dibuat otomatis oleh giliran) supaya UI bisa membedakannya.
// Konfigurasi (aktif/tidak, tanggal mulai, jumlah per Sabtu, berapa pekan ke
// depan) disimpan sebagai baris `system_settings` (lihat utils/piketRotation.js).

const SOURCE_COLUMN = 'source';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Idempotent mengikuti konvensi migrasi lain di repo ini: tabel/kolom bisa
    // saja sudah dibuat manual di database.
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('piket_rotation_members')) {
      await queryInterface.createTable('piket_rotation_members', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        position: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: 'Urutan giliran (0-based). Mengurutkan daftar rotasi.',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      // Satu pegawai hanya boleh muncul sekali di daftar giliran.
      await queryInterface.addIndex('piket_rotation_members', ['user_id'], {
        unique: true,
        name: 'piket_rotation_members_user_id_key',
      });
      await queryInterface.addIndex('piket_rotation_members', ['position'], {
        name: 'piket_rotation_members_position_idx',
      });
    }

    const scheduleColumns = await queryInterface.describeTable('piket_schedules');
    if (!scheduleColumns[SOURCE_COLUMN]) {
      await queryInterface.addColumn('piket_schedules', SOURCE_COLUMN, {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'manual',
        comment: "Asal jadwal: 'manual' (assign Admin) atau 'rotation' (giliran otomatis)",
      });
    }
  },

  down: async (queryInterface) => {
    const scheduleColumns = await queryInterface.describeTable('piket_schedules');
    if (scheduleColumns[SOURCE_COLUMN]) {
      await queryInterface.removeColumn('piket_schedules', SOURCE_COLUMN);
    }
    const tables = await queryInterface.showAllTables();
    if (tables.includes('piket_rotation_members')) {
      await queryInterface.dropTable('piket_rotation_members');
    }
  },
};
