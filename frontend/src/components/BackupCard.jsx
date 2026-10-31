import { useEffect, useRef, useState } from "react";
import api, { getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

const TABLE_LABELS = {
  admin_accounts: "Akun Admin/Pimpinan",
  users: "Pegawai",
  work_schedules: "Jadwal Kerja",
  system_settings: "Parameter Sistem",
  qr_codes: "QR Code",
  attendances: "Absensi",
  leaves: "Izin/Cuti",
  piket_schedules: "Jadwal Piket",
  piket_swaps: "Tukar Jadwal Piket",
  notifications: "Notifikasi",
  push_tokens: "Push Token",
  activity_logs: "Log Aktivitas",
};

// Card backup data sistem (admin saja). Menampilkan ringkasan jumlah baris
// per tabel (GET /api/backup/stats) dan tombol unduh backup JSON lengkap
// (GET /api/backup/export, respons = file attachment).
export default function BackupCard() {
  const { user } = useAuth();
  const { alert } = useModal();
  const isAdmin = user?.role === "admin";

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Restore: file terpilih + teks konfirmasi (harus persis "RESTORE").
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    // Microtask: setLoading tidak boleh jalan sinkron di badan effect
    // (rule react-hooks/set-state-in-effect).
    Promise.resolve().then(loadStats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.get("/backup/stats");
      setStats(res.data.data.tables);
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal memuat ringkasan backup."), {
        title: "Gagal Memuat Data",
        danger: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePickRestoreFile = (e) => {
    const f = e.target.files?.[0] || null;
    setRestoreFile(f);
    setRestoreConfirm("");
  };

  const clearRestoreForm = () => {
    setRestoreFile(null);
    setRestoreConfirm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      await alert("Pilih file backup JSON terlebih dahulu.", {
        title: "File Belum Dipilih",
      });
      return;
    }
    if (restoreConfirm.trim().toUpperCase() !== "RESTORE") {
      await alert('Ketik "RESTORE" pada kolom konfirmasi untuk melanjutkan.', {
        title: "Konfirmasi Diperlukan",
      });
      return;
    }

    setRestoring(true);
    try {
      const fd = new FormData();
      fd.append("file", restoreFile);
      fd.append("confirm", restoreConfirm.trim().toUpperCase());
      const res = await api.post("/backup/restore", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Tabel yang tidak ada di file backup tidak ikut di-restore. Tampilkan
      // supaya file lama (mis. tanpa `piket_swaps`) tidak lewat tanpa disadari.
      const missingTables = res.data?.data?.missing_tables || [];
      if (missingTables.length > 0) {
        await alert(
          `Restore berhasil, namun file backup tidak memuat ${missingTables.length} tabel: ` +
            `${missingTables.join(", ")}. Tabel tersebut tidak ikut dipulihkan - ` +
            "unduh ulang backup dari versi terbaru agar seluruh data tercakup.",
          { title: "Restore Sebagian", danger: true },
        );
      } else {
        await alert(
          res.data.message || "Restore data berhasil.",
          { title: "Restore Berhasil" },
        );
      }
      clearRestoreForm();
      await loadStats();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal melakukan restore data."), {
        title: "Gagal Restore",
        danger: true,
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // responseType blob: axios menyimpan file attachment utuh, bukan JSON
      // yang di-parse (endpoint /export mengembalikan file, bukan envelope
      // { success, data } seperti endpoint lain).
      const res = await api.get("/backup/export", {
        responseType: "blob",
      });

      // Ambil nama file dari header Content-Disposition (fallback nama default).
      const disposition = res.headers?.["content-disposition"] || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match
        ? match[1]
        : `backup-bumdesma-${new Date().toISOString().slice(0, 10)}.json`;

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal mengunduh backup data."), {
        title: "Gagal Mengunduh",
        danger: true,
      });
    } finally {
      setDownloading(false);
    }
  };

  if (!isAdmin) return null; // Pimpinan tidak melihat card ini

  const totalRows = stats
    ? Object.values(stats).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 text-gray-700 font-extrabold mb-1">
        <i className="fa-solid fa-database text-green-700"></i> Backup Data
      </div>
      <p className="text-xs text-gray-400 font-semibold mb-4">
        Unduh salinan seluruh data sistem dalam satu file JSON. Simpan file di
        tempat aman - file berisi data sensitif termasuk password (ter-hash).
      </p>

      {loading ? (
        <div className="text-sm font-semibold text-gray-500 py-2">
          Memuat ringkasan data...
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
          {Object.entries(stats).map(([table, count]) => (
            <div
              key={table}
              className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
            >
              <div className="text-[10px] font-bold text-gray-400 uppercase truncate">
                {TABLE_LABELS[table] || table}
              </div>
              <div className="text-lg font-extrabold text-gray-800">
                {count.toLocaleString("id-ID")}
              </div>
            </div>
          ))}
          <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            <div className="text-[10px] font-bold text-green-600 uppercase">
              Total Baris
            </div>
            <div className="text-lg font-extrabold text-green-800">
              {totalRows.toLocaleString("id-ID")}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleDownload}
          disabled={downloading || loading}
          className="px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-2 hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: "#1a7a1a" }}
        >
          <i className="fa-solid fa-download"></i>
          {downloading ? "Menyiapkan backup..." : "Unduh Backup JSON"}
        </button>
        <button
          onClick={loadStats}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-gray-600 font-bold text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
        >
          <i className="fa-solid fa-rotate"></i> Segarkan
        </button>
      </div>

      {/* Restore dari file backup */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-gray-700 font-extrabold mb-1">
          <i className="fa-solid fa-file-import text-green-700"></i> Restore
          Data
        </div>
        <p className="text-xs text-gray-400 font-semibold mb-3">
          Unggah file backup JSON untuk memulihkan data. Seluruh data yang ada
          sekarang akan dihapus dan diganti isi file backup.
        </p>

        <div className="flex flex-col lg:flex-row lg:items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handlePickRestoreFile}
            className="text-xs font-semibold text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 file:cursor-pointer"
          />
          <input
            value={restoreConfirm}
            onChange={(e) => setRestoreConfirm(e.target.value)}
            placeholder='Ketik "RESTORE" untuk konfirmasi'
            disabled={!restoreFile || restoring}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60 lg:w-64"
          />
          <button
            onClick={handleRestore}
            disabled={!restoreFile || restoring}
            className="px-4 py-2 rounded-xl text-white font-bold text-xs bg-red-500 hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
          >
            <i className="fa-solid fa-rotate-left"></i>
            {restoring ? "Memulihkan..." : "Restore Sekarang"}
          </button>
          {restoreFile && !restoring && (
            <button
              onClick={clearRestoreForm}
              className="text-xs font-bold text-gray-400 hover:text-gray-600"
            >
              Batal
            </button>
          )}
        </div>
        {restoreFile && (
          <p className="text-xs font-semibold text-gray-500 mt-2">
            File terpilih: {restoreFile.name} ({" "}
            {(restoreFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>
    </div>
  );
}
