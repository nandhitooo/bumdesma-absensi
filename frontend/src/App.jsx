import { lazy, Suspense, useState } from "react";
import Login from "./pages/Login";
import Sidebar from "./components/Sidebar";
import { useAuth } from "./context/AuthContext";

// Code-splitting: tiap halaman jadi chunk terpisah, dimuat saat dipakai.
// Login tetap eager supaya layar pertama tidak menunggu chunk lain.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pegawai = lazy(() => import("./pages/Pegawai"));
const Absensi = lazy(() => import("./pages/Absensi"));
const Piket = lazy(() => import("./pages/Piket"));
const Cuti = lazy(() => import("./pages/Cuti"));
const Laporan = lazy(() => import("./pages/Laporan"));
const Pengaturan = lazy(() => import("./pages/Pengaturan"));

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100 min-h-screen">
      <span className="text-sm font-semibold text-gray-500">
        Memuat halaman...
      </span>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Belum login (atau token kedaluwarsa) -> tampilkan halaman Login
  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "pegawai":
        return <Pegawai />;
      case "absensi":
        return <Absensi />;
      case "piket":
        return <Piket />;
      case "cuti":
        return <Cuti />;
      case "laporan":
        return <Laporan />;
      case "pengaturan":
        return <Pengaturan />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={`fixed inset-0 z-20 bg-black/40 transition-opacity duration-200 md:hidden ${
          sidebarOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <Sidebar
        activePage={page}
        setPage={setPage}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl bg-gray-100 text-gray-700 shadow-sm"
            >
              <i className="fa-solid fa-bars"></i>
            </button>
            <span className="text-lg font-bold text-green-700">BUMDESMA</span>
          </div>
        </div>
        <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
      </div>
    </div>
  );
}
