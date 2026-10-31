import { useEffect, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import SaturdayPicker from "../components/SaturdayPicker";
import Pagination from "../components/Pagination";
import PiketRotationCard from "../components/PiketRotationCard";
import api, { getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

const PAGE_SIZE = 10;

// Mencari Sabtu terdekat (hari ini kalau kebetulan Sabtu, atau Sabtu berikutnya)
// sebagai tanggal default saat halaman pertama kali dibuka.
function defaultSaturday() {
  const d = new Date();
  const diff = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function Piket() {
  const { user } = useAuth();
  const { alert, confirm } = useModal();
  const isAdmin = user?.role === "admin";
  const isPimpinan = user?.role === "pimpinan";

  const [tanggal, setTanggal] = useState(defaultSaturday());
  const [piket, setPiket] = useState([]);
  const [pegawaiList, setPegawaiList] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pagination & pencarian server-side pada endpoint /piket (params
  // `search`, `page`, `limit` - lihat piket.controller.js). Dropdown assign
  // tetap memuat semua pegawai aktif terpisah dari pencarian tabel.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  // Draft multi-pilih: pegawai yang dipilih lewat tombol Assign langsung
  // tampil sebagai baris "menunggu konfirmasi" di list utama (di luar modal).
  // Baru dikirim ke backend saat admin menekan tombol Konfirmasi di atas
  // pagination.
  const [form, setForm] = useState({ userId: "" });
  const [draftPegawai, setDraftPegawai] = useState([]);
  const [saving, setSaving] = useState(false);
  // Tukar jadwal piket (admin-mediated): pegawai minta ganti secara lisan ke
  // Admin, Admin catat permintaan -> catat kesediaan pengganti -> keputusan.
  const [swaps, setSwaps] = useState([]);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapForm, setSwapForm] = useState({ replacementUserId: "" });
  const [swapSaving, setSwapSaving] = useState(false);
  const [swapBusyId, setSwapBusyId] = useState(null);
  // Panel "Jadwal Bergilir" (cycle) tidak ditampilkan permanen: halaman utama
  // Piket fokus ke jadwal tanggal yang dipilih, sedangkan konfigurasi giliran
  // dibuka lewat tombol supaya tidak menambah beban visual.
  const [showRotation, setShowRotation] = useState(false);

  // Penomoran request: mencegah response lama menimpa data yang lebih baru.
  const requestSeq = useRef(0);

  const loadData = async () => {
    const current = ++requestSeq.current;
    setLoading(true);
    try {
      const pegawaiReq = isAdmin
        ? api.get("/users", { params: { role: "pegawai", limit: 100 } })
        : null;
      const swapReq = isAdmin
        ? api.get("/piket/swaps", { params: { start: tanggal, end: tanggal } })
        : null;
      const [piketRes, pegawaiRes, swapRes] = await Promise.all([
        api.get("/piket", {
          params: {
            start: tanggal,
            end: tanggal,
            search: search || undefined,
            page,
            limit: PAGE_SIZE,
          },
        }),
        pegawaiReq,
        swapReq,
      ]);
      if (current !== requestSeq.current) return; // response sudah basi
      setPiket(piketRes.data.data);
      setTotal(piketRes.data.meta?.total ?? piketRes.data.data.length);
      if (pegawaiRes) setPegawaiList(pegawaiRes.data.data);
      if (swapRes) setSwaps(swapRes.data.data);
    } catch (err) {
      if (current !== requestSeq.current) return; // response sudah basi
      await alert(getErrorMessage(err, "Gagal memuat data piket."), {
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

  const openAssign = () => {
    setForm({ userId: "" });
    setShowModal(true);
  };

  // Menambah satu pegawai ke daftar tunggu. Baris pending dirender di list
  // utama, bukan di dalam modal, sehingga modal tetap terbuka untuk menambah
  // beberapa pegawai sekaligus.
  const addDraftPegawai = () => {
    if (!form.userId) return;
    const pegawai = pegawaiList.find((p) => p.id === form.userId);
    if (!pegawai) return;
    if (draftPegawai.some((d) => d.id === pegawai.id)) {
      setForm({ userId: "" });
      return;
    }
    setDraftPegawai([...draftPegawai, pegawai]);
    setForm({ userId: "" });
  };

  const removeDraftPegawai = (id) => {
    setDraftPegawai(draftPegawai.filter((d) => d.id !== id));
  };

  // --- Tukar jadwal piket (admin-mediated, tanpa pengajuan dari mobile) ---
  const ACTIVE_SWAP_STATUSES = ["menunggu_pengganti", "menunggu_admin"];

  // Permintaan tukar yang masih berjalan untuk satu baris jadwal.
  const activeSwapFor = (piketId) =>
    swaps.find(
      (s) =>
        s.piket_schedule_id === piketId &&
        ACTIVE_SWAP_STATUSES.includes(s.status),
    );

  const openSwap = (p) => {
    setSwapTarget(p);
    setSwapForm({ replacementUserId: "" });
    setShowSwapModal(true);
  };

  const handleRequestSwap = async () => {
    if (!swapTarget || !swapForm.replacementUserId || swapSaving) return;
    const pengganti = pegawaiList.find(
      (u) => u.id === swapForm.replacementUserId,
    );
    const confirmed = await confirm(
      `Ajukan tukar piket: ${swapTarget.user?.name} digantikan oleh ${
        pengganti?.name ?? "pegawai pengganti"
      } pada ${swapTarget.tanggal}?\n\nKesediaan pegawai pengganti dicatat Admin di tahap berikutnya.`,
      { title: "Ajukan Tukar Piket", confirmLabel: "Ajukan" },
    );
    if (!confirmed) return;
    setSwapSaving(true);
    try {
      await api.post(`/piket/${swapTarget.id}/swap`, {
        replacementUserId: swapForm.replacementUserId,
      });
      setShowSwapModal(false);
      await loadData();
      await alert(
        'Permintaan tukar dicatat. Tekan "B bersedia" pada baris jadwal setelah pegawai pengganti menyetujui.',
        { title: "Berhasil" },
      );
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal mengajukan tukar piket."), {
        title: "Gagal Mengajukan",
        danger: true,
      });
    } finally {
      setSwapSaving(false);
    }
  };

  const handleMarkAgreed = async (swapId) => {
    const confirmed = await confirm(
      "Catat bahwa pegawai pengganti sudah bersedia menggantikan?",
      { title: "Kesediaan Pengganti", confirmLabel: "Ya, Bersedia" },
    );
    if (!confirmed) return;
    setSwapBusyId(swapId);
    try {
      await api.put(`/piket/swaps/${swapId}/agree`);
      await loadData();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal mencatat kesediaan."), {
        title: "Gagal",
        danger: true,
      });
    } finally {
      setSwapBusyId(null);
    }
  };

  const handleSwapDecision = async (swapId, decision) => {
    const approved = decision === "approved";
    const confirmed = await confirm(
      approved
        ? "Setujui tukar piket ini? Jadwal akan dialihkan ke pegawai pengganti dan notifikasi dikirim otomatis."
        : "Tolak permintaan tukar piket ini?",
      {
        title: approved ? "Setujui Tukar" : "Tolak Tukar",
        confirmLabel: approved ? "Setujui" : "Tolak",
        danger: !approved,
      },
    );
    if (!confirmed) return;
    setSwapBusyId(swapId);
    try {
      await api.put(`/piket/swaps/${swapId}/decision`, { decision });
      await loadData();
      await alert(
        approved
          ? "Tukar piket disetujui. Jadwal dialihkan dan notifikasi dikirim ke kedua pegawai."
          : "Permintaan tukar piket ditolak.",
        { title: approved ? "Disetujui" : "Ditolak" },
      );
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal memproses keputusan tukar."), {
        title: "Gagal",
        danger: true,
      });
    } finally {
      setSwapBusyId(null);
    }
  };

  const handleCancelSwap = async (swapId) => {
    const confirmed = await confirm("Batalkan permintaan tukar piket ini?", {
      title: "Batalkan Tukar",
      confirmLabel: "Batalkan",
      danger: true,
    });
    if (!confirmed) return;
    setSwapBusyId(swapId);
    try {
      await api.delete(`/piket/swaps/${swapId}`);
      await loadData();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal membatalkan tukar."), {
        title: "Gagal",
        danger: true,
      });
    } finally {
      setSwapBusyId(null);
    }
  };

  // Aksi tukar pada satu baris jadwal: tombol "Tukar" kalau belum ada
  // permintaan, atau kontrol status sesuai tahapnya.
  const renderSwapActions = (p) => {
    const swap = activeSwapFor(p.id);
    if (!swap) {
      return (
        <button
          onClick={() => openSwap(p)}
          className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all inline-flex items-center gap-1.5"
        >
          <i className="fa-solid fa-right-left"></i> tukar
        </button>
      );
    }
    const namaPengganti = swap.replacement?.name ?? "pengganti";
    const busy = swapBusyId === swap.id;
    return (
      <div className="flex items-center gap-2 justify-end flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold text-amber-700 bg-amber-100">
          <i className="fa-solid fa-right-left"></i>
          {swap.status === "menunggu_pengganti"
            ? `Tukar → ${namaPengganti} (menunggu kesediaan)`
            : `Tukar → ${namaPengganti} (menunggu Admin)`}
        </span>
        {swap.status === "menunggu_pengganti" ? (
          <button
            onClick={() => handleMarkAgreed(swap.id)}
            disabled={busy}
            className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-all"
          >
            {busy ? "..." : "B bersedia"}
          </button>
        ) : (
          <>
            <button
              onClick={() => handleSwapDecision(swap.id, "approved")}
              disabled={busy}
              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 transition-all"
            >
              Setujui
            </button>
            <button
              onClick={() => handleSwapDecision(swap.id, "rejected")}
              disabled={busy}
              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-all"
            >
              Tolak
            </button>
          </>
        )}
        <button
          onClick={() => handleCancelSwap(swap.id)}
          disabled={busy}
          title="Batalkan permintaan tukar"
          className="text-gray-400 hover:text-red-500 disabled:opacity-60"
        >
          <i className="fa-solid fa-circle-xmark"></i>
        </button>
      </div>
    );
  };

  // Skema konfirmasi: pegawai dipilih satu per satu lewat tombol Assign dan
  // tampil sebagai baris pending di list utama -> admin menekan tombol
  // Konfirmasi di atas pagination -> kirim semua userIds sekaligus.
  // Push notifikasi ke akun pegawai dikirim otomatis oleh backend
  // (piket.controller.js#assign) untuk setiap pegawai yang baru ditugaskan,
  // jadi kolom & tombol notifikasi manual sudah tidak diperlukan.
  const handleKonfirmasi = async () => {
    if (draftPegawai.length === 0 || saving) return;
    const dayOfWeek = new Date(`${tanggal}T00:00:00`).getDay();
    if (dayOfWeek !== 6) {
      await alert("Jadwal piket hanya berlaku untuk hari Sabtu.", {
        title: "Tanggal Tidak Valid",
      });
      return;
    }
    const jumlah = draftPegawai.length;
    const namaList = draftPegawai.map((d) => d.name).join(", ");
    const confirmed = await confirm(
      `Konfirmasi ${jumlah} pegawai sebagai piket pada ${tanggal}?\n\n${namaList}\n\nNotifikasi akan otomatis dikirim ke akun masing-masing pegawai.`,
      { title: "Konfirmasi Jadwal Piket", confirmLabel: "Ya, Konfirmasi" },
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      await api.post("/piket", {
        tanggal,
        userIds: draftPegawai.map((d) => d.id),
      });
      setDraftPegawai([]);
      setShowModal(false);
      await loadData();
      await alert(
        `${jumlah} jadwal piket tersimpan. Notifikasi otomatis dikirim ke akun pegawai.`,
        { title: "Berhasil" },
      );
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menyimpan jadwal piket."), {
        title: "Gagal Menyimpan",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleHapus = async (id) => {
    const confirmed = await confirm("Hapus jadwal piket ini?", {
      title: "Hapus Jadwal Piket",
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/piket/${id}`);
      await loadData();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menghapus jadwal piket."), {
        title: "Gagal Menghapus",
        danger: true,
      });
    }
  };

  const isEmpty = piket.length === 0 && draftPegawai.length === 0;

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-h-screen">
      <Topbar title="Piket" />
      <div className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div className="w-full sm:w-auto">
            <div className="text-sm font-bold text-gray-600 mb-1.5">
              Jadwal Piket (Sabtu)
            </div>
            <SaturdayPicker value={tanggal} onChange={(v) => {
              setTanggal(v);
              setPage(1); // tanggal baru -> mulai dari halaman pertama
              setDraftPegawai([]); // baris pending terikat tanggal, jangan dibawa
            }} />
          </div>
          {/* sm:flex-wrap: sejak ada tombol "Atur Jadwal Bergilir" di samping
              pencarian + Assign, baris ini bisa lebih lebar dari layar sempit. */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 w-full sm:w-auto">
            {/* Pencarian nama pegawai (server-side, debounce 400ms) */}
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

            {(isAdmin || isPimpinan) && (
              <button
                onClick={() => setShowRotation((v) => !v)}
                aria-expanded={showRotation}
                aria-controls="piket-rotation-panel"
                className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all w-full sm:w-fit ${
                  showRotation
                    ? "text-green-800 bg-green-50 border-green-300"
                    : "text-gray-700 bg-white border-gray-200 hover:border-green-300"
                }`}
              >
                <i
                  className={`fa-solid ${
                    showRotation ? "fa-chevron-up" : "fa-arrows-rotate"
                  }`}
                ></i>
                {showRotation ? "Tutup Jadwal Bergilir" : "Atur Jadwal Bergilir"}
              </button>
            )}

            {isAdmin && (
              <button
                onClick={openAssign}
                className="px-5 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all w-full sm:w-fit"
                style={{ backgroundColor: "#1a7a1a" }}
              >
                <i className="fa-solid fa-user-plus"></i> Assign Piket
              </button>
            )}
          </div>
        </div>

        {/* Giliran (cycle) piket: daftar pegawai berurut yang bergiliran
            otomatis tiap Sabtu. Disembunyikan secara default dan dibuka lewat
            tombol "Atur Jadwal Bergilir". Admin bisa mengubah; Pimpinan hanya
            melihat. Dihapus dari DOM saat tertutup supaya tidak memuat data
            giliran yang belum dibutuhkan. */}
        {showRotation && (isAdmin || isPimpinan) && (
          <div id="piket-rotation-panel">
            <PiketRotationCard canEdit={isAdmin} />
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-sm font-semibold text-gray-500">
            Memuat data...
          </div>
        ) : isEmpty ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <i
              className={`fa-solid ${
                search ? "fa-magnifying-glass" : "fa-broom"
              } text-3xl text-gray-300 mb-2`}
            ></i>
            <p className="text-sm font-semibold text-gray-500">
              {search
                ? `Tidak ada jadwal piket untuk "${search}" pada tanggal ini.`
                : "Belum ada jadwal piket pada tanggal ini."}
            </p>
          </div>
        ) : (
          <>
            {/* Tampilan kartu - mobile & tablet */}
            <div className="flex flex-col gap-3 lg:hidden">
              {piket.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-gray-800">
                        {p.user?.name}
                      </div>
                      <div className="text-xs font-semibold text-gray-500 mt-0.5 flex items-center gap-1.5">
                        <i className="fa-solid fa-calendar-days text-gray-400"></i>
                        {p.tanggal}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-green-700 bg-green-100">
                      <i className="fa-solid fa-circle-check"></i> Terkonfirmasi
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && renderSwapActions(p)}
                      {isAdmin && (
                        <button
                          onClick={() => handleHapus(p.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Baris pending: sudah dipilih lewat Assign, belum dikonfirmasi */}
              {draftPegawai.map((d) => (
                <div
                  key={`draft-${d.id}`}
                  className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 border-2 border-dashed border-amber-300"
                >
                  <div>
                    <div className="font-extrabold text-gray-800">
                      {d.name}
                    </div>
                    <div className="text-xs font-semibold text-gray-500 mt-1 flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar-days text-gray-400"></i>
                      {tanggal}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-100">
                      <i className="fa-solid fa-clock"></i> Menunggu konfirmasi
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => removeDraftPegawai(d.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-all"
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Tampilan tabel - desktop */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Nama
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Tanggal
                      </th>
                      <th className="text-left px-5 py-4 text-sm font-extrabold text-gray-700">
                        Status
                      </th>
                      {isAdmin && <th className="px-5 py-4"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {piket.map((p, i) => (
                      <tr
                        key={p.id}
                        className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
                      >
                        <td className="px-5 py-3 font-extrabold text-gray-800">
                          {p.user?.name}
                        </td>
                        <td className="px-5 py-3 font-semibold text-gray-600 text-sm">
                          {p.tanggal}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-green-700 bg-green-100">
                            <i className="fa-solid fa-circle-check"></i>{" "}
                            Terkonfirmasi
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2 justify-end flex-wrap">
                              {renderSwapActions(p)}
                              <button
                                onClick={() => handleHapus(p.id)}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
                              >
                                hapus
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* Baris pending: menunggu tombol Konfirmasi */}
                    {draftPegawai.map((d) => (
                      <tr key={`draft-${d.id}`} className="bg-amber-50">
                        <td className="px-5 py-3 font-extrabold text-gray-800">
                          {d.name}
                        </td>
                        <td className="px-5 py-3 font-semibold text-gray-600 text-sm">
                          {tanggal}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-100">
                            <i className="fa-solid fa-clock"></i> Menunggu
                            konfirmasi
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3">
                            <button
                              onClick={() => removeDraftPegawai(d.id)}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-all"
                            >
                              batalkan
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tombol Konfirmasi - di luar komponen Assign, tepat di atas
                deretan nomor halaman. Notifikasi dikirim otomatis backend
                saat tombol ini ditekan. */}
            {/* Tombol Konfirmasi selalu tampil untuk admin (walau sudah
                dikonfirmasi) - nonaktif saat tidak ada pegawai pending. */}
            {isAdmin && (
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleKonfirmasi}
                  disabled={draftPegawai.length === 0 || saving}
                  className="px-5 py-2.5 rounded-xl text-white font-bold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
                  style={{ backgroundColor: "#1a7a1a" }}
                >
                  <i className="fa-solid fa-check-to-slot"></i>
                  {saving
                    ? "Menyimpan..."
                    : `Konfirmasi Piket (${draftPegawai.length})`}
                </button>
              </div>
            )}

            <Pagination
              page={page}
              limit={PAGE_SIZE}
              total={total}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>

      {isAdmin && showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-extrabold text-gray-800 mb-1">
              Assign Piket ({tanggal})
            </h2>
            <p className="text-xs font-semibold text-gray-500 mb-4">
              Pegawai yang ditambahkan muncul di list jadwal piket sebagai
              baris &ldquo;menunggu konfirmasi&rdquo;.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <select
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">Pilih Pegawai</option>
                  {pegawaiList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addDraftPegawai}
                  disabled={!form.userId}
                  className="px-4 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-40 shrink-0"
                  style={{ backgroundColor: "#1a7a1a" }}
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>

              {draftPegawai.length > 0 && (
                <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  {draftPegawai.length} pegawai menunggu konfirmasi di list.
                  Tutup modal lalu tekan tombol Konfirmasi Piket.
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-gray-600 font-bold text-sm bg-gray-100 hover:bg-gray-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajukan tukar jadwal piket */}
      {isAdmin && showSwapModal && swapTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-extrabold text-gray-800 mb-1">
              Ajukan Tukar Piket
            </h2>
            <div className="text-xs font-semibold text-gray-500 mb-4 flex flex-col gap-1">
              <span>
                <i className="fa-solid fa-user text-gray-400 mr-1.5"></i>
                {swapTarget.user?.name} · {swapTarget.tanggal}
              </span>
              <span>
                Pegawai pengganti menyetujui secara lisan ke Admin, lalu Admin
                mencatat kesediaannya sebelum keputusan akhir.
              </span>
            </div>
            <select
              value={swapForm.replacementUserId}
              onChange={(e) =>
                setSwapForm({ replacementUserId: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Pilih Pegawai Pengganti</option>
              {pegawaiList
                .filter(
                  (u) =>
                    u.id !== swapTarget.user?.id &&
                    !piket.some((p) => p.user?.id === u.id),
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleRequestSwap}
                disabled={!swapForm.replacementUserId || swapSaving}
                className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "#1a7a1a" }}
              >
                {swapSaving ? "Mengajukan..." : "Ajukan Tukar"}
              </button>
              <button
                onClick={() => setShowSwapModal(false)}
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
