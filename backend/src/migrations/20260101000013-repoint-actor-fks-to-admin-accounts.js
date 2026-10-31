"use strict";

// Kolom-kolom ini mencatat SIAPA (Admin/Pimpinan) yang melakukan sebuah aksi:
// piket_schedules.assigned_by, leaves.reviewed_by, leaves.decided_by,
// notifications.sent_by, attendances.corrected_by. Sebelum tabel `users` dan
// `admin_accounts` dipisah, semuanya menunjuk ke `users(id)`. Sekarang aktor
// admin/pimpinan ada di `admin_accounts`, jadi FK-nya perlu diarahkan ulang.
const TARGETS = [
  { table: "piket_schedules", column: "assigned_by" },
  { table: "leaves", column: "reviewed_by" },
  { table: "leaves", column: "decided_by" },
  { table: "notifications", column: "sent_by" },
  { table: "attendances", column: "corrected_by" },
];

async function findFkConstraintName(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = :table
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = :column
  `,
    { replacements: { table, column } },
  );
  return rows[0]?.constraint_name || null;
}

module.exports = {
  up: async (queryInterface) => {
    for (const { table, column } of TARGETS) {
      const constraintName = await findFkConstraintName(
        queryInterface,
        table,
        column,
      );
      if (constraintName) {
        await queryInterface.removeConstraint(table, constraintName);
      }
      await queryInterface.addConstraint(table, {
        fields: [column],
        type: "foreign key",
        name: `${table}_${column}_admin_fkey`,
        references: { table: "admin_accounts", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  down: async (queryInterface) => {
    for (const { table, column } of TARGETS) {
      await queryInterface.removeConstraint(
        table,
        `${table}_${column}_admin_fkey`,
      );
      await queryInterface.addConstraint(table, {
        fields: [column],
        type: "foreign key",
        name: `${table}_${column}_fkey`,
        references: { table: "users", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },
};
