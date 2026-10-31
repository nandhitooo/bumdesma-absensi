// Koneksi Sequelize ke PostgreSQL
require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "bumdesma_absensi",
  process.env.DB_USER || "postgres",
  process.env.DB_PASSWORD || "postgres",
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || "postgres",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    define: {
      underscored: true, // snake_case di kolom database
      timestamps: true,
      // IMPORTANT: `underscored: true` above only renames the DATABASE
      // COLUMN to snake_case — it does NOT rename the Sequelize attribute,
      // which defaults to `createdAt`/`updatedAt`. That mismatch meant
      // every model's .toJSON() output a camelCase `createdAt` key, while
      // every client (mobile app's HttpLeaveService/HttpNotificationService,
      // and the rest of this API's snake_case convention) expects
      // `created_at`. The mobile app then did
      // `DateTime.parse(row['created_at'] as String)`, got `null` back,
      // and crashed with "type 'Null' is not a subtype of type 'String'".
      // Explicitly naming the attributes below makes the JSON key match
      // the DB column and the rest of the API everywhere, for every model.
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    dialectOptions:
      process.env.DB_SSL === "true"
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
  },
);

module.exports = sequelize;
