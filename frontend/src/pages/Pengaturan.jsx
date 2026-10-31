import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import {
  IndonesianDatePicker,
  IndonesianMonthPicker,
} from "../components/IndonesianDatePickers";
import AktivitasLogCard from "../components/AktivitasLogCard";
import BackupCard from "../components/BackupCard";
import api, { getErrorMessage, FILE_BASE_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

function ModalWrapper({
  title,
  children,
  onClose,
  onSave,
  saving,
  saveLabel = "Simpan",
  savingLabel = "Menyimpan...",
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-extrabold text-gray-800 mb-4">{title}</h2>
        {children}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "#1a7a1a" }}
          >
            {saving ? savingLabel : saveLabel}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-gray-600 font-bold text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

// Jadwal kerja reguler (Senin-Jumat) dan piket (Sabtu) sekarang diedit
// terpisah lewat tombol "edit" di masing-masing baris tabel, bukan lewat
// satu form gabungan seperti sebelumnya.
function JadwalKerjaModal({ schedule, dayLabel, onClose, onSaved }) {
  const { alert } = useModal();
  const [masuk, setMasuk] = useState(schedule?.start_time?.slice(0, 5) || "");
  const [pulang, setPulang] = useState(schedule?.end_time?.slice(0, 5) || "");
  const [toleransi, setToleransi] = useState(
    schedule?.late_tolerance_minutes ?? 15,
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/work-schedule/${schedule.day_type}`, {
        start_time: `${masuk}:00`,
        end_time: `${pulang}:00`,
        late_tolerance_minutes: Number(toleransi),
      });
      onSaved();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menyimpan jadwal kerja."), {
        title: "Gagal Menyimpan",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      title={`Jam Kerja - ${dayLabel}`}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">
            Jam Masuk
          </label>
          <input
            type="time"
            value={masuk}
            onChange={(e) => setMasuk(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">
            Jam Pulang
          </label>
          <input
            type="time"
            value={pulang}
            onChange={(e) => setPulang(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">
            Toleransi Keterlambatan (menit)
          </label>
          <input
            type="number"
            min="0"
            value={toleransi}
            onChange={(e) => setToleransi(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>
    </ModalWrapper>
  );
}

// Koordinat kantor. Dipisah dari radius geofencing supaya masing-masing
// parameter bisa diubah tanpa perlu mengetik ulang parameter yang lain.
function LokasiModal({ settings, onClose, onSaved }) {
  const { alert } = useModal();
  const [lat, setLat] = useState(settings?.office_latitude ?? "");
  const [lng, setLng] = useState(settings?.office_longitude ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings", {
        office_latitude: lat,
        office_longitude: lng,
      });
      onSaved();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menyimpan lokasi kantor."), {
        title: "Gagal Menyimpan",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      title="Lokasi Kantor"
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">
            Latitude
          </label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">
            Longitude
          </label>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>
    </ModalWrapper>
  );
}

// Radius geofencing, terpisah dari koordinat kantor.
function RadiusModal({ settings, onClose, onSaved }) {
  const { alert } = useModal();
  const [radius, setRadius] = useState(settings?.geofence_radius_meters ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings", { geofence_radius_meters: radius });
      onSaved();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menyimpan radius geofencing."), {
        title: "Gagal Menyimpan",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      title="Radius Geofencing"
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      <div>
        <label className="text-xs font-bold text-gray-500 mb-1 block">
          Radius (meter)
        </label>
        <input
          type="number"
          min="1"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
        />
        <p className="text-xs text-gray-400 font-semibold mt-2">
          Pegawai hanya bisa absen jika berada dalam radius ini dari titik
          koordinat kantor.
        </p>
      </div>
    </ModalWrapper>
  );
}

function PasswordModal({ onClose }) {
  const { alert } = useModal();
  const [form, setForm] = useState({ old: "", new: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (form.new !== form.confirm) {
      await alert("Konfirmasi password baru tidak cocok.", {
        title: "Password Tidak Cocok",
      });
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        oldPassword: form.old,
        newPassword: form.new,
      });
      await alert("Password berhasil diganti.", { title: "Berhasil" });
      onClose();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal mengganti password."), {
        title: "Gagal Mengganti Password",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      title="Ganti Password"
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      <div className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="Password Lama"
          value={form.old}
          onChange={(e) => setForm({ ...form, old: e.target.value })}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
        />
        <input
          type="password"
          placeholder="Password Baru"
          value={form.new}
          onChange={(e) => setForm({ ...form, new: e.target.value })}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
        />
        <input
          type="password"
          placeholder="Konfirmasi Password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
    </ModalWrapper>
  );
}

// Ganti username login untuk Admin/Pimpinan. Wajib konfirmasi password;
// sukses -> user di AuthContext & localStorage di-refresh dengan username
// baru (dipakai ulang oleh Sidebar/Topbar).
function UpdateUsernameModal({ onClose }) {
  const { alert } = useModal();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.username.trim()) {
      await alert("Username baru wajib diisi.", {
        title: "Data Belum Lengkap",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/auth/change-username", {
        newUsername: form.username.trim(),
        password: form.password,
      });
      const nextUser = { ...user, username: res.data.data.username };
      localStorage.setItem("user", JSON.stringify(nextUser));
      setUser(nextUser);
      await alert("Username berhasil diganti.", { title: "Berhasil" });
      onClose();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal mengganti username."), {
        title: "Gagal Mengganti Username",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      title="Ganti Username"
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      <div className="flex flex-col gap-3">
        <input
          value={user?.username ?? ""}
          disabled
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-100 text-gray-400 outline-none"
        />
        <input
          placeholder="Username Baru"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
        />
        <input
          type="password"
          placeholder="Konfirmasi Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
        />
        <p className="text-xs text-gray-400 font-semibold">
          Username 4-50 karakter, hanya huruf, angka, titik, garis bawah, dan
          tanda hubung.
        </p>
      </div>
    </ModalWrapper>
  );
}

// Generate/regenerasi QR Code statis. Sesuai alur di laporan: Admin
// men-generate satu kali lewat halaman Pengaturan, QR Code lama otomatis
// dinonaktifkan setiap kali regenerasi dilakukan.
function GenerateQrModal({ hasExisting, onClose, onSaved }) {
  const { alert } = useModal();
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    setSaving(true);
    try {
      await api.post("/settings/qr-code/generate");
      onSaved();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal men-generate QR Code."), {
        title: "Gagal Generate QR Code",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      title={hasExisting ? "Regenerasi QR Code" : "Generate QR Code"}
      onClose={onClose}
      onSave={handleGenerate}
      saving={saving}
      saveLabel={hasExisting ? "Regenerasi Sekarang" : "Generate Sekarang"}
      savingLabel="Memproses..."
    >
      <p className="text-sm text-gray-600 font-semibold leading-relaxed">
        {hasExisting
          ? "QR Code yang lama akan otomatis dinonaktifkan dan diganti dengan yang baru. Pastikan gambar QR yang tercetak di kantor segera diganti setelah ini, karena QR Code lama tidak lagi bisa dipakai untuk absen."
          : "Sistem akan membuat QR Code statis untuk titik absensi kantor. QR Code ini berlaku selamanya dan dapat dicetak untuk dipasang di kantor."}
      </p>
    </ModalWrapper>
  );
}

// Format tanggal ISO (yyyy-mm-dd) ke teks Indonesia, mis. "Sen, 12 Agu 2026".
function formatTanggal(iso) {
  if (!iso) return "-";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Jumlah hari kalender dalam rentang libur (inklusif, minimal 1).
function jumlahHariLibur(mulai, selesai) {
  const a = new Date(`${mulai}T00:00:00`);
  const b = new Date(`${selesai}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a)
    return 1;
  return Math.round((b - a) / 86400000) + 1;
}

// Menambahkan/mengedit rentang tanggal hari libur nasional / cuti bersama.
// Mendukung rentang multi-hari (mis. libur panjang Lebaran) dengan pola
// input yang sama seperti form Izin/Cuti di app mobile: tanggal mulai +
// tanggal selesai, plus keterangan bebas untuk menjelaskan hari libur
// tersebut. Tanggal yang masuk rentang ini akan otomatis menutup akses
// scanning pegawai.
//
// [editData] diisi kalau modal dibuka untuk mengedit entri yang sudah ada
// (null berarti mode tambah baru).
function HariLiburModal({ existing, editData, editIndex, onClose, onSaved }) {
  const { alert } = useModal();
  const isEdit = !!editData;
  const [mulai, setMulai] = useState(editData?.tanggal_mulai || "");
  const [selesai, setSelesai] = useState(editData?.tanggal_selesai || "");
  const [keterangan, setKeterangan] = useState(editData?.keterangan || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!mulai || !selesai) {
      await alert("Tanggal mulai dan tanggal selesai wajib diisi.", {
        title: "Data Belum Lengkap",
      });
      return;
    }
    if (selesai < mulai) {
      await alert("Tanggal selesai tidak boleh sebelum tanggal mulai.", {
        title: "Tanggal Tidak Valid",
      });
      return;
    }

    // Cegah rentang tanggal yang bertumpuk dengan entri hari libur lain.
    // Saat mode edit, entri yang sedang diedit dikecualikan lewat index-nya
    // (bukan perbandingan referensi object, karena getHolidays() membuat
    // object baru setiap render sehingga h === editData selalu false).
    const overlaps = existing.some((h, idx) => {
      if (isEdit && idx === editIndex) return false;
      return mulai <= h.tanggal_selesai && selesai >= h.tanggal_mulai;
    });
    if (overlaps) {
      await alert(
        "Rentang tanggal ini bertumpuk dengan hari libur lain yang sudah ada.",
        { title: "Tanggal Bertumpuk" },
      );
      return;
    }

    setSaving(true);
    try {
      const entry = {
        tanggal_mulai: mulai,
        tanggal_selesai: selesai,
        keterangan,
      };
      let next;
      if (isEdit) {
        next = existing.map((h, idx) => (idx === editIndex ? entry : h));
      } else {
        next = [...existing, entry];
      }
      next.sort((a, b) => a.tanggal_mulai.localeCompare(b.tanggal_mulai));
      await api.put("/settings", { national_holidays: next });
      onSaved();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menyimpan hari libur."), {
        title: "Gagal Menyimpan",
        danger: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      title={isEdit ? "Edit Hari Libur" : "Tambah Hari Libur Nasional"}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">
              Tanggal Mulai
            </label>
            <IndonesianDatePicker
              value={mulai}
              onChange={(val) => {
                setMulai(val);
                // Jaga agar tanggal selesai tidak pernah lebih awal dari
                // tanggal mulai yang baru dipilih.
                if (!selesai || selesai < val) setSelesai(val);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">
              Tanggal Selesai
            </label>
            <IndonesianDatePicker
              value={selesai}
              minISO={mulai || undefined}
              onChange={setSelesai}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">
            Keterangan
          </label>
          <input
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Contoh: Cuti Bersama Hari Raya Idul Fitri"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {mulai && selesai && selesai >= mulai && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 flex items-start gap-3">
            <i className="fa-solid fa-calendar-check text-green-700 mt-0.5"></i>
            <div>
              <div className="text-sm font-extrabold text-green-800">
                {mulai === selesai
                  ? formatTanggal(mulai)
                  : `${formatTanggal(mulai)} — ${formatTanggal(selesai)}`}
              </div>
              <div className="text-xs font-semibold text-green-600 mt-0.5">
                {jumlahHariLibur(mulai, selesai)} hari libur · pegawai tidak
                dapat absensi pada rentang ini
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 font-semibold">
          Untuk hari libur satu hari, isi tanggal mulai dan tanggal selesai
          dengan tanggal yang sama.
        </p>
      </div>
    </ModalWrapper>
  );
}

export default function Pengaturan() {
  const { user } = useAuth();
  const { alert, confirm } = useModal();
  const isAdmin = user?.role === "admin"; // Pimpinan: hanya lihat, tidak bisa ubah konfigurasi
  const [activeModal, setActiveModal] = useState(null);
  const [settingsData, setSettingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);

  // Filter bulan, tahun & status untuk daftar Hari Libur Nasional, dan
  // index entri yang sedang diedit di array holidays (null = modal tambah
  // baru). Index dipakai, bukan referensi object, karena getHolidays()
  // membuat object baru setiap render.
  const [holidayFilterMonth, setHolidayFilterMonth] = useState("");
  const [holidayFilterYear, setHolidayFilterYear] = useState("");
  const [holidayFilterStatus, setHolidayFilterStatus] = useState("semua");
  const [editingHolidayIndex, setEditingHolidayIndex] = useState(null);

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/settings");
      setSettingsData(res.data.data);
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal memuat info sistem."), {
        title: "Gagal Memuat Data",
        danger: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQr = async () => {
    setQrLoading(true);
    try {
      const res = await api.get("/settings/qr-code");
      setQr(res.data.data);
    } catch {
      // Belum pernah generate -> backend membalas 404, itu kondisi normal di sini.
      setQr(null);
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    // Microtask: setLoading/setQrLoading di dalam loader tidak boleh jalan
    // sinkron di badan effect (rule react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      loadSettings();
      loadQr();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menormalisasi data hari libur ke bentuk rentang tanggal + keterangan.
  // Mendukung format lama (array tanggal string tunggal, mis.
  // ["2026-08-17"]) sekaligus format baru (array objek
  // { tanggal_mulai, tanggal_selesai, keterangan }) supaya data lama yang
  // sudah tersimpan tetap tampil dengan benar.
  const getHolidays = () => {
    const raw = settingsData?.settings?.national_holidays;
    let list;
    try {
      list = typeof raw === "string" ? JSON.parse(raw) : raw || [];
    } catch {
      list = [];
    }
    return list.map((item) =>
      typeof item === "string"
        ? { tanggal_mulai: item, tanggal_selesai: item, keterangan: "" }
        : {
            tanggal_mulai: item.tanggal_mulai ?? item.start ?? "",
            tanggal_selesai:
              item.tanggal_selesai ??
              item.end ??
              item.tanggal_mulai ??
              item.start ??
              "",
            keterangan: item.keterangan ?? "",
          },
    );
  };

  const holidays = getHolidays();

  const close = () => {
    setActiveModal(null);
    setEditingHolidayIndex(null);
  };
  const saved = () => {
    close();
    loadSettings();
    loadQr();
  };

  const openHolidayModal = (holiday = null) => {
    // Simpan index di array holidays, bukan object-nya. Object dari
    // getHolidays() dibuat ulang tiap render sehingga referensi tidak stabil.
    setEditingHolidayIndex(holiday ? holidays.indexOf(holiday) : null);
    setActiveModal("hari-libur");
  };

  const handleDeleteHoliday = async (holiday) => {
    const label =
      holiday.tanggal_mulai === holiday.tanggal_selesai
        ? holiday.tanggal_mulai
        : `${holiday.tanggal_mulai} s/d ${holiday.tanggal_selesai}`;
    const confirmed = await confirm(`Hapus hari libur ${label}?`, {
      title: "Hapus Hari Libur",
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const idx = holidays.indexOf(holiday);
      const next = holidays.filter((_, i) => i !== idx);
      await api.put("/settings", { national_holidays: next });
      await loadSettings();
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menghapus hari libur."), {
        title: "Gagal Menghapus",
        danger: true,
      });
    }
  };

  const handlePrintQr = () => {
    if (!qr?.image_path) return;
    const url = `${FILE_BASE_URL}${qr.image_path}`;
    const win = window.open("", "_blank", "width=480,height=640");
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>Cetak QR Code Absensi</title></head>
        <body style="text-align:center;font-family:sans-serif;padding:40px;">
          <h2 style="margin-bottom:4px;">QR Code Absensi</h2>
          <p style="margin-top:0;color:#555;">BUMDESMA Podo Rukun LKD</p>
          <img src="${url}" style="width:320px;height:320px;margin-top:20px;" />
        </body>
      </html>
    `);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  };

  const jadwalReguler = settingsData?.workSchedules?.find(
    (ws) => ws.day_type === "reguler",
  );
  const jadwalSabtu = settingsData?.workSchedules?.find(
    (ws) => ws.day_type === "sabtu",
  );
  const settings = settingsData?.settings || {};
  const lat = settings.office_latitude;
  const lng = settings.office_longitude;
  const hasCoords =
    lat !== undefined &&
    lat !== null &&
    lat !== "" &&
    lng !== undefined &&
    lng !== null &&
    lng !== "";
  const mapsSrc = hasCoords
    ? `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`
    : null;

  const allCards = [
    {
      id: "lokasi",
      icon: "fa-location-dot",
      label: "Lokasi Kantor",
      adminOnly: true,
    },
    {
      id: "radius",
      icon: "fa-satellite-dish",
      label: "Radius Geofencing",
      adminOnly: true,
    },
    {
      id: "qr",
      icon: "fa-qrcode",
      label: qr ? "Regenerasi QR Code" : "Generate QR Code",
      adminOnly: true,
    },
    {
      id: "password",
      icon: "fa-lock",
      label: "Ganti Password",
      adminOnly: false,
    },
    {
      id: "username",
      icon: "fa-user-pen",
      label: "Ganti Username",
      adminOnly: false,
    },
  ];
  const cards = allCards.filter((c) => isAdmin || !c.adminOnly);

  const today = todayISO();

  // Tahun-tahun yang tersedia untuk dropdown filter, diambil dari tanggal
  // mulai/selesai seluruh entri libur (selalu terurut menaik, unik).
  const holidayYears = Array.from(
    new Set(
      holidays.flatMap((h) =>
        [h.tanggal_mulai?.slice(0, 4), h.tanggal_selesai?.slice(0, 4)].filter(
          Boolean,
        ),
      ),
    ),
  ).sort();

  // Daftar hari libur yang sudah difilter berdasarkan bulan/tahun terpilih
  // (kalau ada) dan status (semua / akan datang / selesai), diurutkan
  // berdasarkan tanggal mulai. Entri berlangsung dihitung masuk "akan datang".
  const filteredHolidays = holidays
    .filter((h) => {
      // Filter tahun: rentang libur menyentuh tahun terpilih.
      if (holidayFilterYear) {
        const yearStart = `${holidayFilterYear}-01-01`;
        const yearEnd = `${holidayFilterYear}-12-31`;
        if (h.tanggal_selesai < yearStart || h.tanggal_mulai > yearEnd)
          return false;
      }
      // Filter bulan: rentang libur menyentuh bulan terpilih.
      if (!holidayFilterMonth) return true;
      const [fy, fm] = holidayFilterMonth.split("-");
      const monthStart = `${fy}-${fm}-01`;
      const monthEnd = `${fy}-${fm}-31`;
      return h.tanggal_mulai <= monthEnd && h.tanggal_selesai >= monthStart;
    })
    .filter((h) => {
      if (holidayFilterStatus === "semua") return true;
      const selesai = h.tanggal_selesai >= today;
      if (holidayFilterStatus === "akan-datang") return selesai;
      return !selesai; // "selesai"
    })
    .sort((a, b) => a.tanggal_mulai.localeCompare(b.tanggal_mulai));

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-h-screen">
      <Topbar title="Pengaturan" />
      <div className="p-6">
        {loading ? (
          <div className="mb-8 text-center text-sm font-semibold text-gray-500">
            Memuat info sistem...
          </div>
        ) : (
          <div className="mb-8 flex flex-col gap-4">
            <h2 className="text-lg font-extrabold text-gray-800">
              Info Sistem
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3 text-gray-700 font-extrabold">
                  <i className="fa-solid fa-satellite-dish text-green-700"></i>{" "}
                  Radius Geofencing
                </div>
                <div className="text-3xl font-extrabold text-gray-800">
                  {settings.geofence_radius_meters ?? "-"}{" "}
                  <span className="text-base font-bold text-gray-400">
                    meter
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-semibold mt-2">
                  Pegawai hanya bisa melakukan absensi jika berada dalam radius
                  ini dari titik kantor.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3 text-gray-700 font-extrabold">
                  <i className="fa-solid fa-location-dot text-green-700"></i>{" "}
                  Koordinat Kantor
                </div>
                <div className="text-sm font-bold text-gray-800">
                  Latitude: {lat ?? "-"}
                </div>
                <div className="text-sm font-bold text-gray-800">
                  Longitude: {lng ?? "-"}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3 text-gray-700 font-extrabold">
                <i className="fa-solid fa-map-location-dot text-green-700"></i>{" "}
                Lokasi Kantor
              </div>
              {mapsSrc ? (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    title="Lokasi Kantor"
                    src={mapsSrc}
                    width="100%"
                    height="280"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
              ) : (
                <p className="text-sm text-gray-500 font-semibold">
                  Koordinat kantor belum diatur.
                </p>
              )}
            </div>

            {/* Jam Kerja - setiap baris punya tombol edit sendiri-sendiri */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3 text-gray-700 font-extrabold">
                <i className="fa-solid fa-business-time text-green-700"></i> Jam
                Kerja
              </div>
              {!settingsData?.workSchedules?.length ? (
                <p className="text-sm text-gray-500 font-semibold">
                  Belum ada jadwal kerja.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-gray-500 font-bold">
                      <th className="py-2 pr-3">Jadwal</th>
                      <th className="py-2 pr-3">Masuk</th>
                      <th className="py-2 pr-3">Pulang</th>
                      <th className="py-2 pr-3">Toleransi</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {settingsData.workSchedules.map((ws) => (
                      <tr
                        key={ws.id}
                        className="border-b border-gray-50 last:border-0"
                      >
                        <td className="py-2 pr-3 font-extrabold text-gray-800">
                          {ws.label}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-gray-700">
                          {ws.start_time?.slice(0, 5)}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-gray-700">
                          {ws.end_time?.slice(0, 5)}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-gray-700">
                          {ws.late_tolerance_minutes} menit
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-xs font-bold ${ws.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                          >
                            {ws.is_active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="py-2">
                          {isAdmin && (
                            <button
                              onClick={() =>
                                setActiveModal(`jadwal-${ws.day_type}`)
                              }
                              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-all"
                            >
                              edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* QR Code Absensi */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-700 font-extrabold">
                  <i className="fa-solid fa-qrcode text-green-700"></i> QR Code
                  Absensi
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setActiveModal("qr")}
                    className="px-4 py-2 rounded-xl text-white font-bold text-xs hover:opacity-90"
                    style={{ backgroundColor: "#1a7a1a" }}
                  >
                    {qr ? "Regenerasi QR Code" : "Generate QR Code"}
                  </button>
                )}
              </div>

              {qrLoading ? (
                <p className="text-sm text-gray-500 font-semibold">
                  Memuat QR Code...
                </p>
              ) : qr ? (
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="p-4 border border-gray-200 rounded-xl">
                    <img
                      src={`${FILE_BASE_URL}${qr.image_path}`}
                      alt="QR Code Absensi"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                  <p className="text-xs text-gray-400 font-semibold">
                    Dibuat {new Date(qr.generated_at).toLocaleString("id-ID")}
                  </p>
                  <button
                    onClick={handlePrintQr}
                    className="px-5 py-2.5 rounded-xl text-white font-bold text-sm flex items-center gap-2 hover:opacity-90 bg-blue-600"
                  >
                    <i className="fa-solid fa-print"></i> Cetak QR Code
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 font-semibold">
                  Belum ada QR Code yang di-generate. Klik "Generate QR Code"
                  untuk membuatnya, lalu cetak dan pasang di kantor.
                </p>
              )}
            </div>

            {/* Hari Libur Nasional */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2 text-gray-700 font-extrabold">
                  <i className="fa-solid fa-calendar-day text-green-700"></i>{" "}
                  Hari Libur Nasional
                  {holidays.length > 0 && (
                    <span className="text-xs font-extrabold bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                      {holidays.length}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => openHolidayModal(null)}
                    className="px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 hover:opacity-90"
                    style={{ backgroundColor: "#1a7a1a" }}
                  >
                    <i className="fa-solid fa-plus"></i> Tambah Hari Libur
                  </button>
                )}
              </div>

              {/* Filter bulan & status */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <label className="text-xs font-bold text-gray-500">
                  Filter Bulan:
                </label>
                <div className="w-44">
                  <IndonesianMonthPicker
                    value={holidayFilterMonth}
                    onChange={setHolidayFilterMonth}
                  />
                </div>
                <label className="text-xs font-bold text-gray-500">
                  Filter Tahun:
                </label>
                <select
                  value={holidayFilterYear}
                  onChange={(e) => setHolidayFilterYear(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">Semua Tahun</option>
                  {holidayYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <label className="text-xs font-bold text-gray-500 ml-2">
                  Status:
                </label>
                <select
                  value={holidayFilterStatus}
                  onChange={(e) => setHolidayFilterStatus(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="semua">Semua</option>
                  <option value="akan-datang">Akan Datang</option>
                  <option value="selesai">Selesai</option>
                </select>
                {(holidayFilterMonth ||
                  holidayFilterYear ||
                  holidayFilterStatus !== "semua") && (
                  <button
                    onClick={() => {
                      setHolidayFilterMonth("");
                      setHolidayFilterYear("");
                      setHolidayFilterStatus("semua");
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-gray-600"
                  >
                    Reset
                  </button>
                )}
              </div>

              {filteredHolidays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <i className="fa-solid fa-umbrella-beach text-gray-400"></i>
                  </div>
                  <p className="text-sm font-bold text-gray-500">
                    {holidayFilterMonth ||
                    holidayFilterYear ||
                    holidayFilterStatus !== "semua"
                      ? "Tidak ada hari libur yang cocok dengan filter."
                      : "Belum ada hari libur yang ditetapkan."}
                  </p>
                  <p className="text-xs text-gray-400 font-semibold mt-1">
                    {holidayFilterMonth ||
                    holidayFilterYear ||
                    holidayFilterStatus !== "semua"
                      ? "Coba ubah bulan/tahun/status atau reset filter."
                      : isAdmin
                        ? 'Klik "Tambah Hari Libur" untuk menetapkan tanggal libur.'
                        : "Hari libur akan tampil di sini setelah ditetapkan admin."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {filteredHolidays.map((h, i) => {
                    const isSingleDay = h.tanggal_mulai === h.tanggal_selesai;
                    // Hari libur yang tanggal selesainya sudah lewat tidak
                    // lagi bisa diedit/dihapus - hanya ditampilkan sebagai
                    // riwayat.
                    const isUpcoming = h.tanggal_selesai >= today;
                    const isOngoing = isUpcoming && h.tanggal_mulai <= today;

                    // Status tampil: berlangsung (hari ini libur), akan
                    // datang, atau sudah selesai (riwayat).
                    const statusLabel = isOngoing
                      ? "Berlangsung"
                      : isUpcoming
                        ? "Akan Datang"
                        : "Selesai";
                    const statusClass = isOngoing
                      ? "bg-green-600 text-white"
                      : isUpcoming
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-gray-100 text-gray-400";

                    // Badge tanggal: angka hari + singkatan bulan dari
                    // tanggal mulai, abu-abu kalau sudah jadi riwayat.
                    const mulaiDate = new Date(`${h.tanggal_mulai}T00:00:00`);
                    const dayNumber = Number.isNaN(mulaiDate.getTime())
                      ? "-"
                      : mulaiDate.getDate();
                    const monthShort = Number.isNaN(mulaiDate.getTime())
                      ? ""
                      : mulaiDate.toLocaleDateString("id-ID", {
                          month: "short",
                        });

                    const rentangTeks = isSingleDay
                      ? formatTanggal(h.tanggal_mulai)
                      : `${formatTanggal(h.tanggal_mulai)} — ${formatTanggal(h.tanggal_selesai)}`;

                    return (
                      <div
                        key={`${h.tanggal_mulai}-${h.tanggal_selesai}-${i}`}
                        className={`flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 transition-colors flex-wrap ${
                          isUpcoming
                            ? "hover:border-green-200 hover:bg-green-50/50"
                            : "opacity-75"
                        }`}
                      >
                        <div
                          className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl shrink-0 ${
                            isUpcoming ? "bg-green-100" : "bg-gray-200/70"
                          }`}
                        >
                          <span
                            className={`text-[10px] font-extrabold uppercase ${
                              isUpcoming ? "text-green-700" : "text-gray-400"
                            }`}
                          >
                            {monthShort}
                          </span>
                          <span
                            className={`text-xl font-extrabold leading-none ${
                              isUpcoming ? "text-green-800" : "text-gray-500"
                            }`}
                          >
                            {dayNumber}
                          </span>
                        </div>

                        <div className="flex-1 min-w-[180px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-gray-800">
                              {h.keterangan || "Hari Libur"}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-lg ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-gray-500 mt-0.5">
                            {rentangTeks} ·{" "}
                            {jumlahHariLibur(
                              h.tanggal_mulai,
                              h.tanggal_selesai,
                            )}{" "}
                            hari
                          </div>
                        </div>

                        {isAdmin && isUpcoming && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openHolidayModal(h)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-all flex items-center gap-1"
                            >
                              <i className="fa-solid fa-pen"></i> edit
                            </button>
                            <button
                              onClick={() => handleDeleteHoliday(h)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-all flex items-center gap-1"
                            >
                              <i className="fa-solid fa-trash"></i> hapus
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-gray-400 font-semibold mt-3">
                Pegawai tidak dapat melakukan absensi pada tanggal yang termasuk
                dalam rentang hari libur.
              </p>
            </div>
          </div>
        )}

        {/* Backup data sistem (admin saja) */}
        <div className="mb-4">
          <BackupCard />
        </div>

        {/* Log aktivitas sistem (admin saja, expand/collapse) */}
        <div className="mb-8">
          <AktivitasLogCard />
        </div>

        <h2 className="text-lg font-extrabold text-gray-800 mb-4">
          Ubah Pengaturan
        </h2>
        <div className="flex gap-4 flex-wrap">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveModal(c.id)}
              className="w-36 h-36 rounded-2xl text-white flex flex-col items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-sm"
              style={{ backgroundColor: "#1a7a1a" }}
            >
              <i className={`fa-solid ${c.icon} text-3xl`}></i>
              <span className="font-extrabold text-sm text-center leading-tight">
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeModal === "lokasi" && (
        <LokasiModal settings={settings} onClose={close} onSaved={saved} />
      )}
      {activeModal === "radius" && (
        <RadiusModal settings={settings} onClose={close} onSaved={saved} />
      )}
      {activeModal === "password" && <PasswordModal onClose={close} />}
      {activeModal === "username" && (
        <UpdateUsernameModal onClose={close} />
      )}
      {activeModal === "qr" && (
        <GenerateQrModal hasExisting={!!qr} onClose={close} onSaved={saved} />
      )}
      {activeModal === "hari-libur" && (
        <HariLiburModal
          existing={holidays}
          editData={
            editingHolidayIndex !== null
              ? holidays[editingHolidayIndex]
              : null
          }
          editIndex={editingHolidayIndex}
          onClose={close}
          onSaved={saved}
        />
      )}
      {activeModal === "jadwal-reguler" && jadwalReguler && (
        <JadwalKerjaModal
          schedule={jadwalReguler}
          dayLabel="Senin - Jumat"
          onClose={close}
          onSaved={saved}
        />
      )}
      {activeModal === "jadwal-sabtu" && jadwalSabtu && (
        <JadwalKerjaModal
          schedule={jadwalSabtu}
          dayLabel="Sabtu (Piket)"
          onClose={close}
          onSaved={saved}
        />
      )}
    </div>
  );
}
