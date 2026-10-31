const { Op } = require('sequelize');
const { PiketSchedule, PiketRotationMember, User } = require('../models');
const { getSettingsMap, setSetting } = require('./settingsHelper');
const { notifyUser } = require('./notifier');
const { NOTIFICATION_TYPE, USER_STATUS } = require('./constants');

// ─────────────────────────────────────────────────────────────────────────────
// Fitur giliran (cycle) piket Sabtu.
//
// Model rotasi: daftar pegawai terurut (piket_rotation_members.position). Tiap
// Sabtu diambil `perSabtu` anggota berikutnya secara MELINGKAR, dihitung dari
// `start` (Sabtu pertama siklus):
//
//     minggu ke-w  ->  mulai index = (w * perSabtu) % jumlahAnggota
//
// Posisi dihitung dari `start`, bukan dari cursor yang disimpan, sehingga
// generate bersifat IDEMPOTENT: menjalankan ulang untuk tanggal yang sama
// menghasilkan susunan yang sama, dan unique index (user_id, tanggal) membuat
// baris yang sudah ada tidak terduplikasi.
// ─────────────────────────────────────────────────────────────────────────────

const ROTATION_KEYS = Object.freeze({
  ENABLED: 'piket_rotation_enabled',
  START: 'piket_rotation_start',
  PER_SABTU: 'piket_rotation_per_sabtu',
  WEEKS_AHEAD: 'piket_rotation_weeks_ahead',
});

const ROTATION_DEFAULTS = Object.freeze({
  enabled: false,
  perSabtu: 1,
  weeksAhead: 4,
});

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Error dengan statusCode supaya controller bisa meneruskannya apa adanya. */
class RotationError extends Error {
  constructor(message, statusCode = 422) {
    super(message);
    this.name = 'RotationError';
    this.statusCode = statusCode;
  }
}

// ── Helper tanggal (lokal, mengikuti konvensi assign() di piket.controller) ──

function toDate(dateOnly) {
  return new Date(`${dateOnly}T00:00:00`);
}

function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayDateOnly(now = new Date()) {
  return toDateOnly(now);
}

function isDateOnly(value) {
  return typeof value === 'string' && DATE_ONLY_RE.test(value) && !Number.isNaN(toDate(value).getTime());
}

/** Piket hanya hari Sabtu (0=Minggu ... 6=Sabtu). */
function isSaturday(dateOnly) {
  return isDateOnly(dateOnly) && toDate(dateOnly).getDay() === 6;
}

function addDays(dateOnly, days) {
  const d = toDate(dateOnly);
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

/** Sabtu pertama pada/ setelah `dateOnly`. */
function firstSaturdayOnOrAfter(dateOnly) {
  let cursor = dateOnly;
  while (!isSaturday(cursor)) cursor = addDays(cursor, 1);
  return cursor;
}

/** Jumlah pekan (Sabtu) dari `start` ke `tanggal`; 0 kalau sama. */
function weekIndex(start, tanggal) {
  const diff = toDate(tanggal).getTime() - toDate(start).getTime();
  return Math.round(diff / (7 * DAY_MS));
}

/** Daftar Sabtu dari `from` sampai `to` (inklusif). Keduanya harus Sabtu. */
function saturdaysBetween(from, to) {
  if (!isSaturday(from) || !isSaturday(to) || to < from) return [];
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 7)) out.push(d);
  return out;
}

/**
 * Anggota yang piket pada minggu ke-`weekIndex`.
 * Mengembalikan array `perSabtu` anggota berurutan melingkar. `perSabtu`
 * dibatasi jumlah anggota supaya satu Sabtu tidak mengambil orang yang sama
 * dua kali (unique index (user_id, tanggal) akan menolaknya).
 */
function assigneesForWeek({ members, perSabtu, weekIndex: w }) {
  const n = members.length;
  if (n === 0) return [];
  const take = Math.min(Math.max(perSabtu, 1), n);
  const base = (((w * take) % n) + n) % n; // modulo aman untuk w negatif
  const picked = [];
  for (let i = 0; i < take; i += 1) picked.push(members[(base + i) % n]);
  return picked;
}

/**
 * Susun rencana giliran tanpa menyentuh database (mudah diuji).
 * `members` harus sudah terurut sesuai posisi giliran.
 */
function buildRotationPlan({ start, from, until, members, perSabtu }) {
  if (!isSaturday(start)) {
    throw new RotationError('Tanggal mulai giliran harus hari Sabtu.');
  }
  const windowFrom = isSaturday(from) ? from : firstSaturdayOnOrAfter(from);
  const end = until == null ? windowFrom : until;
  if (!isSaturday(end)) throw new RotationError('Batas akhir giliran harus hari Sabtu.');

  // Jangan pernah membuat jadwal sebelum `start` (itu bukan bagian siklus).
  const effectiveFrom = windowFrom < start ? start : windowFrom;
  if (end < effectiveFrom) return [];

  return saturdaysBetween(effectiveFrom, end).map((tanggal) => ({
    tanggal,
    weekIndex: weekIndex(start, tanggal),
    members: assigneesForWeek({ members, perSabtu, weekIndex: weekIndex(start, tanggal) }),
  }));
}

// ── Konfigurasi (disimpan di system_settings) ────────────────────────────────

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

async function getRotationConfig() {
  const map = await getSettingsMap();
  const start = isDateOnly(map[ROTATION_KEYS.START]) ? map[ROTATION_KEYS.START] : null;
  return {
    enabled: String(map[ROTATION_KEYS.ENABLED] ?? 'false') === 'true',
    start,
    perSabtu: toPositiveInt(map[ROTATION_KEYS.PER_SABTU], ROTATION_DEFAULTS.perSabtu),
    weeksAhead: toPositiveInt(map[ROTATION_KEYS.WEEKS_AHEAD], ROTATION_DEFAULTS.weeksAhead),
  };
}

async function saveRotationConfig({ enabled, start, perSabtu, weeksAhead }) {
  if (enabled !== undefined) {
    await setSetting(ROTATION_KEYS.ENABLED, enabled ? 'true' : 'false', 'Aktifkan giliran piket otomatis');
  }
  if (start !== undefined) {
    if (!start) {
      await setSetting(ROTATION_KEYS.START, '', 'Sabtu pertama siklus giliran piket (YYYY-MM-DD)');
    } else {
      if (!isSaturday(start)) throw new RotationError('Tanggal mulai giliran harus hari Sabtu.');
      await setSetting(ROTATION_KEYS.START, start, 'Sabtu pertama siklus giliran piket (YYYY-MM-DD)');
    }
  }
  if (perSabtu !== undefined) {
    const n = Number(perSabtu);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      throw new RotationError('Jumlah pegawai per Sabtu harus 1-20.');
    }
    await setSetting(ROTATION_KEYS.PER_SABTU, String(Math.floor(n)), 'Jumlah pegawai piket per Sabtu (giliran)');
  }
  if (weeksAhead !== undefined) {
    const n = Number(weeksAhead);
    if (!Number.isFinite(n) || n < 1 || n > 52) {
      throw new RotationError('Jumlah pekan ke depan harus 1-52.');
    }
    await setSetting(ROTATION_KEYS.WEEKS_AHEAD, String(Math.floor(n)), 'Berapa pekan ke depan jadwal giliran dibuat');
  }
  return getRotationConfig();
}

// ── Anggota giliran ──────────────────────────────────────────────────────────

async function listMembers() {
  return PiketRotationMember.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'nip', 'name', 'status'] }],
    order: [['position', 'ASC']],
  });
}

/**
 * Ganti seluruh daftar giliran dengan urutan `userIds` (index = position).
 * Dijalankan dalam satu transaksi supaya daftar tidak pernah setengah jadi.
 */
async function setMembers(userIds) {
  if (!Array.isArray(userIds)) {
    throw new RotationError('userIds (array) wajib diisi.');
  }
  const unique = [...new Set(userIds)];

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalid = unique.filter((id) => typeof id !== 'string' || !UUID_RE.test(id));
  if (invalid.length > 0) {
    throw new RotationError(`Daftar userIds berisi ID yang tidak valid: ${invalid.join(', ')}`);
  }

  if (unique.length > 0) {
    const users = await User.findAll({
      where: { id: { [Op.in]: unique }, status: USER_STATUS.ACTIVE },
      attributes: ['id'],
    });
    const activeIds = new Set(users.map((u) => u.id));
    const notActive = unique.filter((id) => !activeIds.has(id));
    if (notActive.length > 0) {
      throw new RotationError(`Pegawai tidak ditemukan atau tidak aktif: ${notActive.join(', ')}`);
    }
  }

  await PiketSchedule.sequelize.transaction(async (t) => {
    await PiketRotationMember.destroy({ where: {}, transaction: t });
    if (unique.length > 0) {
      await PiketRotationMember.bulkCreate(
        unique.map((userId, index) => ({ user_id: userId, position: index })),
        { transaction: t }
      );
    }
  });

  return listMembers();
}

// ── Rencana & generate ───────────────────────────────────────────────────────

async function buildPlanForConfig(config, { from, sampai } = {}) {
  const members = (await listMembers()).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    position: m.position,
    name: m.user ? m.user.name : null,
    nip: m.user ? m.user.nip : null,
  }));

  const today = todayDateOnly();
  const start = config.start || firstSaturdayOnOrAfter(today);
  const windowFrom = from || firstSaturdayOnOrAfter(today);
  const until = sampai || addDays(windowFrom, 7 * config.weeksAhead);

  return { members, start, windowFrom, until };
}

/**
 * Pratinjau giliran mendatang tanpa menyimpan apa pun (dipakai UI).
 */
async function previewRotation({ weeks } = {}) {
  const config = await getRotationConfig();
  const today = todayDateOnly();
  const from = firstSaturdayOnOrAfter(today);
  const weeksCount = toPositiveInt(weeks, config.weeksAhead);
  const until = addDays(from, 7 * weeksCount);

  const { members, start } = await buildPlanForConfig(config, { from, sampai: until });
  const plan = buildRotationPlan({ start, from, until, members, perSabtu: config.perSabtu });

  return {
    enabled: config.enabled,
    start: config.start,
    perSabtu: config.perSabtu,
    weeksAhead: config.weeksAhead,
    members,
    plan: plan.map((p) => ({
      tanggal: p.tanggal,
      weekIndex: p.weekIndex,
      members: p.members.map((m) => ({ user_id: m.user_id, name: m.name, nip: m.nip })),
    })),
  };
}

/**
 * Buat jadwal giliran (otomatis tersimpan) dan kirim notifikasi ke pegawai
 * yang BARU terjadwal. Idempotent: baris yang sudah ada tidak dibuat/dinotifikasi
 * ulang, dan jadwal manual Admin tidak tertimpa.
 */
async function generateRotation({ sampai, actorId = null } = {}) {
  const config = await getRotationConfig();
  const { members, start, windowFrom, until } = await buildPlanForConfig(config, { sampai });

  if (members.length === 0) {
    throw new RotationError('Daftar pegawai giliran masih kosong. Tambahkan pegawai dulu.');
  }

  const plan = buildRotationPlan({
    start,
    from: windowFrom,
    until,
    members,
    perSabtu: config.perSabtu,
  });

  if (plan.length === 0) {
    return { start, saturdays: [], created: 0, notified: 0 };
  }

  const firstTanggal = plan[0].tanggal;
  const lastTanggal = plan[plan.length - 1].tanggal;
  const planned = plan.flatMap((p) => p.members.map((m) => ({ tanggal: p.tanggal, user_id: m.user_id })));

  // Baris yang sudah ada (manual maupun giliran sebelumnya) tidak diganggu.
  const existing = await PiketSchedule.findAll({
    where: { tanggal: { [Op.between]: [firstTanggal, lastTanggal] } },
    attributes: ['tanggal', 'user_id'],
  });
  const existingKeys = new Set(existing.map((r) => `${r.tanggal}|${r.user_id}`));
  const toCreate = planned.filter((p) => !existingKeys.has(`${p.tanggal}|${p.user_id}`));

  let created = [];
  if (toCreate.length > 0) {
    // ignoreDuplicates: aman terhadap unique index (user_id, tanggal) dan
    // terhadap top-up yang berjalan bersamaan.
    await PiketSchedule.bulkCreate(
      toCreate.map((row) => ({
        user_id: row.user_id,
        tanggal: row.tanggal,
        assigned_by: actorId,
        source: 'rotation',
      })),
      { ignoreDuplicates: true }
    );

    created = await PiketSchedule.findAll({
      where: {
        tanggal: { [Op.between]: [firstTanggal, lastTanggal] },
        user_id: { [Op.in]: [...new Set(toCreate.map((r) => r.user_id))] },
        source: 'rotation',
      },
      order: [['tanggal', 'ASC']],
    });
  }

  const notified = await notifyRotationAssignees(created, actorId);

  return {
    start,
    saturdays: plan.map((p) => ({
      tanggal: p.tanggal,
      members: p.members.map((m) => ({ user_id: m.user_id, name: m.name })),
    })),
    created: created.length,
    notified,
  };
}

/**
 * Kirim notifikasi "Jadwal Piket Sabtu" untuk baris giliran yang belum
 * terkirim. Mengikuti kontrak assign(): kegagalan push tidak pernah
 * menggagalkan request.
 */
async function notifyRotationAssignees(rows, actorId) {
  const pending = rows.filter((row) => !row.notification_sent);
  let sent = 0;

  for (const row of pending) {
    const tanggalFormatted = toDate(row.tanggal).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    try {
      await notifyUser({
        userId: row.user_id,
        type: NOTIFICATION_TYPE.PIKET,
        title: 'Jadwal Piket Sabtu',
        message: `Anda ditugaskan piket pada ${tanggalFormatted}. Mohon hadir sesuai jadwal.`,
        data: { piketScheduleId: row.id, tanggal: row.tanggal },
        sentBy: actorId,
      });
      row.notification_sent = true;
      await row.save();
      sent += 1;
    } catch (err) {
      console.error('[piket-rotation] Gagal mengirim notifikasi giliran:', err && err.message ? err.message : err);
    }
  }

  return sent;
}

/**
 * Dipanggil berkala oleh server.js: isi jadwal giliran kalau fiturnya aktif.
 * Tidak melakukan apa pun kalau dinonaktifkan, supaya aman dipanggil sering.
 */
async function runRotationTopUp() {
  const config = await getRotationConfig();
  if (!config.enabled) return { skipped: true, reason: 'disabled' };
  return generateRotation({});
}

module.exports = {
  ROTATION_KEYS,
  ROTATION_DEFAULTS,
  RotationError,
  // murni (dipakai test)
  isSaturday,
  firstSaturdayOnOrAfter,
  addDays,
  weekIndex,
  saturdaysBetween,
  assigneesForWeek,
  buildRotationPlan,
  todayDateOnly,
  // butuh database
  getRotationConfig,
  saveRotationConfig,
  listMembers,
  setMembers,
  previewRotation,
  generateRotation,
  runRotationTopUp,
};
