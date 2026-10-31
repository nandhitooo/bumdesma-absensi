import { useEffect, useMemo, useRef, useState } from "react";
import Pagination from "./Pagination";
import { IndonesianDatePicker } from "./IndonesianDatePickers";
import api, { getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

const PAGE_SIZE = 15;

// Label ramah untuk action yang dicatat backend lewat logActivity().
// Action di luar peta ini tetap tampil apa adanya (fallback).
const ACTION_LABELS = {
  LOGIN: "Login",
  LOGIN_FAILED: "Login Gagal",
  LOGOUT: "Logout",
  REFRESH_TOKEN: "Refresh Token",
  CHANGE_PASSWORD: "Ganti Password",
  CHANGE_USERNAME: "Ganti Username",
  UPDATE_EMAIL: "Perbarui Email",
  FORGOT_PASSWORD: "Lupa Password",
  RESET_PASSWORD: "Reset Password",
  CREATE_USER: "Tambah Pegawai",
  UPDATE_USER: "Ubah Pegawai",
  SET_USER_STATUS: "Ubah Status Pegawai",
  DELETE_USER: "Hapus Pegawai",
  CREATE_ADMIN_ACCOUNT: "Tambah Akun Admin",
  UPDATE_ADMIN_ACCOUNT: "Ubah Akun Admin",
  SET_ADMIN_ACCOUNT_STATUS: "Ubah Status Akun Admin",
  RESET_ADMIN_ACCOUNT_PASSWORD: "Reset Password Akun Admin",
  DELETE_ADMIN_ACCOUNT: "Hapus Akun Admin",
  SCAN_ABSENSI: "Scan Absensi",
  KOREKSI_ABSENSI: "Koreksi Absensi",
  UPDATE_SETTINGS: "Ubah Parameter Sistem",
  UPDATE_WORK_SCHEDULE: "Ubah Jadwal Kerja",
  GENERATE_QR_CODE: "Generate QR Code",
  CREATE_LEAVE: "Ajukan Izin/Cuti",
  REVIEW_LEAVE: "Review Izin/Cuti",
  DECIDE_LEAVE: "Putusan Izin/Cuti",
  CREATE_PIKET: "Buat Jadwal Piket",
  UPDATE_PIKET: "Ubah Jadwal Piket",
  REMOVE_PIKET: "Hapus Jadwal Piket",
  EXPORT_REPORT: "Ekspor Laporan",
  SEND_NOTIFICATION: "Kirim Notifikasi",
  REGISTER_PUSH_TOKEN: "Daftar Push Token",
};

// Warna badge per kelompok action (prefix yang dikenali).
function actionBadgeClass(action) {
  const a = String(action || "").toUpperCase();
  if (a.includes("DELETE") || a.includes("REMOVE") || a === "LOGIN_FAILED")
    return "bg-red-50 text-red-600";
  if (a.includes("CREATE") || a === "LOGIN" || a.includes("SUCCESS"))
    return "bg-green-50 text-green-700";
  if (a.includes("UPDATE") || a.includes("SET_") || a.includes("RESET"))
    return "bg-blue-50 text-blue-600";
  if (a.includes("EXPORT") || a.includes("GENERATE") || a.includes("SEND"))
    return "bg-purple-50 text-purple-600";
  return "bg-gray-100 text-gray-500";
}

function formatWaktu(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Card daftar log aktivitas sistem (GET /api/activity-logs, admin-only di
// backend). Dipakai di halaman Pengaturan. Data baru dimuat saat `expanded`
// bernilai true supaya halaman Pengaturan tidak menembak API ekstra tiap buka.
export default function AktivitasLogCard() {
  const { user } = useAuth();
  const { alert } = useModal();
  const isAdmin = user?.role === "admin";

  // Filter sesuai query params yang didukung backend:
  // GET /api/activity-logs?action=&start=&end=&page=&limit=
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Nilai draft tanggal, "committed" lewat tombol Terapkan.
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  // Debounce filter action (400ms) supaya tidak request tiap ketikan.
  const [actionInput, setActionInput] = useState("");
  const requestSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setAction(actionInput), 400);
    return () => clearTimeout(t);
  }, [actionInput]);

  const loadLogs = async () => {
    const current = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await api.get("/activity-logs", {
        params: {
          action: action || undefined,
          start: startDate ? `${startDate}T00:00:00` : undefined,
          end: endDate ? `${endDate}T23:59:59` : undefined,
          page,
          limit: PAGE_SIZE,
        },
      });
      if (current !== requestSeq.current) return; // response sudah basi
      setLogs(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch (err) {
      if (current !== requestSeq.current) return;
      await alert(getErrorMessage(err, "Gagal memuat log aktivitas."), {
        title: "Gagal Memuat Data",
        danger: true,
      });
    } finally {
      if (current === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !expanded) return;
    Promise.resolve().then(loadLogs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, startDate, endDate, page, isAdmin, expanded]);

  const applyDateFilter = () => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setPage(1);
  };

  const resetFilters = () => {
    setActionInput("");
    setAction("");
    setDraftStart("");
    setDraftEnd("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const activeFilterCount = useMemo(
    () => [action, startDate, endDate].filter(Boolean).length,
    [action, startDate, endDate],
  );

  if (!isAdmin) return null; // Pimpinan tidak melihat card ini sama sekali

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      {/* Header card + toggle expand */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 flex-wrap"
      >
        <div className="flex items-center gap-2 text-gray-700 font-extrabold">
          <i className="fa-solid fa-clipboard-list text-green-700"></i> Log
          Aktivitas Sistem
          {total > 0 && (
            <span className="text-xs font-extrabold bg-green-100 text-green-700 rounded-full px-2 py-0.5">
              {total}
            </span>
          )}
        </div>
        <i
          className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        ></i>
      </button>

      {expanded && (
        <>
          {/* Filter */}
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500">
                Cari Action
              </label>
              <input
                value={actionInput}
                onChange={(e) => {
                  setActionInput(e.target.value);
                  setPage(1);
                }}
                placeholder="mis. LOGIN, CREATE_USER..."
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-green-400 w-full lg:w-56"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500">
                Tanggal Mulai
              </label>
              <div className="w-full lg:w-52">
                <IndonesianDatePicker
                  value={draftStart}
                  maxISO={draftEnd || undefined}
                  onChange={setDraftStart}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500">
                Tanggal Selesai
              </label>
              <div className="w-full lg:w-52">
                <IndonesianDatePicker
                  value={draftEnd}
                  minISO={draftStart || undefined}
                  onChange={setDraftEnd}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={applyDateFilter}
                className="px-4 py-2 rounded-xl text-white font-bold text-xs hover:opacity-90"
                style={{ backgroundColor: "#1a7a1a" }}
              >
                Terapkan
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold text-xs bg-gray-100 hover:bg-gray-200"
                >
                  Reset ({activeFilterCount})
                </button>
              )}
            </div>
          </div>

          {/* Tabel */}
          <div className="mt-4">
            {loading ? (
              <div className="py-8 text-center text-sm font-semibold text-gray-500">
                Memuat log aktivitas...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <i className="fa-solid fa-clipboard-list text-gray-400"></i>
                </div>
                <p className="text-sm font-bold text-gray-500">
                  Tidak ada log yang cocok dengan filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-extrabold">
                        Waktu
                      </th>
                      <th className="px-4 py-3 text-left font-extrabold">
                        Aktor
                      </th>
                      <th className="px-4 py-3 text-left font-extrabold">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left font-extrabold">
                        Deskripsi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const aktor =
                        log.adminAccount?.name ||
                        log.admin?.name ||
                        log.user?.name ||
                        "-";
                      const peran =
                        log.actor_type ||
                        log.adminAccount?.role ||
                        (log.user ? "pegawai" : "");
                      return (
                        <tr
                          key={log.id}
                          className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-700">
                            {formatWaktu(log.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-800">
                              {aktor}
                            </div>
                            {peran && (
                              <div className="text-xs text-gray-400 font-semibold capitalize">
                                {peran}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide ${actionBadgeClass(log.action)}`}
                            >
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-semibold">
                            {log.description || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {logs.length > 0 && (
              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
