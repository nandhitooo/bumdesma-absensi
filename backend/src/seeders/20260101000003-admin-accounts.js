'use strict';
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Data contoh Admin & Pimpinan (tabel `admin_accounts`), login pakai
// username + password dari Website.
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const hash = (plain) => bcrypt.hashSync(plain, 10);

    await queryInterface.bulkInsert('admin_accounts', [
      {
        id: uuidv4(),
        username: 'admin',
        name: 'Administrator BUMDESMA',
        password: hash('Admin@12345'),
        role: 'admin',
        status: 'active',
        is_first_login: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        username: 'pimpinan',
        name: 'Pimpinan BUMDESMA Podo Rukun LKD',
        password: hash('Pimpinan@12345'),
        role: 'pimpinan',
        status: 'active',
        is_first_login: false,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete(
      'admin_accounts',
      { username: ['admin', 'pimpinan'] },
      {}
    );
  },
};
