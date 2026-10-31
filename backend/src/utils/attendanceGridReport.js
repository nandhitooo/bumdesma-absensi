const ExcelJS = require("exceljs");
const {
  COLOR,
  buildReportContext,
  statusCell,
  timeCell,
  findHoliday,
} = require("./attendanceReportData");

const BRAND_GREEN = "FF1A7A1A";

function applyThinBorder(cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };
}

/**
 * Menulis satu blok grid absensi (judul + header tanggal + baris pegawai)
 * ke worksheet, dimulai dari `startRow`. Dipakai berulang untuk laporan
 * tahunan (satu blok per bulan, digabung dalam satu sheet).
 *
 * @param {'status'|'masuk'|'pulang'} cellMode
 * @returns {number} baris berikutnya yang masih kosong setelah blok ini
 */
function writeBlock(
  sheet,
  startRow,
  {
    title,
    dateList,
    employees,
    attendanceMap,
    leaveJenisMap,
    piketSet,
    holidays,
    cellMode,
  },
) {
  const dayCount = dateList.length;
  const firstDayCol = 3; // kolom C
  const lastDayCol = firstDayCol + dayCount - 1;
  const withTotals = cellMode === "status";
  const totalsStartCol = lastDayCol + 2; // beri 1 kolom jarak
  const TOTAL_COLS = [
    { key: "hadir", label: "Hadir" },
    { key: "terlambat", label: "Terlambat" },
    { key: "izin", label: "Izin" },
    { key: "sakit", label: "Sakit" },
    { key: "cuti", label: "Cuti" },
    { key: "piket", label: "Piket" },
    { key: "alpa", label: "Alpa" },
  ];
  const lastCol = withTotals
    ? totalsStartCol + TOTAL_COLS.length - 1
    : lastDayCol;

  // === Judul blok ===
  const titleRow = startRow;
  sheet.mergeCells(titleRow, 1, titleRow + 1, lastCol);
  const titleCell = sheet.getCell(titleRow, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: BRAND_GREEN } };
  titleCell.alignment = { horizontal: "center", vertical: "center" };

  // === Header (No. / Nama / Tanggal / kolom tanggal / Total) ===
  const headerRow1 = titleRow + 2;
  const headerRow2 = headerRow1 + 1;

  sheet.mergeCells(headerRow1, 1, headerRow2, 1);
  sheet.mergeCells(headerRow1, 2, headerRow2, 2);
  sheet.getCell(headerRow1, 1).value = "No.";
  sheet.getCell(headerRow1, 2).value = "Nama";

  sheet.mergeCells(headerRow1, firstDayCol, headerRow1, lastDayCol);
  sheet.getCell(headerRow1, firstDayCol).value = "Tanggal";

  dateList.forEach((dateStr, idx) => {
    const cell = sheet.getCell(headerRow2, firstDayCol + idx);
    cell.value = Number(dateStr.slice(8, 10));
  });

  if (withTotals) {
    sheet.mergeCells(headerRow1, totalsStartCol, headerRow1, lastCol);
    sheet.getCell(headerRow1, totalsStartCol).value = "Total";
    TOTAL_COLS.forEach((t, idx) => {
      sheet.getCell(headerRow2, totalsStartCol + idx).value = t.label;
    });
  }

  for (let r = headerRow1; r <= headerRow2; r += 1) {
    for (let c = 1; c <= lastCol; c += 1) {
      const cell = sheet.getCell(r, c);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_GREEN },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      applyThinBorder(cell);
    }
  }

  // === Baris data pegawai ===
  const firstDataRow = headerRow2 + 1;

  employees.forEach((emp, empIdx) => {
    const rowIndex = firstDataRow + empIdx;
    const noCell = sheet.getCell(rowIndex, 1);
    noCell.value = empIdx + 1;
    noCell.alignment = { horizontal: "center", vertical: "middle" };
    applyThinBorder(noCell);

    const nameCell = sheet.getCell(rowIndex, 2);
    nameCell.value = emp.name;
    nameCell.font = { bold: true };
    nameCell.alignment = { vertical: "middle" };
    applyThinBorder(nameCell);

    const totals = {
      hadir: 0,
      terlambat: 0,
      izin: 0,
      sakit: 0,
      cuti: 0,
      piket: 0,
      alpa: 0,
    };

    dateList.forEach((dateStr, idx) => {
      const col = firstDayCol + idx;
      const cell = sheet.getCell(rowIndex, col);
      applyThinBorder(cell);
      cell.alignment = { horizontal: "center", vertical: "middle" };

      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const holiday = dayOfWeek === 0 ? null : findHoliday(dateStr, holidays);
      // Sel Minggu/Libur ditangani terpisah di bawah (merge lintas baris),
      // di sini cukup dilewati agar tidak tertimpa.
      if (dayOfWeek === 0 || holiday) return;

      const attRow = attendanceMap.get(`${emp.id}|${dateStr}`);
      const leaveJenis = leaveJenisMap.get(`${emp.id}|${dateStr}`);
      const isPiketDay = piketSet.has(`${emp.id}|${dateStr}`);

      if (cellMode === "status") {
        const result = statusCell({
          attRow,
          leaveJenis,
          dayOfWeek,
          isPiketDay,
        });
        cell.value = result.text || null;
        if (result.fill) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: result.fill },
          };
          cell.font = { bold: true, color: { argb: result.font } };
        }
        if (result.text === "H" && result.font === COLOR.hadir.font)
          totals.hadir += 1;
        if (result.text === "H" && result.font === COLOR.terlambat.font)
          totals.terlambat += 1;
        if (result.text === "I") totals.izin += 1;
        if (result.text === "S") totals.sakit += 1;
        if (result.text === "C") totals.cuti += 1;
        if (result.text === "P") totals.piket += 1;
        if (result.text === "-") totals.alpa += 1;
      } else {
        const field = cellMode === "masuk" ? "jam_masuk" : "jam_pulang";
        const result = timeCell({ attRow, field });
        cell.value = result.text || null;
        if (result.fill) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: result.fill },
          };
          cell.font = { color: { argb: result.font } };
        }
      }
    });

    if (withTotals) {
      const values = [
        totals.hadir,
        totals.terlambat,
        totals.izin,
        totals.sakit,
        totals.cuti,
        totals.piket,
        totals.alpa,
      ];
      values.forEach((v, idx) => {
        const cell = sheet.getCell(rowIndex, totalsStartCol + idx);
        cell.value = v;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { bold: true };
        applyThinBorder(cell);
      });
    }
  });

  const lastDataRow = firstDataRow + employees.length - 1;

  // === Kolom Minggu/Libur - merge vertikal lintas seluruh baris pegawai ===
  if (employees.length > 0) {
    dateList.forEach((dateStr, idx) => {
      const col = firstDayCol + idx;
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const holiday = dayOfWeek === 0 ? null : findHoliday(dateStr, holidays);
      if (!(dayOfWeek === 0 || holiday)) return;

      sheet.mergeCells(firstDataRow, col, lastDataRow, col);
      const cell = sheet.getCell(firstDataRow, col);
      cell.value =
        dayOfWeek === 0
          ? "Minggu"
          : `Libur${holiday.keterangan ? " - " + holiday.keterangan : ""}`;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR.liburMinggu.fill },
      };
      cell.font = { bold: true, color: { argb: COLOR.liburMinggu.font } };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        textRotation: 180,
        wrapText: true,
      };
      applyThinBorder(cell);
    });
  }

  // Baris kosong pemisah sebelum blok berikutnya (untuk laporan tahunan)
  return lastDataRow + 3;
}

function setupSheet(sheet, dayCount, withTotals) {
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 22;
  for (let i = 0; i < dayCount; i += 1) {
    sheet.getColumn(3 + i).width = 4.5;
  }
  if (withTotals) {
    for (let i = 0; i < 7; i += 1) {
      sheet.getColumn(3 + dayCount + 1 + i).width = 9;
    }
  }
  sheet.views = [{ state: "frozen", xSplit: 2 }];
}

/**
 * Membangun workbook laporan absensi dengan 3 sheet: Daftar Hadir (kode
 * status H/P/I/S/C/-/Minggu/Libur), Jam Masuk, dan Jam Pulang - meniru
 * format kalender bulanan pada Book1.xlsx.
 *
 * Untuk periodType 'tahunan', setiap sheet berisi 12 blok bulan (Januari -
 * Desember) yang digabung berurutan ke bawah dalam satu sheet yang sama.
 * Untuk periodType lain, setiap sheet berisi satu blok sesuai rentang
 * tanggal yang diminta (satu bulan penuh untuk 'bulanan', atau persis
 * rentang tanggal yang dipilih untuk 'harian'/'mingguan'/rentang bebas).
 */
async function buildAttendanceGridWorkbook({ start, end, userId, periodType }) {
  const {
    blocks,
    employees,
    attendanceMap,
    leaveJenisMap,
    piketSet,
    holidays,
  } = await buildReportContext({ start, end, userId, periodType });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistem Absensi BUMDESMA Podo Rukun LKD";
  workbook.created = new Date();

  const sheetDefs = [
    { name: "Daftar Hadir", cellMode: "status" },
    { name: "Jam Masuk", cellMode: "masuk" },
    { name: "Jam Pulang", cellMode: "pulang" },
  ];

  sheetDefs.forEach(({ name, cellMode }) => {
    const sheet = workbook.addWorksheet(name, {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    const maxDayCount = Math.max(...blocks.map((b) => b.dateList.length), 0);
    setupSheet(sheet, maxDayCount, cellMode === "status");

    // Legenda kode, ditulis sekali di baris paling atas sheet, sebelum blok pertama.
    sheet.getCell(1, 1).value = "Keterangan:";
    sheet.getCell(1, 1).font = { bold: true };
    sheet.getCell(2, 1).value =
      cellMode === "status"
        ? "H = Hadir, P = Piket, I = Izin, S = Sakit, C = Cuti, - = Tidak Absen (Alpa)"
        : "Sel kosong berarti pegawai tidak memiliki catatan pada tanggal tersebut (libur, alpa, atau izin/cuti).";
    sheet.getCell(2, 1).font = {
      italic: true,
      size: 9,
      color: { argb: "FF6B7280" },
    };

    let cursorRow = 4;
    blocks.forEach((block) => {
      cursorRow = writeBlock(sheet, cursorRow, {
        title: block.title,
        dateList: block.dateList,
        employees,
        attendanceMap,
        leaveJenisMap,
        piketSet,
        holidays,
        cellMode,
      });
    });
  });

  return workbook;
}

module.exports = { buildAttendanceGridWorkbook };
