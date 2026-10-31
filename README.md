# 🏢 BUMDESMA — Monorepo Sistem Absensi

Satu repositori untuk seluruh aplikasi web Sistem Manajemen Absensi Pegawai
BUMDESMA Podo Rukun LKD:

- **`frontend`** — Website Admin & Pimpinan (React + Vite + Tailwind CSS)
- **`backend`** — REST API (Node.js + Express + Sequelize + PostgreSQL)
- **`mobile`** — Aplikasi pegawai (Flutter)

Keduanya memakai **npm workspaces**, jadi seluruh dependency disimpan di **satu
`node_modules` di root** dan cukup satu `npm install`. Frontend & backend bisa
dijalankan bersamaan di **satu terminal** lewat `npm run dev:all`.

Ketiga proyek berada dalam **satu repository Git**. `frontend` dan `backend`
merupakan workspace npm; `mobile` memakai Flutter dan dikelola dengan
`flutter pub get` dari foldernya sendiri.

---

## 🧱 Teknologi

| Bagian | Stack |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, axios, Font Awesome, Google Fonts (Nunito) |
| Backend | Node.js, Express, Sequelize, PostgreSQL, JWT + bcrypt |
| Mobile | Flutter, Dart |
| Tools monorepo | npm workspaces untuk frontend/backend, concurrently |

---

## 📁 Struktur Folder

```
.
├── package.json                 # Root monorepo: workspaces + semua script utama
├── package-lock.json            # SATU lockfile untuk frontend + backend
├── node_modules/                # SATU folder dependency (di-hoist dari kedua workspace)
├── .gitignore                   # Aturan ignore monorepo (dependency, .env, artefak build)
├── .dockerignore                # Konteks build Docker (mobile/, node_modules/, .env)
├── docker-compose.yml           # Stack Docker: db, migrate, backend, frontend
│
├── frontend/                    # Workspace: website Admin & Pimpinan
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── .env                     # VITE_API_BASE_URL (tidak di-commit)
│   ├── .env.example
│   ├── public/                  # Aset statis (logo, gambar)
│   └── src/
│       ├── main.jsx             # Entry point React
│       ├── App.jsx
│       ├── pages/               # Halaman: login, dashboard, pegawai, absensi, piket, izin/cuti, laporan, pengaturan
│       ├── components/          # Komponen UI yang dipakai ulang
│       ├── context/             # Context React (auth, dsb)
│       ├── lib/                 # Helper & konfigurasi API (axios)
│       ├── data/                # Data statis
│       └── assets/              # Gambar/ikon
│
├── backend/                     # Workspace: REST API
│   ├── server.js                # Entry point (koneksi DB, listen, top-up giliran piket)
│   ├── .sequelizerc             # Path config/model/migration/seed Sequelize CLI
│   ├── .env                     # Konfigurasi server, DB, JWT, SMTP, FCM (tidak di-commit)
│   ├── .env.example
│   ├── docs/                    # Dokumentasi per modul (mis. docs/piket.md)
│   ├── scripts/                 # Script bantu (check-push.js)
│   ├── tests/                   # Test Node --test (backup-restore, piket-rotation)
│   ├── secrets/                 # Kredensial Firebase (tidak di-commit)
│   ├── uploads/                 # Unggahan: surat izin per kategori + QR code
│   └── src/
│       ├── app.js               # Konfigurasi Express (middleware, route)
│       ├── config/              # Koneksi DB, config Sequelize CLI, validasi env
│       ├── models/              # Model Sequelize + asosiasi
│       ├── migrations/          # Skema database
│       ├── seeders/             # Data awal (akun, jam kerja, setting)
│       ├── controllers/         # Logika bisnis per modul
│       ├── routes/              # Definisi endpoint per modul
│       ├── middlewares/         # Auth, validasi, upload, error handler
│       ├── services/            # Layanan (push notification FCM)
│       └── utils/               # JWT, geofencing, notifier, mailer, report, dsb
│
├── mobile/                      # Aplikasi mobile pegawai — Flutter (repo sama, di luar workspace npm)
│
└── .local/                      # Berkas lokal saja (di-.gitignore), mis. dokumen PA
```

---

## 🚀 Cara Menjalankan

Repo ini memuat tiga proyek: `frontend`, `backend`, dan `mobile`. Langkah
berikut menyiapkan website dan API; setup aplikasi Flutter ada di
[`mobile/README.md`](mobile/README.md).

### Prasyarat

- **Node.js >= 18** dan **npm**
- **PostgreSQL** yang berjalan (default `localhost:5432`)

### 1. Install dependency (sekali saja, di root)

```bash
npm install
```

Perintah ini meng-install dependency **frontend dan backend sekaligus** ke satu
`node_modules` di root. Tidak perlu (dan tidak dianjurkan) menjalankan
`npm install` di dalam sub-folder.

### 2. Siapkan file `.env`

```bash
cp backend/.env.example  backend/.env    # lalu isi kredensial DB, JWT, SMTP, dst.
cp frontend/.env.example frontend/.env   # default: VITE_API_BASE_URL=http://localhost:5000/api
```

### 3. Siapkan database

```bash
npm run db:migrate   # membuat tabel
npm run db:seed      # data awal (akun admin, jam kerja, pengaturan)
```

### 4. Jalankan frontend + backend sekaligus

```bash
npm run dev:all
```

Output kedua proses tampil di satu terminal dengan label:

```
[BACKEND]  🚀 Server berjalan di http://localhost:5000
[FRONTEND] ➜  Local:   http://localhost:5173/
```

Buka `http://localhost:5173` untuk website Admin/Pimpinan. Tekan `Ctrl+C`
sekali untuk menghentikan keduanya (backend dijalankan dengan `nodemon`, jadi
tetap auto-reload saat file backend diubah; frontend di-reload oleh Vite).

---

## 📜 Semua Script npm (Root)

Jalankan dari **root** monorepo.

| Script | Perintah | Fungsi |
| --- | --- | --- |
| `dev:all` | `npm run dev:all` | Jalankan **backend + frontend** bersamaan di satu terminal (label `[BACKEND]` / `[FRONTEND]`) |
| `dev:backend` | `npm run dev:backend` | Jalankan hanya backend (`nodemon server.js`, port 5000) |
| `dev:frontend` | `npm run dev:frontend` | Jalankan hanya frontend (`vite`, port 5173) |
| `start` | `npm start` | Jalankan backend mode produksi (`node server.js`, tanpa auto-reload) |
| `build` | `npm run build` | Build frontend ke `frontend/dist` |
| `lint` | `npm run lint` | ESLint untuk frontend |
| `test` | `npm test` | Test backend (`node --test`) |
| `db:migrate` | `npm run db:migrate` | Jalankan migrasi Sequelize |
| `db:seed` | `npm run db:seed` | Isi data awal (seeder) |
| `attachments:migrate` | `npm run attachments:migrate` | Rapikan lampiran izin/cuti lama ke folder kategori (dry-run; tambah `-- --apply` untuk menerapkan) |

### Script per-workspace

Script yang hanya ada di salah satu workspace dijalankan lewat flag
`--workspace` (singkat: `-w`):

```bash
# Backend
npm run db:create    -w backend   # buat database
npm run db:migrate:undo -w backend # rollback migrasi terakhir
npm run db:seed:undo -w backend   # rollback seeder
npm run db:reset     -w backend   # undo all + migrate + seed
npm run push:check   -w backend   # cek konfigurasi push notification (FCM)
npm run test:backup  -w backend   # test khusus backup/restore
npm run attachments:migrate        # rapikan lampiran izin/cuti lama (dry-run, tambah -- --apply)

# Frontend
npm run preview      -w frontend  # preview hasil build
```

---

## 🐳 Menjalankan dengan Docker

Selain `npm run dev:all`, seluruh stack bisa dijalankan lewat Docker Compose:
PostgreSQL, migrasi otomatis, backend, dan frontend (hasil build Vite yang
disajikan nginx).

```bash
docker compose up -d --build      # build image + jalankan semua service
docker compose ps                 # cek status (backend & db harus "healthy")
docker compose logs -f backend    # log API
docker compose down               # hentikan semua (volume DB tetap disimpan)
```

| Service | Image | Port host | Keterangan |
| --- | --- | --- | --- |
| `db` | `postgres:16-alpine` | `5433` → 5432 | Volume `db_data`; 5433 supaya tidak bentrok PostgreSQL lokal |
| `migrate` | `bumdesma-backend` | – | Sekali jalan: `sequelize-cli db:migrate` sebelum API start |
| `backend` | `bumdesma-backend` | `5000` → 5000 | `NODE_ENV=production`; `uploads/` & `secrets/` di-mount dari host |
| `frontend` | `bumdesma-frontend` | `8080` → 80 | nginx: `/api/`, `/uploads/`, `/health` diproxy ke `backend:5000` |

Buka `http://localhost:8080`. Browser memanggil `VITE_API_BASE_URL=/api`
(same-origin) dan nginx yang meneruskan ke backend, jadi tidak ada CORS dan
tidak ada `localhost:5000` yang di-hardcode di bundle.

Catatan:

- File `Dockerfile` ada di masing-masing workspace (`backend/Dockerfile`,
  `frontend/Dockerfile`) dengan build context root monorepo, karena dependency
  di-hoist oleh npm workspaces. `.dockerignore` di root mengecualikan
  `node_modules`, `mobile/`, `pa.xml`, dan semua berkas `.env`.
- Kredensial DB container diambil dari `DB_NAME`/`DB_USER`/`DB_PASSWORD`
  (default `postgres`/`postgres`/`bumdesma_absensi`) dan dipakai sama persis
  oleh `db` maupun backend. Override lewat `.env` di root atau shell:
  `DB_PASSWORD=rahasia docker compose up -d`.
- `backend/.env` wajib ada (dibaca sebagai `env_file`); `DB_HOST`/`DB_PORT`
  otomatis diarahkan ke service `db`.
- Migrasi jalan otomatis, **seeder tidak**. Jalankan sekali untuk membuat akun
  admin: `docker compose run --rm backend npx sequelize-cli db:seed:all`.
- Port host bisa diganti kalau bentrok, mis.
  `FRONTEND_PORT=8081 BACKEND_PORT=5001 docker compose up -d`.
- `TRUST_PROXY=1` di-set untuk backend supaya rate limiter membaca IP klien
  asli dari `X-Forwarded-For` di balik nginx.

---

## 📦 Menambah / Menghapus Dependency

Karena memakai workspaces, dependency **selalu** ditambahkan dari root dengan
menyebut workspace tujuan agar tetap masuk ke satu `node_modules`:

```bash
# library untuk backend
npm install nama-paket -w backend

# library untuk frontend
npm install nama-paket -w frontend

# devDependency
npm install -D nama-paket -w frontend

# hapus
npm uninstall nama-paket -w backend
```

Root `package.json` hanya memuat tool monorepo (`concurrently`). Jangan
menambahkan dependency aplikasi di root.

---

## 🗒️ Catatan

- **Satu lockfile**: `package-lock.json` hanya ada di root. Jangan membuat
  lockfile baru di dalam workspace — itu akan memecah versi dependency.
- **`.env` tetap per-project**: script npm dijalankan dengan working directory
  masing-masing workspace, jadi backend membaca `backend/.env` dan
  frontend membaca `frontend/.env` secara otomatis.
- **Port default**: backend `5000` (`PORT` di `.env` backend), frontend `5173`
  (Vite). Kalau port berubah, sesuaikan juga `VITE_API_BASE_URL` di `.env`
  frontend.
- **Upload file** backend disimpan di `backend/uploads/`.
- Dokumentasi detail tiap bagian ada di `backend/README.md` dan
  `frontend/README.md`. Panduan aplikasi Flutter ada di `mobile/README.md`.
- Logo BUMDESMA punya satu berkas sumber: `mobile/assets/images/podo-rukun.png`
  (dipakai app Flutter + generator launcher icon). Web memakai turunan
  teroptimasi `frontend/src/assets/podo-rukun.webp` — dipakai Sidebar/Login dan
  juga sebagai favicon, jadi tidak ada salinan PNG lain di repo.

---

## 🩺 Troubleshooting Singkat

| Masalah | Penyebab & solusi |
| --- | --- |
| `npm run dev:all` gagal di bagian backend | PostgreSQL belum jalan atau kredensial di `backend/.env` salah — cek pesan `❌ Gagal terkoneksi ke database` |
| Frontend error `Network Error` / CORS | Pastikan backend hidup di port yang sama dengan `VITE_API_BASE_URL` |
| `Cannot find module ...` setelah pull | Jalankan `npm install` di root |
| Port 5000/5173 sudah dipakai | Hentikan proses lama (`Ctrl+C`), atau ubah `PORT` / port Vite |
