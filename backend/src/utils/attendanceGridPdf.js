const PDFDocument = require("pdfkit");
const {
  COLOR,
  toPdfColor,
  buildReportContext,
  statusCell,
  timeCell,
  findHoliday,
} = require("./attendanceReportData");

const BRAND_GREEN = "#1A7A1A";
const BORDER_COLOR = "#D1D5DB";
const HEADER_TEXT = "#FFFFFF";

const PAGE_MARGIN = 24;
const ROW_HEIGHT = 16;
const HEADER_ROW_HEIGHT = 18;
const TITLE_HEIGHT = 22;
const NO_COL_WIDTH = 22;
const NAME_COL_WIDTH = 100;
const TOTAL_COL_WIDTH = 34;
const TOTAL_COLS = [
  { key: "hadir", label: "Hadir" },
  { key: "terlambat", label: "Telat" },
  { key: "izin", label: "Izin" },
  { key: "sakit", label: "Sakit" },
  { key: "cuti", label: "Cuti" },
  { key: "piket", label: "Piket" },
  { key: "alpa", label: "Alpa" },
];

function drawCellBorder(doc, x, y, w, h) {
  doc.rect(x, y, w, h).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
}

function drawFilledCell(
  doc,
  x,
  y,
  w,
  h,
  {
    text,
    fill,
    font,
    fontSize = 7,
    bold = false,
    align = "center",
    rotate = false,
  },
) {
  if (fill) {
    doc
      .rect(x, y, w, h)
      .fillColor(toPdfColor(fill) || "#FFFFFF")
      .fill();
  }
  drawCellBorder(doc, x, y, w, h);
  if (text) {
    doc.fillColor(font ? toPdfColor(font) : "#111827");
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
    if (rotate) {
      doc.save();
      doc.translate(x + w / 2, y + h / 2);
      doc.rotate(-90);
      doc.text(text, -h / 2 + 2, -3, { width: h - 4, align: "center" });
      doc.restore();
    } else {
      doc.text(text, x + 1, y + h / 2 - fontSize / 2 - 1, {
        width: w - 2,
        align,
      });
    }
  }
  doc.fillColor("#111827");
}

/**
 * Menghitung berapa banyak baris pegawai yang muat dalam satu "halaman" PDF
 * (dipakai untuk memecah blok jadi beberapa halaman kalau jumlah pegawai
 * banyak, dengan header tanggal diulang di setiap halaman lanjutan).
 */
function computeRowsPerPage(doc, isFirstChunkOfBlock) {
  const usableHeight = doc.page.height - PAGE_MARGIN * 2;
  const headHeight =
    (isFirstChunkOfBlock ? TITLE_HEIGHT : 0) + HEADER_ROW_HEIGHT * 2 + 6;
  return Math.max(1, Math.floor((usableHeight - headHeight) / ROW_HEIGHT));
}

/**
 * Menggambar satu "halaman" dari sebuah blok (satu bulan / satu rentang
 * tanggal), untuk subset pegawai tertentu (chunk). Struktur & warna sel
 * meniru grid Excel (attendanceGridReport.js) supaya kedua format konsisten.
 *
 * @param {'status'|'masuk'|'pulang'} cellMode
 */
function drawBlockPage(
  doc,
  {
    title,
    subtitle,
    dateList,
    employeesChunk,
    empOffset,
    attendanceMap,
    leaveJenisMap,
    piketSet,
    holidays,
    cellMode,
    colWidth,
  },
) {
  const withTotals = cellMode === "status";
  let y = PAGE_MARGIN;
  const x0 = PAGE_MARGIN;

  if (title) {
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND_GREEN);
    doc.text(subtitle ? `${title} ${subtitle}` : title, x0, y, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: "center",
    });
    doc.fillColor("#111827");
    y += TITLE_HEIGHT;
  }

  const firstDayX = x0 + NO_COL_WIDTH + NAME_COL_WIDTH;
  const dayGridWidth = colWidth * dateList.length;
  const totalsX = firstDayX + dayGridWidth;

  // Header baris 1: No. / Nama / Tanggal / Total
  drawFilledCell(doc, x0, y, NO_COL_WIDTH, HEADER_ROW_HEIGHT * 2, {
    text: "No.",
    fill: null,
    fontSize: 7,
    bold: true,
  });
  doc
    .rect(x0, y, NO_COL_WIDTH, HEADER_ROW_HEIGHT * 2)
    .fillColor(BRAND_GREEN)
    .fill();
  drawCellBorder(doc, x0, y, NO_COL_WIDTH, HEADER_ROW_HEIGHT * 2);
  doc.fillColor(HEADER_TEXT).font("Helvetica-Bold").fontSize(7);
  doc.text("No.", x0, y + HEADER_ROW_HEIGHT - 4, {
    width: NO_COL_WIDTH,
    align: "center",
  });

  doc
    .rect(x0 + NO_COL_WIDTH, y, NAME_COL_WIDTH, HEADER_ROW_HEIGHT * 2)
    .fillColor(BRAND_GREEN)
    .fill();
  drawCellBorder(
    doc,
    x0 + NO_COL_WIDTH,
    y,
    NAME_COL_WIDTH,
    HEADER_ROW_HEIGHT * 2,
  );
  doc.fillColor(HEADER_TEXT);
  doc.text("Nama", x0 + NO_COL_WIDTH, y + HEADER_ROW_HEIGHT - 4, {
    width: NAME_COL_WIDTH,
    align: "center",
  });

  doc
    .rect(firstDayX, y, dayGridWidth, HEADER_ROW_HEIGHT)
    .fillColor(BRAND_GREEN)
    .fill();
  drawCellBorder(doc, firstDayX, y, dayGridWidth, HEADER_ROW_HEIGHT);
  doc.fillColor(HEADER_TEXT);
  doc.text("Tanggal", firstDayX, y + HEADER_ROW_HEIGHT / 2 - 3, {
    width: dayGridWidth,
    align: "center",
  });

  dateList.forEach((dateStr, idx) => {
    const cx = firstDayX + idx * colWidth;
    doc
      .rect(cx, y + HEADER_ROW_HEIGHT, colWidth, HEADER_ROW_HEIGHT)
      .fillColor(BRAND_GREEN)
      .fill();
    drawCellBorder(doc, cx, y + HEADER_ROW_HEIGHT, colWidth, HEADER_ROW_HEIGHT);
    doc.fillColor(HEADER_TEXT).fontSize(6);
    doc.text(
      String(Number(dateStr.slice(8, 10))),
      cx,
      y + HEADER_ROW_HEIGHT + HEADER_ROW_HEIGHT / 2 - 3,
      {
        width: colWidth,
        align: "center",
      },
    );
  });

  if (withTotals) {
    const totalsWidth = TOTAL_COL_WIDTH * TOTAL_COLS.length;
    doc
      .rect(totalsX, y, totalsWidth, HEADER_ROW_HEIGHT)
      .fillColor(BRAND_GREEN)
      .fill();
    drawCellBorder(doc, totalsX, y, totalsWidth, HEADER_ROW_HEIGHT);
    doc.fillColor(HEADER_TEXT).fontSize(7);
    doc.text("Total", totalsX, y + HEADER_ROW_HEIGHT / 2 - 3, {
      width: totalsWidth,
      align: "center",
    });

    TOTAL_COLS.forEach((t, idx) => {
      const cx = totalsX + idx * TOTAL_COL_WIDTH;
      doc
        .rect(cx, y + HEADER_ROW_HEIGHT, TOTAL_COL_WIDTH, HEADER_ROW_HEIGHT)
        .fillColor(BRAND_GREEN)
        .fill();
      drawCellBorder(
        doc,
        cx,
        y + HEADER_ROW_HEIGHT,
        TOTAL_COL_WIDTH,
        HEADER_ROW_HEIGHT,
      );
      doc.fillColor(HEADER_TEXT).fontSize(6);
      doc.text(t.label, cx, y + HEADER_ROW_HEIGHT + HEADER_ROW_HEIGHT / 2 - 3, {
        width: TOTAL_COL_WIDTH,
        align: "center",
      });
    });
  }

  doc.fillColor("#111827");
  y += HEADER_ROW_HEIGHT * 2;
  const gridTop = y;

  // Baris data pegawai (chunk saat ini)
  employeesChunk.forEach((emp, i) => {
    const rowY = y + i * ROW_HEIGHT;
    const noCell = empOffset + i + 1;

    drawFilledCell(doc, x0, rowY, NO_COL_WIDTH, ROW_HEIGHT, {
      text: String(noCell),
      fontSize: 7,
    });
    drawFilledCell(doc, x0 + NO_COL_WIDTH, rowY, NAME_COL_WIDTH, ROW_HEIGHT, {
      text: emp.name,
      fontSize: 7,
      bold: true,
      align: "left",
    });

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
      const cx = firstDayX + idx * colWidth;
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const holiday = dayOfWeek === 0 ? null : findHoliday(dateStr, holidays);
      if (dayOfWeek === 0 || holiday) {
        // Sel Minggu/Libur digambar terpisah setelah semua baris (merge visual)
        return;
      }

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
        drawFilledCell(doc, cx, rowY, colWidth, ROW_HEIGHT, {
          text: result.text,
          fill: result.fill,
          font: result.font,
          fontSize: 6.5,
          bold: true,
        });
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
        drawFilledCell(doc, cx, rowY, colWidth, ROW_HEIGHT, {
          text: result.text,
          fill: result.fill,
          font: result.font,
          fontSize: 6,
        });
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
        const cx = totalsX + idx * TOTAL_COL_WIDTH;
        drawFilledCell(doc, cx, rowY, TOTAL_COL_WIDTH, ROW_HEIGHT, {
          text: String(v),
          fontSize: 7,
          bold: true,
        });
      });
    }
  });

  const gridBottom = gridTop + employeesChunk.length * ROW_HEIGHT;

  // Kolom Minggu/Libur - digambar sebagai satu sel memanjang menutupi
  // seluruh baris pegawai pada chunk/halaman ini (setara merge di Excel).
  if (employeesChunk.length > 0) {
    dateList.forEach((dateStr, idx) => {
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const holiday = dayOfWeek === 0 ? null : findHoliday(dateStr, holidays);
      if (!(dayOfWeek === 0 || holiday)) return;

      const cx = firstDayX + idx * colWidth;
      const label =
        dayOfWeek === 0
          ? "Minggu"
          : `Libur${holiday.keterangan ? " - " + holiday.keterangan : ""}`;
      drawFilledCell(doc, cx, gridTop, colWidth, gridBottom - gridTop, {
        text: label,
        fill: COLOR.liburMinggu.fill,
        font: COLOR.liburMinggu.font,
        fontSize: 6,
        bold: true,
        rotate: true,
      });
    });
  }

  return gridBottom;
}

/**
 * Membangun dokumen PDF laporan absensi dengan tampilan grid yang sama
 * seperti export Excel: 3 bagian berurutan (Daftar Hadir, Jam Masuk, Jam
 * Pulang), masing-masing dipisah halaman baru. Untuk laporan tahunan,
 * setiap bagian berisi 12 blok bulan (Januari - Desember) yang juga
 * dimulai dari halaman baru per bulannya.
 */
async function streamAttendanceGridPdf(
  res,
  { start, end, userId, periodType },
) {
  const {
    blocks,
    employees,
    attendanceMap,
    leaveJenisMap,
    piketSet,
    holidays,
  } = await buildReportContext({ start, end, userId, periodType });

  const doc = new PDFDocument({
    margin: PAGE_MARGIN,
    size: "A4",
    layout: "landscape",
  });
  doc.pipe(res);

  const usableWidth =
    doc.page.width - PAGE_MARGIN * 2 - NO_COL_WIDTH - NAME_COL_WIDTH;

  const sections = [
    { label: "Daftar Hadir", cellMode: "status" },
    { label: "Jam Masuk", cellMode: "masuk" },
    { label: "Jam Pulang", cellMode: "pulang" },
  ];

  let firstPage = true;

  sections.forEach((section, sectionIdx) => {
    const withTotals = section.cellMode === "status";

    blocks.forEach((block) => {
      const dayCount = block.dateList.length;
      const totalsWidth = withTotals
        ? TOTAL_COL_WIDTH * TOTAL_COLS.length + 6
        : 0;
      const colWidth = Math.max(
        10,
        (usableWidth - totalsWidth) / Math.max(dayCount, 1),
      );

      let empOffset = 0;
      let remaining = employees;
      let isFirstChunk = true;

      if (remaining.length === 0) remaining = [null]; // tetap render grid kosong kalau belum ada pegawai

      while (remaining.length > 0 || isFirstChunk) {
        if (!firstPage)
          doc.addPage({ margin: PAGE_MARGIN, size: "A4", layout: "landscape" });
        firstPage = false;

        const rowsPerPage = computeRowsPerPage(doc, isFirstChunk);
        const chunk =
          remaining[0] === null ? [] : remaining.slice(0, rowsPerPage);
        remaining = remaining[0] === null ? [] : remaining.slice(rowsPerPage);

        const title = isFirstChunk
          ? `Laporan ${section.label} - ${block.title}`
          : `${section.label} - ${block.title}`;
        const subtitle = isFirstChunk ? null : "(lanjutan)";

        drawBlockPage(doc, {
          title,
          subtitle,
          dateList: block.dateList,
          employeesChunk: chunk,
          empOffset,
          attendanceMap,
          leaveJenisMap,
          piketSet,
          holidays,
          cellMode: section.cellMode,
          colWidth,
        });

        empOffset += chunk.length;
        isFirstChunk = false;
        if (remaining.length === 0) break;
      }
    });
  });

  doc.end();
}

module.exports = { streamAttendanceGridPdf };
