'use strict';

// Uji logika murni giliran (cycle) piket. Tidak menyentuh database: semua fungsi
// yang diuji di sini hanya beroperasi pada tanggal & daftar anggota.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const rotation = require('../src/utils/piketRotation');

// 2026-10-03 adalah hari Sabtu; Sabtu berikutnya: 10, 17, 24, 31.
const SABTU = '2026-10-03';
const SABTU_2 = '2026-10-10';
const SABTU_3 = '2026-10-17';
const SABTU_5 = '2026-10-31';

const members = (...names) => names.map((name, i) => ({ user_id: `u${i}`, name, position: i }));

test('isSaturday & firstSaturdayOnOrAfter', () => {
  assert.equal(rotation.isSaturday(SABTU), true);
  assert.equal(rotation.isSaturday('2026-10-05'), false); // Senin
  assert.equal(rotation.isSaturday('bukan-tanggal'), false);
  assert.equal(rotation.firstSaturdayOnOrAfter('2026-10-05'), SABTU_2);
  assert.equal(rotation.firstSaturdayOnOrAfter(SABTU), SABTU); // sudah Sabtu
});

test('weekIndex menghitung pekan antar Sabtu', () => {
  assert.equal(rotation.weekIndex(SABTU, SABTU), 0);
  assert.equal(rotation.weekIndex(SABTU, SABTU_2), 1);
  assert.equal(rotation.weekIndex(SABTU, SABTU_5), 4);
});

test('saturdaysBetween mengembalikan Sabtu inklusif', () => {
  assert.deepEqual(rotation.saturdaysBetween(SABTU, SABTU_3), [SABTU, SABTU_2, SABTU_3]);
  assert.deepEqual(rotation.saturdaysBetween(SABTU, SABTU), [SABTU]);
  // rentang terbalik / bukan Sabtu -> kosong, bukan error
  assert.deepEqual(rotation.saturdaysBetween(SABTU_3, SABTU), []);
  assert.deepEqual(rotation.saturdaysBetween('2026-10-05', SABTU_3), []);
});

test('assigneesForWeek memutar daftar dan tidak mengulang orang di Sabtu yang sama', () => {
  const list = members('A', 'B', 'C', 'D');

  assert.deepEqual(
    rotation.assigneesForWeek({ members: list, perSabtu: 2, weekIndex: 0 }).map((m) => m.name),
    ['A', 'B']
  );
  assert.deepEqual(
    rotation.assigneesForWeek({ members: list, perSabtu: 2, weekIndex: 1 }).map((m) => m.name),
    ['C', 'D']
  );
  // lingkaran kembali ke awal
  assert.deepEqual(
    rotation.assigneesForWeek({ members: list, perSabtu: 2, weekIndex: 2 }).map((m) => m.name),
    ['A', 'B']
  );

  // perSabtu lebih besar dari jumlah anggota -> dibatasi, tanpa duplikat
  const picked = rotation.assigneesForWeek({ members: list, perSabtu: 9, weekIndex: 0 });
  assert.equal(picked.length, list.length);
  assert.equal(new Set(picked.map((m) => m.user_id)).size, list.length);

  // daftar kosong
  assert.deepEqual(rotation.assigneesForWeek({ members: [], perSabtu: 1, weekIndex: 0 }), []);
});

test('buildRotationPlan menentukan giliran tiap Sabtu secara deterministik', () => {
  const list = members('A', 'B', 'C', 'D');
  const plan = rotation.buildRotationPlan({
    start: SABTU,
    from: SABTU,
    until: SABTU_3,
    members: list,
    perSabtu: 2,
  });

  assert.deepEqual(
    plan.map((p) => ({ tanggal: p.tanggal, who: p.members.map((m) => m.name) })),
    [
      { tanggal: SABTU, who: ['A', 'B'] },
      { tanggal: SABTU_2, who: ['C', 'D'] },
      { tanggal: SABTU_3, who: ['A', 'B'] },
    ]
  );

  // idempotent: input sama -> hasil sama
  const again = rotation.buildRotationPlan({
    start: SABTU,
    from: SABTU,
    until: SABTU_3,
    members: list,
    perSabtu: 2,
  });
  assert.deepEqual(again, plan);
});

test('buildRotationPlan tidak membuat jadwal sebelum tanggal mulai siklus', () => {
  const list = members('A', 'B');
  const plan = rotation.buildRotationPlan({
    start: SABTU, // siklus mulai 3 Oktober
    from: '2026-09-19', // diminta mundur ke September
    until: SABTU_2,
    members: list,
    perSabtu: 1,
  });

  assert.deepEqual(plan.map((p) => p.tanggal), [SABTU, SABTU_2]);
  assert.ok(plan.every((p) => p.tanggal >= SABTU));
});

test('buildRotationPlan menolak tanggal mulai yang bukan Sabtu', () => {
  assert.throws(
    () => rotation.buildRotationPlan({ start: '2026-10-05', from: SABTU, until: SABTU_2, members: [], perSabtu: 1 }),
    (err) => err instanceof rotation.RotationError && /Sabtu/.test(err.message)
  );
});

test('rotasi penuh satu putaran tidak menugaskan orang yang sama dua kali berturut', () => {
  const list = members('A', 'B', 'C');
  const seen = [];
  for (let w = 0; w < 3; w += 1) {
    const picked = rotation.assigneesForWeek({ members: list, perSabtu: 1, weekIndex: w });
    seen.push(picked[0].name);
  }
  assert.deepEqual(seen, ['A', 'B', 'C']);
});
