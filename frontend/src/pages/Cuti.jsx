import { useEffect, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import Pagination from "../components/Pagination";
import api, { getErrorMessage, FILE_BASE_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

const PAGE_SIZE = 10;

const STATUS_LABEL = {
  pending: "Menunggu Tinjauan Admin",
  diteruskan: "Menunggu Keputusan Pimpinan",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const JENIS_LABEL = {
  sakit: "Sakit",
  izin: "Izin",
  cuti: "Cuti",
};

const JENIS_STYLE = {
  sakit: "bg-red-50 text-red-600",
  izin: "bg-blue-50 text-blue-600",
  cuti: "bg-purple-50 text-purple-600",
};

export default function Cuti() {
  const { user } = useAuth();
  const { alert } = useModal();
  const [cuti, setCuti] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pagination server-side + filter status + pencarian nama (params yang
  // didukung GET /leaves - lihat leave.controller.js).
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Penomoran request: mencegah response lama menimpa data yang lebih baru.
  const requestSeq = useRef(0);

  const loadCuti = async () => {
    const current = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await api.get("/leaves", {
        params: {
          status: statusFilter || undefined,
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        },
      });
      if (current !== requestSeq.current) return; // response sudah basi
      setCuti(res.data.data);
      setTotal(res.data.meta?.total ?? res.data.data.length);
    } catch (err) {
      if (current !== requestSeq.current) return; // response sudah basi
      await alert(getErrorMessage(err, "Gagal memuat data izin/cuti."), {
        title: "Gagal Memuat Data",
        danger: true,
      });
    } finally {
      if (current === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    // Microtask: setLoading di dalam loadCuti tidak boleh jalan sinkron di
    // badan effect (rule react-hooks/set-state-in-effect).
    Promise.resolve().then(loadCuti);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search]);

  // Debounce input pencarian (400ms) sebelum dikirim ke server.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handlePageChange = (p) => setPage(p);

  const handleReview = async (id) => {
    try {
      await api.put(`/leaves/${id}/review`);
      await loadCuti();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal meneruskan pengajuan."), {
        title: "Gagal Meneruskan",
        danger: true,
      });
    }
  };

  const handleDecision = async (id, decision) => {
    try {
      await api.put(`/leaves/${id}/decision`, { decision });
      await loadCuti();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal memberikan keputusan."), {
        title: "Gagal Menyimpan Keputusan",
        danger: true,
      });
    }
  };

  const statusStyle = (s) => {
    if (s === "approved") return "bg-green-100 text-green-700";
    if (s === "rejected") return "bg-red-100 text-red-600";
    return "bg-yellow-100 text-yellow-600";
  };

  // Badge "menunggu" menghitung item yang relevan untuk role yang sedang
  // login: Admin => pending, Pimpinan => diteruskan (lihat renderActions).
  const actionableCount =
    user?.role === "admin"
      ? cuti.filter((c) => c.status === "pending").length
      : user?.role === "pimpinan"
        ? cuti.filter((c) => c.status === "diteruskan").length
        : 0;

  const renderActions = (c) => {
    if (user?.role === "admin" && c.status === "pending") {
      return (
        <button
          onClick={() => handleReview(c.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-all"
        >
          Teruskan
        </button>
      );
    }
    if (user?.role === "pimpinan" && c.status === "diteruskan") {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleDecision(c.id, "approved")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700"
          >
            <i className="fa-solid fa-check mr-1"></i>Setuju
          </button>
          <button
            onClick={() => handleDecision(c.id, "rejected")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600"
          >
            <i className="fa-solid fa-xmark mr-1"></i>Tolak
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-h-screen">
      <Topbar title="Izin/Cuti" />
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="relative">
            {actionableCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold z-10">
                {actionableCount}
              </span>
            )}
            <div className="px-4 md:px-5 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm text-xs md:text-sm font-bold text-gray-700">
              {user?.role === "admin"
                ? "Pengajuan Menunggu Tinjauan"
                : "Pengajuan Menunggu Keputusan"}
            </div>
          </div>

          {/* Filter status + pencarian nama (server-side) */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
              <i className="fa-solid fa-filter text-gray-500 shrink-0"></i>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1); // filter baru -> mulai dari halaman pertama
                }}
                className="outline-none text-sm font-semibold text-gray-700 bg-transparent"
              >
                <option value="">Semua Status</option>
                <option value="pending">Menunggu Tinjauan</option>
                <option value="diteruskan">Menunggu Keputusan</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm w-full sm:w-64">
              <i className="fa-solid fa-magnifying-glass text-gray-500 shrink-0"></i>
              <input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama pegawai..."
                className="outline-none text-sm font-semibold text-gray-700 bg-transparent w-full min-w-0"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    setPage(1);
                  }}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <i className="fa-solid fa-circle-xmark"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-sm font-semibold text-gray-500">
            <i className="fa-solid fa-spinner fa-spin mr-2"></i>
            Memuat data...
          </div>
        ) : cuti.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <i
              className={`fa-solid ${
                search || statusFilter ? "fa-magnifying-glass" : "fa-inbox"
              } text-3xl text-gray-300 mb-2`}
            ></i>
            <p className="text-sm font-semibold text-gray-500">
              {search || statusFilter
                ? "Tidak ada pengajuan yang cocok dengan filter."
                : "Belum ada pengajuan izin/cuti."}
            </p>
          </div>
        ) : (
          <>
            {/* Tampilan kartu - mobile & tablet */}
            <div className="flex flex-col gap-3 lg:hidden">
              {cuti.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-gray-800">
                        {c.user?.name}
                      </div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                          JENIS_STYLE[c.jenis] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {JENIS_LABEL[c.jenis] || c.jenis}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${statusStyle(c.status)}`}
                    >
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-calendar-days text-gray-400"></i>
                    {c.tanggal_mulai} s/d {c.tanggal_selesai}
                  </div>

                  <p className="text-sm font-semibold text-gray-600">
                    {c.alasan}
                  </p>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    {c.file_lampiran ? (
                      <a
                        href={`${FILE_BASE_URL}${c.file_lampiran}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all"
                      >
                        <i className="fa-solid fa-paperclip"></i> Lihat File
                      </a>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">
                        Tanpa lampiran
                      </span>
                    )}
                    {renderActions(c)}
                  </div>
                </div>
              ))}

              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={total}
                onPageChange={handlePageChange}
              />
            </div>

            {/* Tampilan tabel - desktop */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Nama
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Jenis
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Tanggal
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Alasan
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Lampiran
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Status
                      </th>
                      <th className="px-5 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuti.map((c, i) => (
                      <tr
                        key={c.id}
                        className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
                      >
                        <td className="px-5 py-3 font-extrabold text-gray-800">
                          {c.user?.name}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              JENIS_STYLE[c.jenis] ||
                              "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {JENIS_LABEL[c.jenis] || c.jenis}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-500 whitespace-nowrap">
                          {c.tanggal_mulai} s/d {c.tanggal_selesai}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-500 max-w-xs">
                          {c.alasan}
                        </td>
                        <td className="px-5 py-3">
                          {c.file_lampiran ? (
                            <a
                              href={`${FILE_BASE_URL}${c.file_lampiran}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all"
                            >
                              <i className="fa-solid fa-paperclip"></i> Lihat
                              File
                            </a>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-bold ${statusStyle(c.status)}`}
                          >
                            {STATUS_LABEL[c.status] || c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">{renderActions(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              page={page}
              limit={PAGE_SIZE}
              total={total}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
