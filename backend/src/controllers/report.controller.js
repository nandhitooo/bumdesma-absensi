const { Op } = require("sequelize");
const { Attendance, User } = require("../models");
const { failure, success } = require("../utils/response");
const { logActivity } = require("../utils/activityLogger");
const { ATTENDANCE_STATUS, CHECKOUT_STATUS } = require("../utils/constants");
const {
  buildAttendanceGridWorkbook,
} = require("../utils/attendanceGridReport");
const { streamAttendanceGridPdf } = require("../utils/attendanceGridPdf");

async function fetchRecap({ start, end, user_id }) {
  const where = {};
  if (start && end) where.tanggal = { [Op.between]: [start, end] };
  if (user_id) where.user_id = user_id;

  return Attendance.findAll({
    where,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["nip", "name", "jabatan"],
      },
    ],
    order: [
      ["tanggal", "ASC"],
      [{ model: User, as: "user" }, "name", "ASC"],
    ],
  });
}

// GET /api/reports/summary?start=&end=
// Rekapitulasi ringkas (dipakai halaman Laporan sebelum export)
const summary = async (req, res) => {
  const { start, end, user_id } = req.query;
  if (!start || !end) {
    return failure(res, {
      statusCode: 422,
      message: "Parameter start dan end (YYYY-MM-DD) wajib diisi.",
    });
  }

  const rows = await fetchRecap({ start, end, user_id });

  const recap = {
    totalRecords: rows.length,
    tepatWaktu: rows.filter((r) => r.status === ATTENDANCE_STATUS.TEPAT_WAKTU)
      .length,
    terlambat: rows.filter((r) => r.status === ATTENDANCE_STATUS.TERLAMBAT)
      .length,
    alpa: rows.filter((r) => r.status === ATTENDANCE_STATUS.ALPA).length,
    izinCuti: rows.filter((r) => r.status === ATTENDANCE_STATUS.IZIN_CUTI)
      .length,
    lembur: rows.filter((r) => r.checkout_status === CHECKOUT_STATUS.LEMBUR)
      .length,
    totalOvertimeMinutes: rows.reduce(
      (sum, r) => sum + (r.overtime_minutes || 0),
      0,
    ),
  };

  return success(res, { data: { periode: { start, end }, recap, rows } });
};

// GET /api/reports/attendance/export?start=&end=&format=pdf|xlsx&type=harian|mingguan|bulanan|tahunan
// `type` (periodType) menentukan bentuk blok laporan: kalau 'tahunan',
// laporan (baik xlsx maupun pdf) berisi gabungan 12 blok bulan (Januari -
// Desember), bukan cuma rentang start-end yang dikirim. Kedua format
// (xlsx & pdf) memakai grid tampilan yang sama: sheet/bagian "Daftar
// Hadir" (kode status), "Jam Masuk", dan "Jam Pulang".
const exportAttendance = async (req, res) => {
  const { start, end, user_id, format = "pdf", type } = req.query;

  if (!start || !end) {
    return failure(res, {
      statusCode: 422,
      message: "Parameter start dan end (YYYY-MM-DD) wajib diisi.",
    });
  }

  await logActivity(
    req,
    "EXPORT_LAPORAN",
    `${req.user.name} mengekspor laporan absensi (${start} s/d ${end}) format ${format}`,
  );

  const isTahunan = type === "tahunan";
  const filenameSuffix = isTahunan ? start.slice(0, 4) : `${start}_${end}`;

  if (format === "xlsx") {
    const workbook = await buildAttendanceGridWorkbook({
      start,
      end,
      userId: user_id,
      periodType: type,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="laporan-absensi-${filenameSuffix}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    return res.end();
  }

  // format === 'pdf' - tampilan grid yang sama seperti Excel (Daftar
  // Hadir / Jam Masuk / Jam Pulang), bukan lagi tabel flat.
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="laporan-absensi-${filenameSuffix}.pdf"`,
  );

  return streamAttendanceGridPdf(res, {
    start,
    end,
    userId: user_id,
    periodType: type,
  });
};

module.exports = { summary, exportAttendance };
