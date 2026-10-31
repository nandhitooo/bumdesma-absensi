const fs = require("fs");
const { Op } = require("sequelize");
const { Leave, User, Attendance } = require("../models");
const { success, failure } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");
const { logActivity } = require("../utils/activityLogger");
const { notifyUser } = require("../utils/notifier");
const {
  LEAVE_STATUS,
  ATTENDANCE_STATUS,
  NOTIFICATION_TYPE,
  LEAVE_TYPE,
} = require("../utils/constants");

// Multer's disk storage writes the uploaded file BEFORE this controller
// ever runs — it happens in the upload.middleware.js layer, ahead of any
// of the validation below. That means every failure path here (missing
// fields, bad date range, or a DB error from Leave.create()) previously
// left the just-uploaded PDF/DOCX permanently orphaned on disk with no
// Leave row ever referencing it. Repeated failed submissions (network
// hiccups, validation errors, retries while debugging) would silently
// accumulate garbage files forever. Call this on every non-success path
// so a failed request never leaves a leftover file behind.
function removeUploadedFileIfAny(req) {
  if (req.file?.path) {
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error(
          "[Leave] Gagal menghapus file yatim setelah pengajuan gagal:",
          err.message,
        );
      }
    });
  }
}

// POST /api/leaves  (Pegawai mengajukan izin/cuti dari mobile, multipart dengan file lampiran)
const create = async (req, res) => {
  const { jenis, tanggal_mulai, tanggal_selesai, alasan } = req.body;

  if (!jenis || !Object.values(LEAVE_TYPE).includes(jenis)) {
    removeUploadedFileIfAny(req);
    return failure(res, {
      statusCode: 422,
      message: "jenis harus salah satu dari: sakit, izin, cuti.",
    });
  }
  if (!tanggal_mulai || !tanggal_selesai || !alasan) {
    removeUploadedFileIfAny(req);
    return failure(res, {
      statusCode: 422,
      message: "tanggal_mulai, tanggal_selesai, dan alasan wajib diisi.",
    });
  }

  if (new Date(tanggal_selesai) < new Date(tanggal_mulai)) {
    removeUploadedFileIfAny(req);
    return failure(res, {
      statusCode: 422,
      message: "tanggal_selesai tidak boleh sebelum tanggal_mulai.",
    });
  }

  try {
    const leave = await Leave.create({
      user_id: req.user.id,
      jenis,
      tanggal_mulai,
      tanggal_selesai,
      alasan,
      file_lampiran: req.file
        ? `/uploads/surat-izin/${req.file.filename}`
        : null,
      status: LEAVE_STATUS.PENDING,
    });

    await logActivity(
      req,
      "AJUKAN_IZIN_CUTI",
      `Mengajukan ${jenis} (${tanggal_mulai} s/d ${tanggal_selesai})`,
    );

    return success(res, {
      statusCode: 201,
      message:
        "Pengajuan izin/cuti berhasil dikirim dan menunggu tinjauan Admin.",
      data: leave,
    });
  } catch (err) {
    // Leave.create() failed (DB error, validation error, etc.) — the file
    // was already written by multer, so clean it up before propagating
    // the error to the global error handler.
    removeUploadedFileIfAny(req);
    throw err;
  }
};

// GET /api/leaves/me
const myLeaves = async (req, res) => {
  const rows = await Leave.findAll({
    where: { user_id: req.user.id },
    order: [["created_at", "DESC"]],
  });
  return success(res, { data: rows });
};

// GET /api/leaves?status=&user_id=&search=&page=&limit=
// Admin melihat semua pengajuan untuk ditinjau; Pimpinan melihat yang sudah diteruskan Admin
const getAll = async (req, res) => {
  const { status, user_id, search } = req.query;
  const { page, limit, offset } = parsePagination(req.query);
  const where = {};
  if (status) where.status = status;
  if (user_id) where.user_id = user_id;
  // Pencarian nama pegawai (case-insensitive) via relasi `user`
  const userWhere = search ? { name: { [Op.iLike]: `%${search}%` } } : undefined;

  // Pimpinan hanya perlu melihat pengajuan yang sudah ditinjau Admin ke atas
  if (req.user.role === "pimpinan" && !status) {
    where.status = {
      [Op.in]: [
        LEAVE_STATUS.DITERUSKAN,
        LEAVE_STATUS.APPROVED,
        LEAVE_STATUS.REJECTED,
      ],
    };
  }

  const { rows, count } = await Leave.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "nip", "name"],
        where: userWhere,
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return success(res, {
    data: rows,
    meta: { total: count, page, limit },
  });
};

// PUT /api/leaves/:id/review  (Admin meninjau & meneruskan ke Pimpinan)
const review = async (req, res) => {
  const leave = await Leave.findByPk(req.params.id);
  if (!leave)
    return failure(res, {
      statusCode: 404,
      message: "Pengajuan tidak ditemukan.",
    });
  if (leave.status !== LEAVE_STATUS.PENDING) {
    return failure(res, {
      statusCode: 400,
      message: "Pengajuan ini sudah ditinjau sebelumnya.",
    });
  }

  leave.status = LEAVE_STATUS.DITERUSKAN;
  leave.reviewed_by = req.user.id;
  leave.reviewed_at = new Date();
  await leave.save();

  await logActivity(
    req,
    "REVIEW_IZIN_CUTI",
    `Admin meneruskan pengajuan izin/cuti ID ${leave.id} ke Pimpinan`,
  );

  return success(res, {
    message: "Pengajuan berhasil diteruskan ke Pimpinan untuk keputusan akhir.",
    data: leave,
  });
};

// PUT /api/leaves/:id/decision  (Pimpinan memberi keputusan akhir)
// Body: { decision: 'approved' | 'rejected', catatan_keputusan }
const decide = async (req, res) => {
  const { decision, catatan_keputusan } = req.body;

  if (![LEAVE_STATUS.APPROVED, LEAVE_STATUS.REJECTED].includes(decision)) {
    return failure(res, {
      statusCode: 422,
      message: 'decision harus "approved" atau "rejected".',
    });
  }

  const leave = await Leave.findByPk(req.params.id);
  if (!leave)
    return failure(res, {
      statusCode: 404,
      message: "Pengajuan tidak ditemukan.",
    });
  if (![LEAVE_STATUS.DITERUSKAN, LEAVE_STATUS.PENDING].includes(leave.status)) {
    return failure(res, {
      statusCode: 400,
      message: "Pengajuan ini sudah mendapat keputusan sebelumnya.",
    });
  }

  leave.status = decision;
  leave.decided_by = req.user.id;
  leave.decided_at = new Date();
  leave.catatan_keputusan = catatan_keputusan || null;
  await leave.save();

  // Jika disetujui, otomatis isi rekapitulasi harian berstatus "Izin/Cuti" untuk setiap
  // tanggal dalam rentang pengajuan dan menutup akses scanning pada tanggal tersebut.
  if (decision === LEAVE_STATUS.APPROVED) {
    const start = new Date(leave.tanggal_mulai);
    const end = new Date(leave.tanggal_selesai);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const tanggal = d.toISOString().slice(0, 10);
      const [attendance] = await Attendance.findOrCreate({
        where: { user_id: leave.user_id, tanggal },
        defaults: {
          user_id: leave.user_id,
          tanggal,
          status: ATTENDANCE_STATUS.IZIN_CUTI,
        },
      });
      if (attendance.status !== ATTENDANCE_STATUS.IZIN_CUTI) {
        attendance.status = ATTENDANCE_STATUS.IZIN_CUTI;
        await attendance.save();
      }
    }
  }

  // Kirim notifikasi in-app ke pegawai (muncul di panel lonceng Dashboard mobile).
  const periode = `${leave.tanggal_mulai} s/d ${leave.tanggal_selesai}`;
  await notifyUser({
    userId: leave.user_id,
    type: NOTIFICATION_TYPE.IZIN_CUTI,
    title:
      decision === LEAVE_STATUS.APPROVED
        ? "Pengajuan Disetujui"
        : "Pengajuan Ditolak",
    message:
      decision === LEAVE_STATUS.APPROVED
        ? `Pengajuan ${leave.jenis} Anda (${periode}) telah disetujui.`
        : `Pengajuan ${leave.jenis} Anda (${periode}) telah ditolak.${
            catatan_keputusan ? ` Catatan: ${catatan_keputusan}` : ""
          }`,
    data: { leaveId: leave.id, status: decision },
    sentBy: req.user.id,
  });

  await logActivity(
    req,
    "KEPUTUSAN_IZIN_CUTI",
    `Pimpinan memberi keputusan "${decision}" untuk pengajuan ID ${leave.id}`,
  );

  return success(res, {
    message: `Pengajuan izin/cuti telah ${decision === "approved" ? "disetujui" : "ditolak"} dan notifikasi terkirim ke pegawai.`,
    data: leave,
  });
};

module.exports = { create, myLeaves, getAll, review, decide };
