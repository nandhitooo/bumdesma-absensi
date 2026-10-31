import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import {
  IndonesianDatePicker,
  IndonesianMonthPicker,
} from "../components/IndonesianDatePickers";
import api, { getErrorMessage } from "../lib/api";

const PERIOD_TYPES = [
  { id: "harian", label: "Harian", icon: "fa-calendar-day" },
  { id: "mingguan", label: "Mingguan", icon: "fa-calendar-week" },
  { id: "bulanan", label: "Bulanan", icon: "fa-calendar" },
  { id: "tahunan", label: "Tahunan", icon: "fa-calendar-days" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatLong(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShort(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function computeRange(type, refDate, month, year) {
  if (type === "harian") {
    return { start: refDate, end: refDate };
  }
  if (type === "mingguan") {
    const monday = startOfWeek(new Date(`${refDate}T00:00:00`));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: toISO(monday), end: toISO(sunday) };
  }
  if (type === "bulanan") {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start: toISO(start), end: toISO(end) };
  }
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export default function Laporan() {
  const now = new Date();
  const [periodType, setPeriodType] = useState("bulanan");
  const [refDate, setRefDate] = useState(todayISO());
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [year, setYear] = useState(String(now.getFullYear()));

  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);

  const { start, end } = useMemo(
    () => computeRange(periodType, refDate, month, year),
    [periodType, refDate, month, year],
  );

  // Penomoran request: mencegah response lama (ganti periode cepat)
  // menimpa data yang lebih baru.
  const requestSeq = useRef(0);

  const loadSummary = async () => {
    const current = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await api.get("/reports/summary", { params: { start, end } });
      if (current !== requestSeq.current) return; // response sudah basi
      setRecap(res.data.data.recap);
    } catch (err) {
      if (current === requestSeq.current) {
        alert(getErrorMessage(err, "Gagal memuat rekap laporan."));
      }
    } finally {
      if (current === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    // Microtask: setLoading di dalam loadSummary tidak boleh jalan sinkron
    // di badan effect (rule react-hooks/set-state-in-effect).
    Promise.resolve().then(loadSummary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      // `type` (periodType) dikirim supaya backend tahu kapan harus
      // menggabungkan 12 bulan sekaligus (laporan tahunan) ketimbang hanya
      // mengikuti rentang start-end apa adanya.
      const res = await api.get("/reports/attendance/export", {
        params: { start, end, format, type: periodType },
        responseType: "blob",
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filenameSuffix =
        periodType === "tahunan" ? start.slice(0, 4) : `${start}_${end}`;
      link.download = `laporan-absensi-${filenameSuffix}.${format === "xlsx" ? "xlsx" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(getErrorMessage(err, "Gagal mengekspor laporan."));
    } finally {
      setExporting(null);
    }
  };

  const totalKehadiran = recap ? recap.tepatWaktu + recap.terlambat : 0;

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-h-screen">
      <Topbar title="Laporan Absensi" />
      <div className="p-4 md:p-6 flex flex-col gap-4 md:gap-6">
        {/* === Filter Periode === */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-extrabold text-sm md:text-base">
            <i className="fa-solid fa-filter text-green-700"></i>
            Filter Periode
          </div>

          <div className="flex flex-col gap-3">
            {/* Segmented control jenis periode - scrollable di layar sempit */}
            <div className="-mx-1 px-1 overflow-x-auto">
              <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1 min-w-max">
                {PERIOD_TYPES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodType(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      periodType === p.id
                        ? "bg-white text-green-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <i className={`fa-solid ${p.icon}`}></i>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Input sesuai jenis periode */}
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 w-full sm:w-auto">
                <i className="fa-solid fa-calendar-days text-gray-400 shrink-0"></i>
                {(periodType === "harian" || periodType === "mingguan") && (
                  <IndonesianDatePicker
                    value={refDate}
                    onChange={setRefDate}
                  />
                )}
                {periodType === "bulanan" && (
                  <IndonesianMonthPicker value={month} onChange={setMonth} />
                )}
                {periodType === "tahunan" && (
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="outline-none text-sm font-semibold text-gray-700 bg-transparent w-full sm:w-auto min-w-0"
                  >
                    {Array.from(
                      { length: 6 },
                      (_, i) => now.getFullYear() - i,
                    ).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Ringkasan rentang tanggal aktif */}
              <div className="flex items-start sm:items-center gap-1.5 text-xs font-bold text-gray-500 sm:ml-auto">
                <i className="fa-solid fa-circle-info text-gray-400 mt-0.5 sm:mt-0 shrink-0"></i>
                <span className="break-words">
                  <span className="hidden sm:inline">Menampilkan data </span>
                  <span className="text-gray-700">
                    {start === end
                      ? formatLong(start)
                      : `${formatShort(start)} — ${formatShort(end)}`}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* === Ringkasan === */}
        {loading || !recap ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-sm font-semibold text-gray-500">
            <i className="fa-solid fa-spinner fa-spin mr-2"></i>
            Memuat data laporan...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
              <StatCard
                icon="fa-user-check"
                iconBg="bg-green-100"
                iconColor="text-green-700"
                label="Total Kehadiran"
                value={totalKehadiran}
                breakdown={[
                  {
                    label: "Tepat waktu",
                    value: recap.tepatWaktu,
                    dot: "bg-green-500",
                  },
                  {
                    label: "Terlambat",
                    value: recap.terlambat,
                    dot: "bg-orange-400",
                  },
                ]}
              />
              <StatCard
                icon="fa-file-lines"
                iconBg="bg-yellow-100"
                iconColor="text-yellow-600"
                label="Total Izin/Cuti"
                value={recap.izinCuti}
              />
              <StatCard
                icon="fa-user-xmark"
                iconBg="bg-red-100"
                iconColor="text-red-600"
                label="Total Alpa"
                value={recap.alpa}
              />
              <StatCard
                icon="fa-business-time"
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
                label="Total Lembur"
                value={recap.lembur ?? 0}
                caption={
                  recap.totalOvertimeMinutes
                    ? `${recap.totalOvertimeMinutes} menit`
                    : undefined
                }
              />
            </div>

            {/* === Export === */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="font-extrabold text-gray-800 text-sm md:text-base">
                  Ekspor Laporan
                </div>
                <p className="text-xs font-semibold text-gray-400 mt-0.5">
                  Unduh rekap absensi untuk periode yang dipilih di atas.
                  {periodType === "tahunan" &&
                    " Laporan tahunan berisi gabungan 12 bulan (Januari - Desember)."}
                </p>
              </div>
              <div className="flex flex-col xs:flex-row gap-3">
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={exporting !== null}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all bg-red-500 disabled:opacity-60"
                >
                  <i
                    className={`fa-solid ${exporting === "pdf" ? "fa-spinner fa-spin" : "fa-file-pdf"}`}
                  ></i>
                  {exporting === "pdf" ? "Mengekspor..." : "Export PDF"}
                </button>
                <button
                  onClick={() => handleExport("xlsx")}
                  disabled={exporting !== null}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60"
                  style={{ backgroundColor: "#1a7a1a" }}
                >
                  <i
                    className={`fa-solid ${exporting === "xlsx" ? "fa-spinner fa-spin" : "fa-table"}`}
                  ></i>
                  {exporting === "xlsx" ? "Mengekspor..." : "Spreadsheet"}
                </button>
              </div>
            </div>

            {recap.totalRecords === 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <i className="fa-solid fa-inbox text-3xl text-gray-300 mb-2"></i>
                <p className="text-sm font-semibold text-gray-500">
                  Tidak ada data absensi pada periode ini.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  caption,
  breakdown,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5 flex flex-col gap-3 md:gap-4">
      <div className="flex items-center gap-2.5 md:gap-3">
        <div
          className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}
        >
          <i className={`fa-solid text-sm md:text-lg ${icon}`}></i>
        </div>
        <div className="text-xs md:text-sm font-extrabold text-gray-700 leading-tight">
          {label}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <span className="text-2xl md:text-4xl font-extrabold text-gray-800">
          {value}
        </span>
        {caption && (
          <span className="text-[10px] md:text-xs font-bold text-gray-400 mb-1">
            {caption}
          </span>
        )}
      </div>

      {breakdown && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
          {breakdown.map((b) => (
            <div
              key={b.label}
              className="flex items-center justify-between text-[11px] md:text-xs font-bold text-gray-600"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${b.dot}`}
                ></span>
                {b.label}
              </span>
              <span>{b.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
