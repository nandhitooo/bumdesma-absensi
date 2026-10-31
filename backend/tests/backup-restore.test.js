'use strict';

// Regresi untuk bug restore backup: tabel `piket_swaps` dulu tidak ada di
// BACKUP_TABLES, padahal FK-nya ke piket_schedules/users ON DELETE CASCADE -
// jadi restore menghapus swap lewat cascade tanpa pernah mengembalikannya.
//
// Test ini men-stub koneksi database (Tidak perlu Postgres berjalan) supaya bisa
// memeriksa urutan DELETE/INSERT yang benar-benar dijalankan restoreBackup().

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const CONTROLLER_PATH = path.resolve(
  __dirname,
  '..',
  'src',
  'controllers',
  'backup.controller.js',
);

// Muat controller dengan dependency DB & side-effect diganti stub. Cache
// require dibersihkan tiap kali agar tiap test punya rekaman sendiri.
function loadController({ query, bulkInsert, describeTable, invalidateSettingsCache }) {
  const stubs = {
    '../config/database': {
      transaction: (cb) => cb({ id: 'tx' }),
      getQueryInterface: () => ({
        bulkInsert,
        describeTable: describeTable || (async () => ({})),
      }),
      query,
    },
    '../utils/response': {
      success: (res, payload) => res.status(200).json({ success: true, ...payload }),
      failure: (res, { statusCode, message }) =>
        res.status(statusCode).json({ success: false, message }),
    },
    '../utils/activityLogger': { logActivity: async () => {} },
    '../utils/settingsHelper': { invalidateSettingsCache },
  };

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(CONTROLLER_PATH)];
    return require(CONTROLLER_PATH);
  } finally {
    Module._load = originalLoad;
  }
}

// Res minimal yang merekam status & body respons.
function makeRes() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
  };
}

function runRestore(backup, { query, bulkInsert, describeTable, invalidateSettingsCache }) {
  const deletes = [];
  const inserts = [];
  const controller = loadController({
    query:
      query ||
      (async (sql) => {
        const m = sql.match(/^DELETE FROM "(.+)"$/);
        if (m) deletes.push(m[1]);
        return [[], []];
      }),
    bulkInsert: bulkInsert || (async (table) => inserts.push(table)),
    describeTable,
    invalidateSettingsCache: invalidateSettingsCache || (() => {}),
  });

  const req = {
    file: { buffer: Buffer.from(JSON.stringify(backup), 'utf8'), originalname: 'backup.json' },
    body: { confirm: 'RESTORE' },
    user: { name: 'Tester' },
  };
  const res = makeRes();

  return controller.restoreBackup(req, res).then(() => ({ controller, res, deletes, inserts }));
}

const SAMPLE_BACKUP = {
  meta: { generated_at: '2026-01-01T00:00:00.000Z' },
  data: {
    admin_accounts: [{ id: 'a1', username: 'admin' }],
    users: [{ id: 'u1', nip: '123' }],
    piket_schedules: [{ id: 'p1', user_id: 'u1' }],
    piket_swaps: [
      { id: 's1', piket_schedule_id: 'p1', requester_user_id: 'u1', replacement_user_id: 'u1' },
    ],
  },
};

test('BACKUP_TABLES memuat piket_swaps setelah piket_schedules (urutan FK)', async () => {
  const { controller } = await runRestore(SAMPLE_BACKUP, {});
  assert.ok(
    controller.BACKUP_TABLES.includes('piket_swaps'),
    'BACKUP_TABLES harus memuat piket_swaps',
  );
  assert.ok(
    controller.BACKUP_TABLES.indexOf('piket_swaps') >
      controller.BACKUP_TABLES.indexOf('piket_schedules'),
    'piket_swaps harus setelah piket_schedules agar insert mengikuti FK',
  );
});

test('restore menghapus lalu mengisi ulang piket_swaps pada urutan yang benar', async () => {
  const { res, deletes, inserts } = await runRestore(SAMPLE_BACKUP, {});

  assert.ok(
    deletes.includes('piket_swaps'),
    `piket_swaps harus ikut dihapus; urutan: ${deletes.join(' -> ')}`,
  );
  assert.ok(
    deletes.indexOf('piket_swaps') < deletes.indexOf('piket_schedules'),
    'piket_swaps harus dihapus sebelum piket_schedules agar tidak hilang lewat cascade',
  );
  assert.ok(
    inserts.includes('piket_swaps'),
    `piket_swaps harus dikembalikan; urutan: ${inserts.join(' -> ')}`,
  );
  assert.ok(
    inserts.indexOf('piket_schedules') < inserts.indexOf('piket_swaps'),
    'piket_swaps harus di-insert setelah piket_schedules',
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.restored.piket_swaps, 1);
});

test('restore membatalkan cache system_settings setelah sukses', async () => {
  let invalidations = 0;
  const { res } = await runRestore(SAMPLE_BACKUP, {
    invalidateSettingsCache: () => {
      invalidations += 1;
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(invalidations, 1, 'invalidateSettingsCache harus dipanggil tepat sekali');
});

test('restore backup lawas tanpa piket_swaps tetap berhasil (kompatibilitas)', async () => {
  const legacy = {
    meta: { generated_at: '2025-01-01T00:00:00.000Z' },
    data: {
      admin_accounts: [{ id: 'a1' }],
      piket_schedules: [{ id: 'p1' }],
    },
  };

  const { res, inserts } = await runRestore(legacy, {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.restored.piket_swaps, 0);
  // Tabel tetap dihapus (aman-aman saja) tapi tidak ada yang di-insert.
  assert.ok(!inserts.includes('piket_swaps'));
});

test('restore men-serialisasi kolom JSONB sebelum bulkInsert (tanpa Invalid value)', async () => {
  // Regresi: notifications.data bertipe JSONB dan di backup berupa object.
  // bulkInsert -> SqlString.escape() melempar "Invalid value { ... }" untuk
  // object mentah sehingga seluruh transaksi restore rollback.
  const description = {
    id: { type: 'UUID' },
    user_id: { type: 'UUID' },
    data: { type: 'JSONB' },
    created_at: { type: 'TIMESTAMP WITH TIME ZONE' },
  };
  const notificationRow = {
    id: 'n1',
    user_id: 'u1',
    data: { piketScheduleId: 'p1', tanggal: '2026-10-03' },
    created_at: '2026-09-26T10:43:38.882Z',
  };
  const backup = {
    meta: { generated_at: '2026-01-01T00:00:00.000Z' },
    data: { notifications: [notificationRow] },
  };

  const inserted = {};
  const { res } = await runRestore(backup, {
    describeTable: async (table) => (table === 'notifications' ? description : {}),
    bulkInsert: async (table, rows) => {
      inserted[table] = rows;
    },
  });

  assert.equal(res.statusCode, 200);
  const row = inserted.notifications[0];
  assert.equal(
    typeof row.data,
    'string',
    'nilai kolom JSONB harus string agar SqlString.escape() tidak melempar',
  );
  assert.deepEqual(JSON.parse(row.data), notificationRow.data);
});

test('format backup bisa di-export lalu di-restore (round-trip, JSONB utuh)', async () => {
  const rowsByTable = {
    admin_accounts: [{ id: 'a1', username: 'admin' }],
    users: [{ id: 'u1', nip: '123' }],
    piket_schedules: [{ id: 'p1', user_id: 'u1', tanggal: '2026-10-03' }],
    piket_swaps: [
      { id: 's1', piket_schedule_id: 'p1', requester_user_id: 'u1', replacement_user_id: 'u1' },
    ],
    notifications: [
      {
        id: 'n1',
        user_id: 'u1',
        type: 'piket',
        data: { piketScheduleId: 'p1', tanggal: '2026-10-03' },
      },
    ],
  };

  // 1) EXPORT -> exactly the bytes the admin downloads
  const exportCtrl = loadController({
    query: async (sql) => {
      const m = sql.match(/^SELECT \* FROM "(.+)"$/);
      return [m ? rowsByTable[m[1]] || [] : [], []];
    },
    bulkInsert: async () => {},
    invalidateSettingsCache: () => {},
  });
  const exportRes = makeRes();
  await exportCtrl.exportBackup({ user: { name: 'Tester' } }, exportRes);
  assert.equal(exportRes.statusCode, 200);

  const fileText = exportRes.body; // the downloadable JSON
  const parsed = JSON.parse(fileText);
  assert.equal(parsed.meta.format, 'bumdesma-absensi-backup');
  assert.equal(parsed.meta.version, 2);
  assert.ok(parsed.meta.tables.includes('piket_swaps'), 'export harus memuat piket_swaps');

  // 2) RESTORE the file that was just exported
  const inserted = {};
  const { res } = await runRestore(parsed, {
    describeTable: async (table) => (table === 'notifications' ? { data: { type: 'JSONB' } } : {}),
    bulkInsert: async (table, rows) => {
      inserted[table] = rows;
    },
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.missing_tables, []);
  assert.equal(res.body.data.backup_format_version, 2);

  // piket_swaps must survive the round-trip
  assert.equal(inserted.piket_swaps.length, 1);

  // JSONB must survive the round-trip (stored as string, parses back to the object)
  const notification = inserted.notifications[0];
  assert.equal(typeof notification.data, 'string');
  assert.deepEqual(JSON.parse(notification.data), {
    piketScheduleId: 'p1',
    tanggal: '2026-10-03',
  });
});

test('restore file lama tidak menghapus tabel yang tidak ada di file', async () => {
  const legacy = {
    meta: { format: 'bumdesma-absensi-backup', version: 1, generated_at: '2025-01-01T00:00:00.000Z' },
    data: { admin_accounts: [{ id: 'a1' }], piket_schedules: [{ id: 'p1' }] },
  };

  const { res, deletes } = await runRestore(legacy, {});
  assert.equal(res.statusCode, 200);
  assert.ok(
    !deletes.includes('piket_swaps'),
    'tabel yang tidak ada di file tidak boleh dihapus',
  );
  assert.ok(res.body.data.missing_tables.includes('piket_swaps'));
  assert.equal(res.body.data.restored.piket_swaps, 0);
});

test('restore menolak file dari versi format yang lebih baru', async () => {
  const future = {
    meta: { format: 'bumdesma-absensi-backup', version: 99, generated_at: '2027-01-01T00:00:00.000Z' },
    data: { users: [] },
  };

  const { res } = await runRestore(future, {});
  assert.equal(res.statusCode, 422);
  assert.match(res.body.message, /versi aplikasi yang lebih baru/);
});

test('restore menolak file dengan format yang tidak dikenal', async () => {
  const alien = {
    meta: { format: 'some-other-app-backup', version: 1 },
    data: { users: [] },
  };

  const { res } = await runRestore(alien, {});
  assert.equal(res.statusCode, 422);
  assert.match(res.body.message, /Format file backup tidak dikenali/);
});

test('export membaca seluruh BACKUP_TABLES termasuk piket_swaps', async () => {
  const selected = [];
  const controller = loadController({
    query: async (sql) => {
      const m = sql.match(/^SELECT \* FROM "(.+)"$/);
      if (m) selected.push(m[1]);
      return [[], []];
    },
    bulkInsert: async () => {},
    invalidateSettingsCache: () => {},
  });

  const res = makeRes();
  await controller.exportBackup({ user: { name: 'Tester' } }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(selected.includes('piket_swaps'), 'export harus membaca tabel piket_swaps');
  const body = JSON.parse(res.body);
  assert.ok(body.meta.tables.includes('piket_swaps'));
  assert.ok(Object.prototype.hasOwnProperty.call(body.data, 'piket_swaps'));
});
