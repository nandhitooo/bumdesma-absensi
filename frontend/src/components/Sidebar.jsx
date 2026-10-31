import PodoRukunLogo from "../assets/podo-rukun.webp";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

const navItems = [
  {
    label: "Dashboard",
    icon: "fa-gauge-high",
    page: "dashboard",
    roles: ["admin", "pimpinan"],
  },
  {
    label: "Pegawai",
    icon: "fa-users",
    page: "pegawai",
    roles: ["admin", "pimpinan"],
  }, // was admin-only
  {
    label: "Absensi",
    icon: "fa-clipboard-check",
    page: "absensi",
    roles: ["admin", "pimpinan"],
  },
  {
    label: "Piket",
    icon: "fa-broom",
    page: "piket",
    roles: ["admin", "pimpinan"],
  },
  {
    label: "Izin/Cuti",
    icon: "fa-calendar-xmark",
    page: "cuti",
    roles: ["admin", "pimpinan"],
  },
  {
    label: "Laporan",
    icon: "fa-chart-bar",
    page: "laporan",
    roles: ["admin", "pimpinan"],
  },
  {
    label: "Pengaturan",
    icon: "fa-gear",
    page: "pengaturan",
    roles: ["admin", "pimpinan"],
  },
];

export default function Sidebar({ activePage, setPage, open, setOpen }) {
  const { user, logout } = useAuth();
  const { confirm } = useModal();
  const visibleItems = navItems.filter((item) =>
    item.roles.includes(user?.role),
  );

  const handleLogout = async () => {
    const confirmed = await confirm("Apakah Anda yakin ingin keluar?", {
      title: "Log Out",
      confirmLabel: "Keluar",
      cancelLabel: "Batal",
      danger: true,
    });
    if (confirmed) {
      logout();
      setOpen?.(false);
    }
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-30 w-64 min-h-screen transform bg-[#1a7a1a] transition-transform duration-200 md:relative md:translate-x-0 md:w-44 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex flex-col items-center py-5 px-3">
        <div className="w-16 h-16 flex items-center justify-center overflow-hidden mb-1 ">
          <img
            src={PodoRukunLogo}
            alt="BUMDESMA Logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentNode.innerHTML =
                '<i class="fa-solid fa-leaf text-green-700 text-2xl"></i>';
            }}
          />
        </div>
      </div>

      <nav className="flex flex-col mt-2 px-2 gap-1">
        {visibleItems.map((item) => (
          <button
            key={item.page}
            onClick={() => {
              setPage(item.page);
              setOpen?.(false);
            }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm font-bold transition-all duration-150 ${
              activePage === item.page
                ? "bg-white text-green-700"
                : "text-white hover:bg-green-700"
            }`}
          >
            <i className={`fa-solid ${item.icon} w-4`}></i>
            {item.label}
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm font-bold text-white hover:bg-green-700 transition-all mt-2"
        >
          <i className="fa-solid fa-right-from-bracket w-4"></i>
          Log Out
        </button>
      </nav>
    </div>
  );
}
