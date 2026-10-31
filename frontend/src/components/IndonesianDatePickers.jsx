import { useEffect, useRef, useState } from "react";

// Nama bulan dan hari dalam bahasa Indonesia (dipakai untuk label kalender).
const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const BULAN_SINGKAT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const HARI_PANJANG = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

// ISO string (yyyy-mm-dd) -> Date lokal (tengah malam lokal, bukan UTC).
function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Date lokal -> ISO string (yyyy-mm-dd), ambil komponen lokal langsung.
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Label panjang bahasa Indonesia, mis. "Senin, 12 Agustus 2026".
function labelPanjang(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hari = HARI_PANJANG[d.getDay()] || HARI_PANJANG[0];
  return `${hari}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// Dropdown kalender bulanan penuh (7 kolom), semua label bahasa Indonesia.
// Props:
// - value: ISO string (yyyy-mm-dd) terpilih
// - onChange(iso): dipanggil saat user memilih tanggal
// - minISO / maxISO: opsional, batas tanggal yang bisa dipilih
// - placeholder: teks saat belum ada nilai
// - disabled
export function IndonesianDatePicker({
  value,
  onChange,
  minISO,
  maxISO,
  placeholder = "Pilih tanggal",
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const baseDate = value ? parseISO(value) : new Date();
  const [viewYear, setViewYear] = useState(baseDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(baseDate.getMonth());

  // Sinkron view kalau value berubah dari luar (mis. reset form).
  useEffect(() => {
    if (!value) return;
    const d = parseISO(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Grid 6 baris x 7 kolom, mulai Minggu (minggu Indonesia dimulai Minggu).
  const firstDay = new Date(viewYear, viewMonth, 1);
  const gridStart = new Date(viewYear, viewMonth, 1 - firstDay.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const todayISO = toISO(new Date());
  const isDisabled = (d) => {
    const iso = toISO(d);
    if (minISO && iso < minISO) return true;
    if (maxISO && iso > maxISO) return true;
    return false;
  };

  const label = value
    ? labelPanjang(value)
    : placeholder;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-left shadow-sm hover:border-green-300 transition-all disabled:opacity-60"
      >
        <span
          className={`text-sm font-semibold truncate ${
            value ? "text-gray-700" : "text-gray-400"
          }`}
        >
          {label}
        </span>
        <i
          className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        ></i>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-72">
          {/* Header: navigasi bulan + tahun */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <div className="flex items-center gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-sm font-extrabold text-gray-800 bg-transparent outline-none cursor-pointer"
              >
                {BULAN.map((b, i) => (
                  <option key={b} value={i}>
                    {b}
                  </option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-sm font-extrabold text-gray-800 bg-transparent outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + 5 - i).map(
                  (y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ),
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          {/* Nama hari, mulai Minggu */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {HARI.map((h) => (
              <div
                key={h}
                className="text-[10px] font-bold text-gray-400 text-center uppercase"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Grid tanggal */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const iso = toISO(d);
              const outOfMonth = d.getMonth() !== viewMonth;
              const isSelected = value === iso;
              const isToday = iso === todayISO;
              const dis = isDisabled(d);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dis || outOfMonth}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? "text-white"
                      : dis || outOfMonth
                        ? "text-gray-300"
                        : "text-gray-700 hover:bg-green-50"
                  } ${isToday && !isSelected ? "ring-1 ring-green-300" : ""}`}
                  style={isSelected ? { backgroundColor: "#1a7a1a" } : {}}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Dropdown pilih bulan (yyyy-mm) pengganti <input type="month">, label
// bahasa Indonesia. Props: value ("yyyy-mm"), onChange("yyyy-mm"), disabled.
export function IndonesianMonthPicker({
  value,
  onChange,
  placeholder = "Pilih bulan",
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const [year, setYear] = useState(
    value ? Number(value.split("-")[0]) : new Date().getFullYear(),
  );
  const [month, setMonth] = useState(
    value ? Number(value.split("-")[1]) - 1 : new Date().getMonth(),
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const label = value
    ? `${BULAN[Number(value.split("-")[1]) - 1]} ${value.split("-")[0]}`
    : placeholder;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-left shadow-sm hover:border-green-300 transition-all disabled:opacity-60"
      >
        <span
          className={`text-sm font-semibold truncate ${
            value ? "text-gray-700" : "text-gray-400"
          }`}
        >
          {label}
        </span>
        <i
          className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        ></i>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-72">
          {/* Pilih tahun dulu */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <span className="text-sm font-extrabold text-gray-800">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          {/* Grid bulan 4 kolom x 3 baris */}
          <div className="grid grid-cols-4 gap-2">
            {BULAN.map((b, i) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setMonth(i);
                  onChange(`${year}-${String(i + 1).padStart(2, "0")}`);
                  setOpen(false);
                }}
                className={`px-2 py-2 rounded-xl text-xs font-bold transition-all ${
                  month === i && value?.startsWith(String(year))
                    ? "text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-green-50"
                }`}
                style={
                  month === i && value?.startsWith(String(year))
                    ? { backgroundColor: "#1a7a1a" }
                    : {}
                }
              >
                {BULAN_SINGKAT[i]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
