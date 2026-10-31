"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("users");
    if (!table.role) {
      await queryInterface.addColumn("users", "role", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pegawai",
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("users");
    if (table.role) {
      await queryInterface.removeColumn("users", "role");
    }
  },
};
