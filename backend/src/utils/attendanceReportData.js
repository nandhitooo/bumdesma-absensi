const { Op } = require("sequelize");
const { User, Attendance, Leave, PiketSchedule } = require("../models");
const { getSettingsMap } = require("./settingsHelper");

// === Warna kode status, dipakai baik oleh export Excel (ARGB) maupun PDF
// (diturunkan dari ARGB yang sama, lihat toPdfColor()) supaya kedua format
// selalu konsisten secara visual. ===
const COLOR = {
  hadir: { fill: "FFDCFCE7", font: "FF15803D" }, // hijau - tepat waktu
  terlambat: { fill: "FFFFEDD5", font: "FFC2410C" }, // oranye
  alpa: { fill: "FFFEE2E2", font: "FFDC2626" }, // merah
  izin: { fill: "FFDBEAFE", font: "FF1D4ED8" }, // biru
  sakit: { fill: "FFFCE7F3", font: "FFBE185D" }, // pink
  cuti: { fill: "FFEDE9FE", font: "FF6D28D9" }, // ungu
  piket: { fill: "FFE0E7FF", font: "FF4338CA" }, // indigo
  liburMinggu: { fill: "FFFF4040", font: "FFFFFFFF" }, // merah terang (Minggu/Libur)
};

// Konversi warna ARGB (dipakai ExcelJS, mis. "FFDCFCE7") menjadi hex RGB
// biasa untuk PDFKit (mis. "#DCFCE7").
function toPdfColor(argb) {
  if (!argb) return null;
  return `#${argb.slice(2)}`;
}

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year, month) {
  // month: 1-12
  return new Date(year, month, 0).getDate();
}

function isoDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDaysISO(dateStr, amount) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + amount);
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function formatDateLong(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toTimeString().slice(0, 5);
}

// Menormalisasi entri system_settings.national_holidays. Mendukung dua
// format: string tanggal tunggal (format lama) dan objek rentang tanggal
// { tanggal_mulai, tanggal_selesai, keterangan } (format baru), sama seperti
// isNationalHoliday() pada attendance.controller.js.
function normalizeHolidays(raw) {
  let list;
  try {
    list = typeof raw === "string" ? JSON.parse(raw) : raw || [];
  } catch {
    list = [];
  }
  return list
    .map((h) => {
      if (typeof h === "string") return { start: h, end: h, keterangan: "" };
      const start = h.tanggal_mulai ?? h.start;
      const end = h.tanggal_selesai ?? h.end ?? start;
      return { start, end, keterangan: h.keterangan || "" };
    })
    .filter((h) => h.start);
}

function findHoliday(dateStr, holidays) {
  return holidays.find((h) => dateStr >= h.start && dateStr <= h.end) || null;
}

function buildRangeDateList(start, end) {
  const dates = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 2000) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }
  return dates;
}

// === Pengambilan data dari database untuk seluruh rentang laporan sekaligus,
// supaya tidak perlu query berulang per bulan pada laporan tahunan ===
async function loadReportData({ overallStart, overallEnd, userId }) {
  const employees = await User.findAll({
    where: userId ? { id: userId } : { status: "active" },
    order: [["name", "ASC"]],
  });
  const userIds = employees.map((e) => e.id);

  const attendanceMap = new Map(); // key: `${userId}|${tanggal}` -> row
  const leaveJenisMap = new Map(); // key: `${userId}|${tanggal}` -> 'izin'|'sakit'|'cuti'
  const piketSet = new Set(); // key: `${userId}|${tanggal}`

  if (userIds.length > 0) {
    const attendances = await Attendance.findAll({
      where: {
        user_id: { [Op.in]: userIds },
        tanggal: { [Op.between]: [overallStart, overallEnd] },
      },
    });
    for (const a of attendances) {
      attendanceMap.set(`${a.user_id}|${a.tanggal}`, a);
    }

    const leaves = await Leave.findAll({
      where: {
        user_id: { [Op.in]: userIds },
        status: "approved",
        tanggal_mulai: { [Op.lte]: overallEnd },
        tanggal_selesai: { [Op.gte]: overallStart },
      },
    });
    for (const l of leaves) {
      const from =
        l.tanggal_mulai > overallStart ? l.tanggal_mulai : overallStart;
      const to =
        l.tanggal_selesai < overallEnd ? l.tanggal_selesai : overallEnd;
      let cursor = from;
      // Batas pengaman supaya tidak looping tak terkendali jika data tidak wajar
      let guard = 0;
      while (cursor <= to && guard < 1000) {
        leaveJenisMap.set(`${l.user_id}|${cursor}`, l.jenis);
        cursor = addDaysISO(cursor, 1);
        guard += 1;
      }
    }

    const piketRows = await PiketSchedule.findAll({
      where: {
        user_id: { [Op.in]: userIds },
        tanggal: { [Op.between]: [overallStart, overallEnd] },
      },
    });
    for (const p of piketRows) {
      piketSet.add(`${p.user_id}|${p.tanggal}`);
    }
  }

  const settings = await getSettingsMap();
  const holidays = normalizeHolidays(settings.national_holidays);

  return { employees, attendanceMap, leaveJenisMap, piketSet, holidays };
}

// Menentukan isi & warna satu sel untuk grid "Daftar Hadir" (kode status)
function statusCell({ attRow, leaveJenis, dayOfWeek, isPiketDay }) {
  if (attRow) {
    if (attRow.status === "izin_cuti") {
      if (leaveJenis === "sakit") return { text: "S", ...COLOR.sakit };
      if (leaveJenis === "cuti") return { text: "C", ...COLOR.cuti };
      return { text: "I", ...COLOR.izin };
    }
    if (attRow.status === "terlambat") return { text: "H", ...COLOR.terlambat };
    if (attRow.status === "tepat_waktu") return { text: "H", ...COLOR.hadir };
    if (attRow.status === "alpa") return { text: "-", ...COLOR.alpa };
    return { text: "H", ...COLOR.hadir };
  }

  if (dayOfWeek === 6) {
    // Sabtu: hanya pegawai piket yang punya kewajiban hadir
    if (isPiketDay) return { text: "P", ...COLOR.piket };
    return { text: "", fill: null, font: null };
  }

  // Senin-Jumat tanpa catatan absensi -> Alpa
  return { text: "-", ...COLOR.alpa };
}

// Menentukan isi sel untuk grid "Jam Masuk" / "Jam Pulang"
function timeCell({ attRow, field }) {
  if (!attRow) return { text: "" };
  const value = attRow[field];
  if (!value) return { text: "" };
  if (field === "jam_masuk") {
    if (attRow.status === "terlambat")
      return { text: formatTime(value), ...COLOR.terlambat };
    return { text: formatTime(value), ...COLOR.hadir };
  }
  // jam_pulang
  if (attRow.checkout_status === "lembur")
    return { text: formatTime(value), ...COLOR.izin };
  return { text: formatTime(value), ...COLOR.hadir };
}

/**
 * Menyiapkan seluruh konteks yang dibutuhkan untuk membangun laporan
 * (Excel maupun PDF): daftar blok (satu blok = satu bulan atau satu rentang
 * tanggal bebas) beserta seluruh data absensi/izin/piket/libur yang
 * relevan, diambil sekali saja dari database.
 */
async function buildReportContext({ start, end, userId, periodType }) {
  const isTahunan = periodType === "tahunan";
  const year = Number(start.slice(0, 4));

  const overallStart = isTahunan ? `${year}-01-01` : start;
  const overallEnd = isTahunan ? `${year}-12-31` : end;

  const { employees, attendanceMap, leaveJenisMap, piketSet, holidays } =
    await loadReportData({
      overallStart,
      overallEnd,
      userId,
    });

  let blocks;
  if (isTahunan) {
    blocks = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const dateList = Array.from(
        { length: daysInMonth(year, month) },
        (_, d) => isoDate(year, month, d + 1),
      );
      return { title: `${MONTH_NAMES_ID[i]} ${year}`, dateList };
    });
  } else if (periodType === "bulanan") {
    // Satu blok kalender penuh untuk bulan yang dipilih, judul "Bulan Tahun"
    // sama seperti format Book1.xlsx (start/end dari frontend sudah berupa
    // tanggal 1 s/d akhir bulan yang sama).
    const month = Number(start.slice(5, 7));
    const dateList = Array.from({ length: daysInMonth(year, month) }, (_, d) =>
      isoDate(year, month, d + 1),
    );
    blocks = [{ title: `${MONTH_NAMES_ID[month - 1]} ${year}`, dateList }];
  } else {
    const dateList = buildRangeDateList(start, end);
    const title =
      start === end
        ? formatDateLong(start)
        : `${formatDateShort(start)} s/d ${formatDateShort(end)}`;
    blocks = [{ title, dateList }];
  }

  return {
    blocks,
    employees,
    attendanceMap,
    leaveJenisMap,
    piketSet,
    holidays,
  };
}

module.exports = {
  COLOR,
  toPdfColor,
  MONTH_NAMES_ID,
  pad2,
  daysInMonth,
  isoDate,
  addDaysISO,
  formatDateLong,
  formatDateShort,
  formatTime,
  normalizeHolidays,
  findHoliday,
  buildRangeDateList,
  loadReportData,
  statusCell,
  timeCell,
  buildReportContext,
};
