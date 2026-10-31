import axios from "axios";

// Base URL backend, diatur lewat file .env -> VITE_API_BASE_URL
// Contoh: VITE_API_BASE_URL=http://localhost:5000/api
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const api = axios.create({
  baseURL: BASE_URL,
});

// Endpoint yang TIDAK boleh diproses interceptor refresh-token:
// - login (gagal login = 401 asli karena password salah, bukan sesi kedaluwarsa)
// - refresh itu sendiri (mencegah loop refresh tak berujung)
const AUTH_BYPASS_PATHS = [
  "/auth/admin-login",
  "/auth/login",
  "/auth/refresh-token",
];

// Menyisipkan access token JWT ke setiap request (jika ada)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: kalau banyak request 401 hampir bersamaan
// (mis. Dashboard menembak 4 endpoint sekaligus saat access token baru
// saja kedaluwarsa), hanya SATU panggilan /auth/refresh-token yang
// dikirim; request lain menunggu hasilnya lewat promise yang sama.
let refreshPromise = null;

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  // Beri tahu AuthContext (via event) supaya state `user` di React ikut
  // di-reset. Reload saja tidak cukup karena app ini SPA tanpa router:
  // pathname selalu "/" dan state login hidup di React, bukan di URL.
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
}

// Meminta access token baru ke backend. Endpoint ini sama seperti yang
// dipakai app mobile (lihat lib/core/network/api_client.dart):
// POST /auth/refresh-token { refreshToken } -> { data: { accessToken } }.
// Backend tidak merotasi refresh token, jadi cukup simpan access token baru.
// Memakai axios terpisah (bukan instance `api`) supaya request ini tidak
// tertangkap interceptor response di bawah.
async function requestNewAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${BASE_URL}/auth/refresh-token`, {
      refreshToken,
    });
    const newToken = res.data?.data?.accessToken;
    if (!newToken) return null;
    localStorage.setItem("accessToken", newToken);
    return newToken;
  } catch {
    return null;
  }
}

// Jika token kedaluwarsa / tidak valid (401), coba refresh token secara
// diam-diam lalu ulangi request asli SEKALI. Hanya jika refresh juga gagal
// sesi benar-benar diakhiri: token dibuang & kembali ke halaman login.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    const isAuthBypass = AUTH_BYPASS_PATHS.some((path) =>
      config?.url?.includes(path),
    );

    if (
      response?.status === 401 &&
      config &&
      !config._retry && // tandai agar request asli hanya diulang satu kali
      !isAuthBypass
    ) {
      config._retry = true;

      if (!refreshPromise) {
        refreshPromise = requestNewAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;

      if (newToken) {
        // Ulangi request asli dengan access token yang baru.
        config.headers.Authorization = `Bearer ${newToken}`;
        return api.request(config);
      }

      // Refresh gagal / tidak ada refresh token -> sesi kedaluwarsa total.
      clearSession();
    }

    return Promise.reject(error);
  }
);

// Helper untuk mengambil pesan error yang konsisten dari response backend
export function getErrorMessage(err, fallback = "Terjadi kesalahan. Silakan coba lagi.") {
  return err?.response?.data?.message || fallback;
}

// Base URL tanpa /api, dipakai untuk mengakses file statis (gambar QR, lampiran)
export const FILE_BASE_URL = BASE_URL.replace(/\/api\/?$/, "");

export default api;
