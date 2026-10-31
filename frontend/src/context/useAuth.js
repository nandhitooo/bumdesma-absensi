import { createContext, useContext } from "react";

// Context dan hook dipisah dari file provider supaya AuthContext.jsx hanya
// mengekspor komponen (aturan react-refresh/only-export-components) dan Fast
// Refresh tetap bekerja saat development.
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
