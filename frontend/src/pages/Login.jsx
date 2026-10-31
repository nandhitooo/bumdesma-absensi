import { useState } from "react";
import PodoRukunLogo from "../assets/podo-rukun.webp";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(username, password);

    setLoading(false);
    if (!result.success) {
      setError(result.message);
    }
    // Jika berhasil, App.jsx otomatis menampilkan dashboard karena `user` di
    // AuthContext sudah terisi. Jika mustChangePassword true, arahkan pengguna
    // ke halaman Pengaturan > Ganti Password setelah masuk.
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center">
      <div className="bg-gray-100 rounded-3xl shadow-xl p-10 w-full max-w-sm">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200">
              <img
                src={PodoRukunLogo}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.parentNode.innerHTML =
                    '<i class="fa-solid fa-leaf text-green-700 text-2xl"></i>';
                }}
              />
            </div>
            <span className="text-3xl font-extrabold text-green-700">
              BUMDESMA
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-800 mt-4">
            Login
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-200 text-gray-600 placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-400 font-medium"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-200 text-gray-600 placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-400 font-medium"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-extrabold text-white text-lg tracking-widest transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: "#1a7a1a" }}
          >
            {loading ? "MEMPROSES..." : "LOGIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
