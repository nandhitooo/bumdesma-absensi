import { useEffect, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import { IndonesianDatePicker } from "../components/IndonesianDatePickers";
import Pagination from "../components/Pagination";
import api, { getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

const PAGE_SIZE = 10;

function formatJam(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toTimeString().slice(0, 5);
}

const STATUS_LABEL = {
  tepat_waktu: "Tepat Waktu",
  terlambat: "Terlambat",
  alpa: "Alpa",
  izin_cuti: "Izin/Cuti",
  lembur: "Lembur",
};

export default function Absensi() {
  const { user } = useAuth();
  const { alert } = useModal();
  const canEdit = user?.role === "admin"; // Pimpinan hanya boleh melihat, backend juga menolak PUT-nya
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [pegawai, setPegawai] = useState([]);
  const [absensi, setAbsensi] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pagination server-side untuk daftar pegawai + pencarian nama/NIP.
  // Catatan absensi per tanggal tetap diambil utuh (max 1 record/pegawai
  // per hari) supaya penggabungan baris & hitungan "sudah absen" tetap akurat.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    jam_masuk: "",
    jam_pulang: "",
    status: "alpa",
  });

  // Penomoran request: mencegah response lama (ganti tanggal/halaman cepat)
  // menimpa data yang lebih baru.
  const requestSeq = useRef(0);

  const loadData = async () => {
    const current = ++requestSeq.current;
    setLoading(true);
    try {
      const [pegawaiRes, absensiRes] = await Promise.all([
        api.get("/users", {
          params: {
            role: "pegawai",
            page,
            limit: PAGE_SIZE,
            search: search || undefined,
          },
        }),
        // Satu hari maksimal 1 record absensi per pegawai, jadi limit 500
        // aman untuk mengambil seluruh record tanggal terpilih sekaligus.
        api.get("/attendance", { params: { tanggal, limit: 500 } }),
      ]);
      if (current !== requestSeq.current) return; // response sudah basi
      setPegawai(pegawaiRes.data.data);
      setTotal(pegawaiRes.data.meta?.total ?? pegawaiRes.data.data.length);
      setAbsensi(absensiRes.data.data);
    } catch (err) {
      if (current !== requestSeq.current) return; // response sudah basi
      await alert(getErrorMessage(err, "Gagal memuat data absensi."), {
        title: "Gagal Memuat Data",
        danger: true,
      });
    } finally {
      if (current === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    // Microtask: setLoading di dalam loadData tidak boleh jalan sinkron di
    // badan effect (rule react-hooks/set-state-in-effect).
    Promise.resolve().then(loadData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, page, search]);

  // Debounce input pencarian (400ms) sebelum dikirim ke server.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handlePageChange = (p) => setPage(p);

  // Gabungkan seluruh pegawai dengan data absensinya pada tanggal terpilih.
  // Pegawai yang belum memiliki catatan absensi tetap ditampilkan sebagai
  // "Belum Absen" agar Admin bisa memantau dan mengoreksi siapa saja yang
  // belum tercatat kehadirannya.
  const rows = pegawai.map((p) => {
    const rec = absensi.find((a) => (a.user?.id ?? a.userId) === p.id);
    return {
      userId: p.id,
      attendanceId: rec?.id ?? null,
      nama: p.name,
      jabatan: p.jabatan,
      jam_masuk: rec?.jam_masuk ?? null,
      jam_pulang: rec?.jam_pulang ?? null,
      status: rec?.status ?? null,
    };
  });

  const belumAbsenCount = rows.filter((r) => !r.attendanceId).length;

  // Statistik "sudah absen": saat tidak ada filter pencarian, hitung dari
  // seluruh record absensi hari itu vs total pegawai (bukan hanya halaman
  // yang tampil). Saat pencarian aktif, hitungan mengikuti baris terfilter.
  const isFiltering = search.trim().length > 0;
  const sudahAbsen = isFiltering
    ? rows.length - belumAbsenCount
    : absensi.length;
  const totalPegawai = isFiltering ? rows.length : total;

  const openEdit = (row) => {
    setEditData(row);
    setForm({
      jam_masuk: row.jam_masuk
        ? new Date(row.jam_masuk).toTimeString().slice(0, 5)
        : "",
      jam_pulang: row.jam_pulang
        ? new Date(row.jam_pulang).toTimeString().slice(0, 5)
        : "",
      status: row.status || "alpa",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      jam_masuk: form.jam_masuk
        ? `${tanggal}T${form.jam_masuk}:00+07:00`
        : null,
      jam_pulang: form.jam_pulang
        ? `${tanggal}T${form.jam_pulang}:00+07:00`
        : null,
      status: form.status,
    };
    try {
      if (editData.attendanceId) {
        await api.put(`/attendance/${editData.attendanceId}`, payload);
      } else {
        await api.post("/attendance", {
          userId: editData.userId,
          tanggal,
          ...payload,
        });
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menyimpan koreksi absensi."), {
        title: "Gagal Menyimpan",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (s) => {
    if (s === "tepat_waktu" || s === "lembur") return "text-green-600";
    if (s === "terlambat") return "text-orange-500";
    if (s === "izin_cuti") return "text-blue-500";
    if (s === "alpa") return "text-red-500";
    return "text-gray-400"; // belum absen
  };

  const statusBg = (s) => {
    if (s === "tepat_waktu" || s === "lembur")
      return "bg-green-50 text-green-600";
    if (s === "terlambat") return "bg-orange-50 text-orange-500";
    if (s === "izin_cuti") return "bg-blue-50 text-blue-500";
    if (s === "alpa") return "bg-red-50 text-red-500";
    return "bg-gray-100 text-gray-400"; // belum absen
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-h-screen">
      <Topbar title="Absensi" />
      <div className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm w-full sm:w-auto">
              <i className="fa-solid fa-calendar-days text-gray-500 shrink-0"></i>
              <IndonesianDatePicker
                value={tanggal}
                onChange={(val) => {
                  setTanggal(val);
                  setPage(1); // tanggal baru -> mulai dari halaman pertama
                }}
              />
            </div>

            {/* Pencarian server-side (nama / NIP) dengan debounce 400ms */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm w-full sm:w-auto">
              <i className="fa-solid fa-magnifying-glass text-gray-500 shrink-0"></i>
              <input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama atau NIP..."
                className="outline-none text-sm font-semibold text-gray-700 bg-transparent w-full sm:w-auto min-w-0"
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

          {!loading && rows.length > 0 && (
            <div className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm text-xs sm:text-sm font-bold text-gray-700">
              {sudahAbsen} / {totalPegawai} pegawai sudah absen
              {belumAbsenCount > 0 && (
                <span className="ml-2 text-red-500">
                  ({belumAbsenCount} belum absen di halaman ini)
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-sm font-semibold text-gray-500">
            Memuat data...
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <i
              className={`fa-solid ${
                search ? "fa-magnifying-glass" : "fa-inbox"
              } text-3xl text-gray-300 mb-2`}
            ></i>
            <p className="text-sm font-semibold text-gray-500">
              {search
                ? `Tidak ada pegawai yang cocok dengan "${search}".`
                : "Belum ada data pegawai."}
            </p>
          </div>
        ) : (
          <>
            {/* Tampilan kartu - mobile & tablet */}
            <div className="flex flex-col gap-3 lg:hidden">
              {rows.map((r) => (
                <div
                  key={r.userId}
                  className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-gray-800">
                        {r.nama}
                      </div>
                      <div className="text-xs font-bold text-gray-500 mt-0.5">
                        {r.jabatan || "-"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${statusBg(r.status)}`}
                    >
                      {r.status
                        ? STATUS_LABEL[r.status] || r.status
                        : "Belum Absen"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
                    <div>
                      <div className="font-bold text-gray-400">Masuk</div>
                      <div className="font-extrabold text-gray-800">
                        {formatJam(r.jam_masuk)}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-400">Pulang</div>
                      <div className="font-extrabold text-gray-800">
                        {formatJam(r.jam_pulang)}
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => openEdit(r)}
                      className="mt-1 py-2 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-all"
                    >
                      Edit
                    </button>
                  )}
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
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Nama
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Jabatan
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Masuk
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Pulang
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Status
                      </th>
                      {canEdit && <th className="px-5 py-4"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={r.userId}
                        className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
                      >
                        <td className="px-5 py-3 font-extrabold text-gray-800">
                          {r.nama}
                        </td>
                        <td className="px-5 py-3 font-semibold text-gray-600 text-sm">
                          {r.jabatan || "-"}
                        </td>
                        <td className="px-5 py-3 font-extrabold text-gray-800">
                          {formatJam(r.jam_masuk)}
                        </td>
                        <td className="px-5 py-3 font-extrabold text-gray-800">
                          {formatJam(r.jam_pulang)}
                        </td>
                        <td
                          className={`px-5 py-3 font-bold ${statusColor(r.status)}`}
                        >
                          {r.status
                            ? STATUS_LABEL[r.status] || r.status
                            : "Belum Absen"}
                        </td>
                        {canEdit && (
                          <td className="px-5 py-3">
                            <button
                              onClick={() => openEdit(r)}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-all"
                            >
                              edit
                            </button>
                          </td>
                        )}
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-extrabold text-gray-800 mb-1">
              Edit Absensi - {editData?.nama}
            </h2>
            {!editData?.attendanceId && (
              <p className="text-xs font-semibold text-gray-400 mb-3">
                Pegawai ini belum memiliki catatan absensi pada tanggal ini.
                Menyimpan akan membuat data absensi baru.
              </p>
            )}
            <div className="flex flex-col gap-3 mt-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  Jam Masuk
                </label>
                <input
                  type="time"
                  value={form.jam_masuk}
                  onChange={(e) =>
                    setForm({ ...form, jam_masuk: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  Jam Pulang
                </label>
                <input
                  type="time"
                  value={form.jam_pulang}
                  onChange={(e) =>
                    setForm({ ...form, jam_pulang: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="tepat_waktu">Tepat Waktu</option>
                  <option value="terlambat">Terlambat</option>
                  <option value="alpa">Alpa</option>
                  <option value="izin_cuti">Izin/Cuti</option>
                  <option value="lembur">Lembur</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "#1a7a1a" }}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-gray-600 font-bold text-sm bg-gray-100 hover:bg-gray-200"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
