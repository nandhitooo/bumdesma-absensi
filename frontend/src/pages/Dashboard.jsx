import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import api, { getErrorMessage } from "../lib/api";
import { useModal } from "../context/ModalContext";

export default function Dashboard() {
  const { alert } = useModal();
  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [summaryRes, attendanceRes] = await Promise.all([
          api.get("/attendance/dashboard-summary"),
          api.get("/attendance", {
            params: {
              tanggal: new Date().toISOString().slice(0, 10),
              limit: 10,
            },
          }),
        ]);
        setSummary(summaryRes.data.data);
        setActivities(attendanceRes.data.data);
      } catch (err) {
        await alert(getErrorMessage(err, "Gagal memuat data dashboard."), {
          title: "Gagal Memuat Data",
          danger: true,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-h-screen">
      <Topbar title="Dashboard" />
      <div className="p-6 flex flex-col gap-6">
        {loading || !summary ? (
          <div className="p-6 text-center text-sm font-semibold text-gray-500">
            Memuat data...
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Pegawai"
                value={summary.totalPegawai}
                color="bg-blue-500"
              />
              <StatCard
                label="Hadir Hari Ini"
                value={summary.hadir}
                color="bg-green-600"
              />
              <StatCard
                label="Terlambat"
                value={summary.terlambat}
                color="bg-orange-400"
              />
              <StatCard
                label="Belum Absen"
                value={summary.belumAbsen}
                color="bg-red-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ringkasan tambahan */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="text-lg font-extrabold text-gray-800 mb-4">
                  Ringkasan Hari Ini
                </h2>
                <div className="flex flex-col gap-3">
                  <SummaryRow
                    label="Izin/Cuti"
                    value={summary.izinCuti}
                    icon="fa-file-lines"
                  />
                  <SummaryRow
                    label="Lembur"
                    value={summary.lembur}
                    icon="fa-clock"
                  />
                </div>
              </div>

              {/* Current Activities */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="text-lg font-extrabold text-gray-800 mb-4">
                  Aktivitas Absensi Hari Ini
                </h2>
                <div className="flex flex-col gap-3 max-h-72 overflow-auto">
                  {activities.length === 0 && (
                    <div className="text-sm text-gray-500 font-semibold">
                      Belum ada aktivitas absensi.
                    </div>
                  )}
                  {activities.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-2 rounded-xl bg-gray-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                        <i className="fa-solid fa-user"></i>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-800">
                          {a.user?.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          Masuk{" "}
                          {a.jam_masuk
                            ? new Date(a.jam_masuk).toTimeString().slice(0, 5)
                            : "-"}
                          {a.jam_pulang
                            ? ` • Pulang ${new Date(a.jam_pulang).toTimeString().slice(0, 5)}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`${color} rounded-2xl p-5 text-white shadow-sm`}>
      <div className="text-sm font-bold opacity-90">{label}</div>
      <div className="text-5xl font-extrabold mt-2">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value, icon }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
        <i className={`fa-solid ${icon} text-gray-500`}></i>
        {label}
      </div>
      <span className="text-xl font-extrabold text-gray-800">{value}</span>
    </div>
  );
}
