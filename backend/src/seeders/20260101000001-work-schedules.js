'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('work_schedules', [
      {
        id: uuidv4(),
        day_type: 'reguler',
        label: 'Senin - Jumat',
        start_time: '08:30:00',
        end_time: '15:00:00',
        late_tolerance_minutes: 15,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        day_type: 'sabtu',
        label: 'Sabtu (Piket)',
        start_time: '09:00:00',
        end_time: '12:00:00',
        late_tolerance_minutes: 15,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('work_schedules', null, {});
  },
};
