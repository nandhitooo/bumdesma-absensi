"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("activity_logs");

    if (!table.actor_type) {
      await queryInterface.addColumn("activity_logs", "actor_type", {
        type: Sequelize.ENUM("pegawai", "admin", "pimpinan"),
        allowNull: true,
      });
    }

    if (!table.admin_id) {
      await queryInterface.addColumn("activity_logs", "admin_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "admin_accounts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await queryInterface.addIndex("activity_logs", ["admin_id"]);
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("activity_logs");
    if (table.admin_id)
      await queryInterface.removeColumn("activity_logs", "admin_id");
    if (table.actor_type)
      await queryInterface.removeColumn("activity_logs", "actor_type");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_activity_logs_actor_type";',
    );
  },
};
