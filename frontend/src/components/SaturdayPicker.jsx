import { useEffect, useRef, useState } from "react";

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

// SESUDAH (ambil komponen tanggal lokal langsung, tidak lewat UTC):
function toISO(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSaturdaysInMonth(year, monthIndex) {
  // monthIndex: 0-11
  const dates = [];
  const d = new Date(year, monthIndex, 1);
  while (d.getMonth() === monthIndex) {
    if (d.getDay() === 6) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default function SaturdayPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selected = new Date(`${value}T00:00:00`);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saturdays = getSaturdaysInMonth(viewYear, viewMonth);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handlePick = (date) => {
    onChange(toISO(date));
    setOpen(false);
  };

  const formatted = selected.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          setViewYear(selected.getFullYear());
          setViewMonth(selected.getMonth());
          setOpen((o) => !o);
        }}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm w-fit hover:border-green-300 transition-all"
      >
        <i className="fa-solid fa-calendar-days text-gray-500"></i>
        <span className="text-sm font-semibold text-gray-700">{formatted}</span>
        <i
          className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        ></i>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goPrevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <span className="text-sm font-extrabold text-gray-800">
              {BULAN[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          <p className="text-[11px] font-semibold text-gray-400 mb-2">
            Jadwal piket hanya berlaku setiap hari Sabtu:
          </p>

          {saturdays.length === 0 ? (
            <p className="text-xs font-semibold text-gray-400 text-center py-3">
              Tidak ada hari Sabtu di bulan ini.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {saturdays.map((d) => {
                const iso = toISO(d);
                const isSelected = iso === value;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => handlePick(d)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                      isSelected
                        ? "text-white"
                        : "bg-gray-50 text-gray-700 hover:bg-green-50"
                    }`}
                    style={isSelected ? { backgroundColor: "#1a7a1a" } : {}}
                  >
                    Sabtu, {d.getDate()}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const upcoming = getSaturdaysInMonth(
                now.getFullYear(),
                now.getMonth(),
              ).find((d) => d >= now);
              const target =
                upcoming ||
                getSaturdaysInMonth(now.getFullYear(), now.getMonth() + 1)[0];
              if (target) {
                setViewYear(target.getFullYear());
                setViewMonth(target.getMonth());
                handlePick(target);
              }
            }}
            className="w-full mt-3 pt-3 border-t border-gray-100 text-xs font-bold text-green-700 hover:text-green-800"
          >
            Sabtu terdekat
          </button>
        </div>
      )}
    </div>
  );
}
