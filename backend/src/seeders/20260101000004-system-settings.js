'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('system_settings', [
      {
        id: uuidv4(),
        key: 'office_latitude',
        value: process.env.OFFICE_LATITUDE || '-7.123456',
        description: 'Titik koordinat latitude kantor BUMDESMA Podo Rukun LKD',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'office_longitude',
        value: process.env.OFFICE_LONGITUDE || '112.123456',
        description: 'Titik koordinat longitude kantor BUMDESMA Podo Rukun LKD',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'geofence_radius_meters',
        value: process.env.GEOFENCE_RADIUS_METERS || '50',
        description: 'Radius aman geofencing dalam meter',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'national_holidays',
        value: JSON.stringify([]),
        description: 'Daftar tanggal libur nasional dalam format JSON array (YYYY-MM-DD)',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('system_settings', null, {});
  },
};
