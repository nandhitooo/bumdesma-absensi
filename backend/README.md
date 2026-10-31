# Backend – Sistem Manajemen Absensi Pegawai Berbasis QR Code
### BUMDESMA Podo Rukun LKD

REST API untuk sistem absensi pegawai berbasis QR Code statis dengan validasi
geofencing. Melayani dua klien: **Website Admin/Pimpinan** (React) dan
**Aplikasi Mobile Pegawai** (Flutter), masing-masing lewat HTTP/JSON.

> **Bagian dari monorepo.** Folder ini adalah salah satu workspace npm di
> monorepo yang sama dengan `frontend`. Dependency di-install **sekali
> di root** (satu `node_modules`, satu `package-lock.json`), dan server
> dijalankan lewat script root `npm run dev:backend` / `npm run dev:all`.
> Panduan lengkap: lihat `README.md` di root monorepo.

## Stack Teknologi

| Layer | Teknologi |
|---|---|
| Runtime | Node.js + Express.js |
| Database | PostgreSQL (Sequelize ORM) |
| Autentikasi | JSON Web Token (JWT) + bcrypt |
| Validasi lokasi | Haversine formula (geofencing) |
| QR Code | Library `qrcode` (generate PNG statis) |
| Export laporan | `pdfkit` (PDF) & `exceljs` (Spreadsheet) |
| Upload file | `multer` (lampiran surat izin/cuti) |

## Dua Jenis Akun, Dua Tabel Terpisah

Sistem ini **tidak** memakai satu tabel `users` dengan kolom `role` untuk
ketiga aktor. Sebagai gantinya:

- **`users`** — Pegawai saja. Login pakai **NIP + password** dari app
  mobile. Password awal adalah password sementara yang diinput Admin;
  pegawai **wajib ganti password** saat pertama kali login, dan bisa
  sekalian mengisi email (opsional) untuk verifikasi jika suatu saat lupa
  password.
- **`admin_accounts`** — Admin & Pimpinan. Login pakai **username +
  password** dari Website. Dibedakan lewat kolom `role` (`admin` /
  `pimpinan`).

Konsekuensinya, kolom-kolom yang mencatat *siapa melakukan suatu aksi admin*
(`piket_schedules.assigned_by`, `leaves.reviewed_by`/`decided_by`,
`notifications.sent_by`, `attendances.corrected_by`) menunjuk ke
`admin_accounts.id`, bukan `users.id`.

## Arsitektur

Mengikuti *API-Driven Architecture* dengan pola *Client-Server* terpisah:
Aplikasi Mobile Pegawai (Flutter) dan Website Admin/Pimpinan (React) sama-sama
mengonsumsi REST API ini melalui HTTP/JSON.

## Struktur Folder

```
backend/
├── server.js                  # Entry point
├── src/
│   ├── app.js                 # Konfigurasi Express
│   ├── config/                 # Koneksi DB & config Sequelize CLI
│   ├── models/                 # Model Sequelize + asosiasi (ERD)
│   ├── migrations/              # Skema database (urut sesuai FK)
│   ├── seeders/                 # Data awal (akun, jadwal kerja, setting)
│   ├── controllers/             # Logika bisnis per modul
│   ├── routes/                  # Definisi endpoint per modul
│   ├── middlewares/             # Auth, error handler, upload, validasi
│   └── utils/                   # JWT, geofencing, notifier, response, dsb
├── docs/                       # Dokumentasi per modul (lihat docs/piket.md)
└── uploads/
    ├── qrcode/                   # Gambar QR Code hasil generate
    └── surat-izin/               # Lampiran izin/cuti, dipisah per kategori
        ├── sakit/
        ├── izin/
        ├── cuti/
        └── _tmp/                 # staging multer, dipindah ke kategori setelah validasi
```

Merapikan lampiran lama ke folder kategori (idempotent; dry-run dulu, lalu terapkan):

```bash
# dari root monorepo (script root mem-proxy ke workspace backend)
npm run attachments:migrate            # dry-run: tampilkan rencana pemindahan
npm run attachments:migrate -- --apply # benar-benar pindahkan + update database

# atau langsung di workspace backend
npm run attachments:migrate -w backend
cd backend && npm run attachments:migrate -- --apply
```

Semua script npm backend dan cara memanggilnya dari root monorepo:

| Script | Dari root monorepo | Fungsi |
| --- | --- | --- |
| `dev` | `npm run dev:backend` | Nodemon + `server.js` (auto-reload) |
| `start` | `npm start` | Produksi (`node server.js`, tanpa reload) |
| `db:create` | `npm run db:create -w backend` | Buat database |
| `db:migrate` | `npm run db:migrate` | Jalankan migrasi |
| `db:migrate:undo` | `npm run db:migrate:undo -w backend` | Rollback migrasi terakhir |
| `db:seed` | `npm run db:seed` | Isi data awal |
| `db:seed:undo` | `npm run db:seed:undo -w backend` | Rollback seeder |
| `db:reset` | `npm run db:reset -w backend` | Undo all + migrate + seed |
| `push:check` | `npm run push:check -w backend` | Cek konfigurasi push notification (FCM) |
| `attachments:migrate` | `npm run attachments:migrate` | Rapikan lampiran ke folder kategori (tambah `-- --apply` untuk menerapkan) |
| `test` | `npm test` | Test backend (`node --test`) |
| `test:backup` | `npm run test:backup -w backend` | Test khusus backup/restore |

## Skema Database

- **users** — data Pegawai (NIP, nama, password, jabatan, phone, email,
  status, `is_first_login`)
- **admin_accounts** — data Admin & Pimpinan (username, nama, password,
  role, status)
- **work_schedules** — jadwal kerja reguler (Senin–Jumat) & piket (Sabtu)
- **qr_codes** — token QR Code statis (hanya satu token aktif pada satu waktu)
- **attendances** — riwayat presensi harian (1 baris per pegawai per tanggal)
- **leaves** — pengajuan izin/cuti (alur: pending → diteruskan Admin → approved/rejected Pimpinan)
- **piket_schedules** — penugasan piket Sabtu per pegawai; `notification_sent`
  menjadi `true` otomatis setelah notifikasi terkirim (saat assign atau saat
  tukar jadwal disetujui)
- **piket_swaps** — permintaan tukar jadwal piket (ganti orang di tanggal yang
  sama), alur admin-mediated: `menunggu_pengganti` → `menunggu_admin` →
  `approved`/`rejected`
- **notifications** — notifikasi in-app untuk pegawai (jadwal piket,
  keputusan izin/cuti), ditampilkan di lonceng Dashboard app mobile
- **system_settings** — parameter sistem (koordinat kantor, radius geofencing, hari libur)
- **activity_logs** — audit trail seluruh aktivitas penting, mencatat aktor
  pegawai (`user_id`) maupun admin/pimpinan (`admin_id` + `actor_type`)

## Instalasi & Menjalankan

### 1. Prasyarat
- Node.js ≥ 18
- PostgreSQL ≥ 13

### 2. Setup (dari root monorepo)

Backend adalah salah satu workspace, jadi dependency **di-install sekali di
root monorepo**, bukan di dalam folder ini:

```bash
cd ..                                          # root monorepo
npm install                                    # dependency backend + frontend -> satu node_modules di root
cp backend/.env.example backend/.env
# sesuaikan DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET, dll di backend/.env
```

### 3. Buat database & jalankan migrasi + seeder

Semua perintah dijalankan dari **root monorepo** dan diarahkan ke workspace
backend dengan flag `-w`:

```bash
npm run db:create  -w backend
npm run db:migrate -w backend
npm run db:seed    -w backend
```

Tersedia juga `db:migrate:undo`, `db:seed:undo`, dan `db:reset`
(undo all + migrate + seed) dengan pola yang sama.

> Migration bersifat idempotent untuk tabel yang mungkin sudah ada secara
> manual di database kamu (`admin_accounts`, kolom `email`) — aman
> dijalankan ulang tanpa menimpa data yang sudah ada.

### 4. Jalankan server (dari root monorepo)
```bash
npm run dev:backend   # hanya backend, nodemon (development)
npm run dev:all       # backend + frontend sekaligus di satu terminal
npm start             # production (node server.js, tanpa auto-reload)
```

Alternatif lain yang setara: `npm run dev -w backend`.

Server berjalan di `http://localhost:5000`, base URL API: `http://localhost:5000/api`.

Kalau backend diakses dari HP fisik (app mobile lewat USB) atau dari
perangkat lain di jaringan yang sama, pastikan `app.listen` mendengarkan di
`0.0.0.0`, bukan cuma `127.0.0.1`.

### Akun default (dari seeder)

| Peran | Login pakai | Username/NIP | Password |
|---|---|---|---|
| Admin | Website (username) | `admin` | `Admin@12345` |
| Pimpinan | Website (username) | `pimpinan` | `Pimpinan@12345` |
| Pegawai (contoh) | App mobile (NIP) | `KAR001` | `Pegawai@123` (wajib ganti password saat login pertama) |

## Ringkasan Endpoint API

Seluruh endpoint (kecuali login) memerlukan header `Authorization: Bearer <accessToken>`.

### Auth
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | Publik | Pegawai, body `{ nip, password }` |
| POST | `/api/auth/admin-login` | Publik | Admin/Pimpinan, body `{ username, password }` |
| POST | `/api/auth/refresh-token` | Publik | |
| POST | `/api/auth/change-password` | Semua akun | body `{ oldPassword, newPassword, email? }` — `email` hanya dipakai untuk akun pegawai |
| GET | `/api/auth/me` | Semua akun | |
| POST | `/api/auth/logout` | Semua akun | |

### Pegawai/Pegawai (`/api/users`) — Admin
| Method | Endpoint |
|---|---|
| GET | `/` (query: status, search, page, limit) |
| GET | `/:id` |
| POST | `/` |
| PUT | `/:id` |
| PATCH | `/:id/status` |
| POST | `/:id/reset-password` |
| DELETE | `/:id` (soft delete) |

### Absensi (`/api/attendance`)
| Method | Endpoint | Akses |
|---|---|---|
| POST | `/scan` | Pegawai (mobile) |
| GET | `/me` | Pegawai |
| GET | `/` (filter tanggal/user/status) | Admin, Pimpinan |
| GET | `/dashboard-summary` | Admin, Pimpinan |
| PUT | `/:id` (koreksi manual) | Admin |

### Izin/Cuti (`/api/leaves`)
| Method | Endpoint | Akses |
|---|---|---|
| POST | `/` (multipart, field `file`) | Pegawai |
| GET | `/me` | Pegawai |
| GET | `/` | Admin, Pimpinan |
| PUT | `/:id/review` | Admin (meneruskan ke Pimpinan) |
| PUT | `/:id/decision` | Pimpinan (approved/rejected) |

### Piket (`/api/piket`)
| Method | Endpoint | Akses |
|---|---|---|
| GET | `/` | Admin, Pimpinan |
| GET | `/me` | Pegawai |
| POST | `/` (body: tanggal, userIds[]) | Admin |
| DELETE | `/:id` | Admin |

### Tukar Jadwal Piket (`/api/piket/swaps`)
| Method | Endpoint | Akses |
|---|---|---|
| GET | `/swaps` (query: status, start, end) | Admin, Pimpinan |
| POST | `/:id/swap` (body: replacementUserId) | Admin — catat permintaan tukar |
| PUT | `/swaps/:swapId/agree` | Admin — catat kesediaan pengganti |
| PUT | `/swaps/:swapId/decision` (body: decision, catatan) | Admin — keputusan akhir |
| DELETE | `/swaps/:swapId` | Admin — batalkan permintaan berjalan |

> Detail alur, state machine, dan aturan validasi: **[docs/piket.md](docs/piket.md)**.

### Notifikasi (`/api/notifications`) — pegawai (notifikasi milik sendiri)
| Method | Endpoint |
|---|---|
| GET | `/` |
| GET | `/unread-count` |
| POST | `/read-all` |

### Laporan (`/api/reports`) — Admin, Pimpinan
| Method | Endpoint |
|---|---|
| GET | `/summary?start=&end=` |
| GET | `/attendance/export?start=&end=&format=pdf\|xlsx` |

### Pengaturan (`/api/settings`)
| Method | Endpoint | Akses |
|---|---|---|
| GET | `/` | Admin, Pimpinan |
| PUT | `/` | Admin |
| PUT | `/work-schedule/:dayType` | Admin |
| GET | `/qr-code` | Admin, Pimpinan |
| POST | `/qr-code/generate` | Admin |

### Log Aktivitas (`/api/activity-logs`) — Admin
| Method | Endpoint |
|---|---|
| GET | `/` (filter action, user_id, tanggal) |

## Logika Bisnis Utama

**Scan QR (`POST /api/attendance/scan`)** — menjalankan 4 lapis validasi:
1. **Layer 1 – Autentikasi**: token JWT pegawai (middleware `authenticate`).
2. **Layer 2 – Token QR**: memverifikasi token cocok dengan QR Code statis aktif.
3. **Layer 3 – Geofencing**: Haversine formula, ditolak jika jarak > radius (default 50m).
4. **Layer 4 – Jadwal**: Senin–Jumat pakai jadwal reguler; Sabtu hanya jika
   terdaftar di `piket_schedules`; jika tidak ada catatan check-in → **absen masuk**
   (status tepat waktu/terlambat berdasarkan toleransi); jika sudah check-in
   tanpa check-out → **absen pulang** (status normal/lembur); jika sudah
   lengkap → ditolak.

**Alur Izin/Cuti**: `pending` (diajukan pegawai) → `diteruskan` (ditinjau
Admin) → `approved`/`rejected` (keputusan Pimpinan). Saat disetujui, sistem
otomatis mengisi rekap harian berstatus **Izin/Cuti** pada rentang tanggal
terkait sehingga akses scan ditutup untuk tanggal tersebut.

**Penugasan Piket**: Admin menambah pegawai lewat modal Assign (baris pending
muncul di list utama) → Admin menekan tombol **Konfirmasi Piket** di atas
pagination → `POST /api/piket` mengirim seluruh `userIds` sekaligus → backend
**otomatis** membuat baris di `notifications` dan menandai
`piket_schedules.notification_sent = true` untuk pegawai yang baru ditugaskan
→ app mobile menampilkan badge merah di lonceng Dashboard saat polling
`GET /api/notifications/unread-count`. Tidak ada lagi tombol "Kirim
Notifikasi" manual (endpoint `POST /api/piket/:id/notify` dipertahankan hanya
untuk kompatibilitas).

**Tukar Jadwal Piket**: pegawai minta digantikan secara lisan ke Admin →
Admin mencatat permintaan (`POST /api/piket/:id/swap`, status
`menunggu_pengganti`) → Admin mencatat kesediaan pengganti
(`PUT /api/piket/swaps/:swapId/agree`, status `menunggu_admin`) → Admin
memberi keputusan (`PUT /api/piket/swaps/:swapId/decision`). Jika disetujui,
jadwal berpindah ke pegawai pengganti dan notifikasi otomatis dikirim ke
kedua pegawai. Tidak ada pengajuan dari app mobile. Detail: **[docs/piket.md](docs/piket.md)**.

**QR Code statis**: hanya satu token aktif pada satu waktu; generate/regenerasi
otomatis menonaktifkan token sebelumnya dan menghasilkan gambar PNG baru.

## Catatan

- Password disimpan ter-hash dengan bcrypt (10 rounds), baik di `users`
  maupun `admin_accounts`.
- Soft delete pada tabel `users` dan `admin_accounts` (kolom `deleted_at`)
  agar riwayat presensi/aktivitas tetap terjaga walau akunnya dihapus.
- `activity_logs` mencatat setiap aksi penting untuk kebutuhan audit trail,
  baik dari pegawai maupun admin/pimpinan.
- Notifikasi saat ini bersifat **in-app** (disimpan di tabel `notifications`,
  diambil app lewat polling `GET /api/notifications*`) — bukan push
  notification native (FCM/APNs). Kalau butuh push notification asli saat
  app di-background, itu memerlukan integrasi layanan tambahan di luar
  cakupan API ini.
- Belum ada endpoint untuk mengelola (`create`/`update`) akun
  `admin_accounts` lewat API — saat ini akun Admin/Pimpinan baru masih
  ditambahkan manual lewat database.
