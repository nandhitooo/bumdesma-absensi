import { createContext, useContext, useEffect, useState } from "react";
import api, { getErrorMessage } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (username, password) => {
    try {
      const res = await api.post("/auth/admin-login", { username, password });
      const { user: loggedInUser, accessToken, refreshToken } = res.data.data;

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);

      return { success: true, mustChangePassword: res.data.data.mustChangePassword };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, "Username atau password salah.") };
    }
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  };

  // Event "auth:session-expired" dikirim dari interceptor di src/lib/api.js
  // saat refresh token gagal (sesi benar-benar kedaluwarsa). Dengarkan di
  // sini supaya state `user` di React ikut di-reset dan UI kembali ke
  // halaman login tanpa perlu reload halaman.
  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
