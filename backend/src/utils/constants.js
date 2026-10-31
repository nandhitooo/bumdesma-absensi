// Enum / konstanta yang dipakai bersama di seluruh sistem

// ROLES dipakai untuk pengecekan otorisasi rute (authorize(ROLES.ADMIN), dst).
// Nilainya sama seperti sebelumnya; sumbernya sekarang dua tabel berbeda:
// pegawai (implisit 'pegawai', tabel users) atau admin_accounts.role.
const ROLES = Object.freeze({
  ADMIN: "admin",
  PEGAWAI: "pegawai",
  PIMPINAN: "pimpinan",
});

// Nilai valid untuk kolom admin_accounts.role.
const ADMIN_ROLES = Object.freeze({
  ADMIN: "admin",
  PIMPINAN: "pimpinan",
});

const ATTENDANCE_STATUS = Object.freeze({
  TEPAT_WAKTU: "tepat_waktu",
  TERLAMBAT: "terlambat",
  ALPA: "alpa",
  IZIN_CUTI: "izin_cuti",
});

const CHECKOUT_STATUS = Object.freeze({
  NORMAL: "normal",
  LEMBUR: "lembur",
  BELUM_PULANG: "belum_pulang",
});

const LEAVE_TYPE = Object.freeze({
  IZIN: "izin",
  SAKIT: "sakit",
  CUTI: "cuti",
});

// Status pengajuan izin/cuti mengikuti alur: pengajuan -> ditinjau Admin -> keputusan Pimpinan
const LEAVE_STATUS = Object.freeze({
  PENDING: "pending", // Menunggu tinjauan Admin
  DITERUSKAN: "diteruskan", // Admin sudah meneruskan ke Pimpinan
  APPROVED: "approved",
  REJECTED: "rejected",
});

const DAY_TYPE = Object.freeze({
  REGULER: "reguler", // Senin - Jumat
  SABTU: "sabtu",
});

const USER_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

const NOTIFICATION_TYPE = Object.freeze({
  PIKET: "piket",
  IZIN_CUTI: "izin_cuti",
});

// Alur tukar jadwal piket (admin-mediated, tanpa pengajuan dari app mobile):
// Admin mencatat permintaan -> kesediaan pegawai pengganti dicatat Admin ->
// Admin memberi keputusan akhir. Keputusan approved memindahkan jadwal.
const PIKET_SWAP_STATUS = Object.freeze({
  MENUNGGU_PENGGANTI: "menunggu_pengganti", // menunggu kesediaan pegawai pengganti
  MENUNGGU_ADMIN: "menunggu_admin", // pengganti bersedia, menunggu keputusan Admin
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});

module.exports = {
  ROLES,
  ADMIN_ROLES,
  ATTENDANCE_STATUS,
  CHECKOUT_STATUS,
  LEAVE_TYPE,
  LEAVE_STATUS,
  DAY_TYPE,
  USER_STATUS,
  NOTIFICATION_TYPE,
  PIKET_SWAP_STATUS,
};
