# Modul Piket (Jadwal Piket Sabtu)

Dokumentasi ini mencakup dua alur pada modul Piket:

1. **Penugasan (assign)** — Admin menetapkan pegawai ke jadwal piket Sabtu.
2. **Tukar jadwal (swap)** — pegawai minta digantikan pegawai lain pada tanggal
   yang sama; seluruh proses dimediasi Admin (tanpa pengajuan dari app mobile).

Piket hanya berlaku untuk **hari Sabtu**. Tanggal di luar Sabtu ditolak
dengan `422`.

---

## 1. Peran & Hak Akses

| Aksi | Admin | Pimpinan | Pegawai |
|---|---|---|---|
| Melihat daftar jadwal piket (`GET /piket`) | ✅ | ✅ | ❌ |
| Melihat piket sendiri (`GET /piket/me`) | ❌ | ❌ | ✅ |
| Menetapkan jadwal (`POST /piket`) | ✅ | ❌ | ❌ |
| Menghapus jadwal (`DELETE /piket/:id`) | ✅ | ❌ | ❌ |
| Melihat permintaan tukar (`GET /piket/swaps`) | ✅ | ✅ | ❌ |
| Mencatat permintaan tukar (`POST /piket/:id/swap`) | ✅ | ❌ | ❌ |
| Mencatat kesediaan pengganti | ✅ | ❌ | ❌ |
| Keputusan akhir tukar | ✅ | ❌ | ❌ |

> **Catatan kebijakan.** Pengajuan tukar jadwal **tidak** berasal dari app
> mobile. Pegawai menyampaikan permintaan secara lisan ke Admin, lalu Admin
> mencatatnya di Website. Persetujuan pegawai pengganti juga dicatat Admin
> (tombol **"B bersedia"**), bukan lewat tombol di app.

---

## 2. Skema Penugasan (Assign)

Alur di halaman **Piket** (Website Admin):

1. Admin menekan **Assign Piket** → modal pilih pegawai.
2. Setiap pegawai yang ditambahkan lewat tombol `+` langsung muncul di **list
   utama** sebagai baris **"Menunggu konfirmasi"** (belum tersimpan di server).
   Modal tetap terbuka agar bisa menambah beberapa pegawai sekaligus.
3. Baris pending bisa dibatalkan satu per satu sebelum dikonfirmasi.
4. Admin menutup modal, lalu menekan tombol **Konfirmasi Piket (N)** yang
   berada **di luar komponen assign**, tepat di atas deretan nomor halaman.
5. `POST /api/piket` mengirim seluruh `userIds` sekaligus.
6. Backend **otomatis mengirim notifikasi** ke setiap pegawai yang baru
   ditugaskan (lihat §5). Admin tidak perlu lagi menekan tombol "Kirim
   Notifikasi" per baris.

Kolom **Status** pada tabel jadwal menampilkan:

- **Menunggu konfirmasi** (kuning) — baris pending, belum dikirim ke server.
- **Terkonfirmasi** (hijau) — baris sudah tersimpan.

### Endpoint

#### `GET /api/piket`

Akses: Admin, Pimpinan.

Query: `start`, `end` (rentang tanggal), `search` (nama pegawai,
case-insensitive), `page`, `limit`.

Bila `page`/`limit` dikirim, response menyertakan `meta`. Tanpa keduanya
(dipakai app mobile), seluruh baris dikembalikan tanpa `meta`.

```json
{
  "success": true,
  "message": "Berhasil",
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "tanggal": "2026-10-10",
      "assigned_by": "uuid-admin",
      "notification_sent": true,
      "user": { "id": "uuid", "nip": "3124510004", "name": "Budi" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 10 }
}
```

#### `GET /api/piket/me`

Akses: Pegawai. Mengembalikan seluruh jadwal piket milik pegawai yang login
(urut tanggal `DESC`).

#### `POST /api/piket`

Akses: Admin.

Body:

```json
{ "tanggal": "2026-10-10", "userIds": ["uuid-1", "uuid-2"] }
```

Perilaku:

- Menolak `tanggal`/`userIds` kosong (`422`).
- Menolak tanggal bukan Sabtu (`422`).
- Memvalidasi format UUID; id tidak valid → `422` dengan detail per item.
- Duplikat dibuang, lalu satu `bulkCreate` dengan `ignoreDuplicates` (aman
  karena ada unique index `(user_id, tanggal)`) — bukan N+1 query.
- Notifikasi otomatis dikirim hanya ke baris yang **baru** (`notification_sent`
  masih `false`); baris lama tidak dikirim ulang.

Response `201` dengan pesan yang membedakan berapa pegawai baru yang
dinotifikasi.

#### `DELETE /api/piket/:id`

Akses: Admin. Menghapus satu baris jadwal piket.

> **Legacy.** `POST /api/piket/:id/notify` masih ada di backend untuk
> kompatibilitas, tetapi **tidak lagi dipakai** halaman Piket. Notifikasi kini
> otomatis saat assign dan saat tukar jadwal disetujui.

---

## 3. Alur Tukar Jadwal (Swap)

### 3.1 Skenario

Contoh: **A** terjadwal piket Sabtu, 10 Oktober, dan minta digantikan **B**.

1. A menyampaikan permintaan **secara lisan** ke Admin.
2. Admin membuka halaman **Piket**, pada baris jadwal A menekan tombol
   **tukar**, memilih B, lalu **Ajukan Tukar**.
   → Status: `menunggu_pengganti`.
3. B menyetujui secara lisan. Admin menekan **B bersedia** pada baris tersebut.
   → Status: `menunggu_admin`.
4. Admin menekan **Setujui**:
   - Jadwal dialihkan ke B (baris A berubah menjadi B, `assigned_by` diisi
     Admin yang memutuskan).
   - Notifikasi otomatis dikirim ke **B** (penugasan baru) dan ke **A**
     (pemberitahuan jadwalnya dialihkan).
   → Status: `approved`.
5. Jika Admin menekan **Tolak**, jadwal tidak berubah dan permintaan ditutup
   sebagai `rejected`. Ikon ✕ membatalkan permintaan yang masih berjalan
   (`cancelled`).

### 3.2 State Machine

```
                 (Admin catat permintaan)
                          │
                          ▼
              menunggu_pengganti ────(✕ batalkan)────► cancelled
                          │
              (Admin catat "B bersedia")
                          ▼
                   menunggu_admin ─────(✕ batalkan)────► cancelled
                    │            │
        (Setujui)   │            │  (Tolak)
                    ▼            ▼
                approved      rejected
```

Keputusan akhir **hanya** bisa diambil dari `menunggu_admin`. Memanggil
`/decision` saat status masih `menunggu_pengganti` ditolak `400` — kesediaan
pegawai pengganti wajib dicatat lebih dulu.

### 3.3 Aturan Validasi

Saat **mencatat permintaan** (`POST /api/piket/:id/swap`):

| Kondisi | Hasil |
|---|---|
| `replacementUserId` kosong | `422` |
| Jadwal asal tidak ditemukan | `404` |
| Pengganti sama dengan yang digantikan | `422` |
| Pengganti tidak ditemukan / tidak `active` | `404` |
| Pengganti sudah punya piket di tanggal yang sama | `409` |
| Sudah ada permintaan tukar berjalan untuk jadwal ini | `409` |

Saat **keputusan** (`PUT /api/piket/swaps/:swapId/decision`):

| Kondisi | Hasil |
|---|---|
| `decision` bukan `approved`/`rejected` | `422` |
| Permintaan tidak ditemukan | `404` |
| Status belum `menunggu_admin` | `400` |
| Jadwal asal sudah tidak ada | `404` |
| Pengganti sudah punya piket di tanggal itu | `409` |

"Permintaan berjalan" = status `menunggu_pengganti` atau `menunggu_admin`.
Satu jadwal hanya boleh punya satu permintaan berjalan pada satu waktu.

### 3.4 Endpoint

#### `GET /api/piket/swaps`

Akses: Admin, Pimpinan.

Query: `status`, `start`, `end` (rentang tanggal piket). Halaman Piket memakai
`start`/`end` sesuai tanggal yang sedang ditampilkan.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-swap",
      "piket_schedule_id": "uuid-jadwal",
      "tanggal": "2026-10-10",
      "status": "menunggu_admin",
      "agreed_at": "2026-10-03T02:15:00.000Z",
      "decided_by": null,
      "decided_at": null,
      "catatan": null,
      "requester": { "id": "uuid-a", "nip": "...", "name": "A" },
      "replacement": { "id": "uuid-b", "nip": "...", "name": "B" }
    }
  ]
}
```

#### `POST /api/piket/:id/swap`

Akses: Admin. `:id` = id jadwal piket asal.

Body: `{ "replacementUserId": "uuid-b" }` → `201`, status `menunggu_pengganti`.

#### `PUT /api/piket/swaps/:swapId/agree`

Akses: Admin. Tanpa body. Mencatat kesediaan pengganti →
`menunggu_pengganti` → `menunggu_admin`, mengisi `agreed_at`.

#### `PUT /api/piket/swaps/:swapId/decision`

Akses: Admin.

Body: `{ "decision": "approved", "catatan": "opsional" }`

Saat `approved`, backend dalam satu transaksi logis:

1. Memindahkan `piket_schedules.user_id` ke pegawai pengganti.
2. Mengisi `assigned_by` dengan Admin yang memutuskan.
3. Mengirim notifikasi ke pengganti dan ke peminta asal.
4. Menandai `notification_sent = true` pada jadwal.

#### `DELETE /api/piket/swaps/:swapId`

Akses: Admin. Membatalkan permintaan yang masih berjalan (`cancelled`).
Permintaan yang sudah final ditolak `400`.

---

## 4. Model Data

### `piket_schedules`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id`, pegawai yang piket |
| `tanggal` | DATEONLY | Tanggal piket (Sabtu) |
| `assigned_by` | UUID | FK → `admin_accounts.id` |
| `notification_sent` | BOOLEAN | `true` setelah notifikasi terkirim |

Unique index: `(user_id, tanggal)`.

### `piket_swaps`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | PK |
| `piket_schedule_id` | UUID | FK → `piket_schedules.id` (jadwal asal) |
| `tanggal` | DATEONLY | Salinan tanggal jadwal asal |
| `requester_user_id` | UUID | FK → `users.id`, pegawai yang minta digantikan |
| `replacement_user_id` | UUID | FK → `users.id`, pegawai pengganti |
| `status` | ENUM | Lihat §3.2 |
| `agreed_at` | DATE | Kapan kesediaan pengganti dicatat |
| `decided_by` | UUID | FK → `admin_accounts.id` |
| `decided_at` | DATE | |
| `catatan` | TEXT | Catatan keputusan (opsional) |

Index: `piket_schedule_id`, `tanggal`, `status`.

Nilai enum status didefinisikan di `src/utils/constants.js` sebagai
`PIKET_SWAP_STATUS`.

---

## 5. Notifikasi Otomatis

Notifikasi in-app dibuat lewat `notifyUser()` (`src/utils/notifier.js`), yang
juga mengirim push FCM. Kegagalan push tidak pernah menggagalkan request.

| Pemicu | Penerima | Judul |
|---|---|---|
| Assign pegawai baru | Pegawai baru | "Jadwal Piket Sabtu" |
| Tukar disetujui | Pegawai pengganti | "Jadwal Piket Sabtu" |
| Tukar disetujui | Peminta asal | "Jadwal Piket Dialihkan" |

Setiap aksi juga dicatat ke `activity_logs`:

| Action | Kapan |
|---|---|
| `ASSIGN_PIKET` | Admin menetapkan jadwal |
| `REMOVE_PIKET` | Admin menghapus jadwal |
| `AJUKAN_TUKAR_PIKET` | Admin mencatat permintaan tukar |
| `KESEDIAAN_TUKAR_PIKET` | Admin mencatat kesediaan pengganti |
| `KEPUTUSAN_TUKAR_PIKET` | Admin menyetujui/menolak tukar |
| `BATAL_TUKAR_PIKET` | Admin membatalkan permintaan |

---

## 6. Migrasi

Tabel `piket_swaps` dibuat oleh:

```
src/migrations/20260926000001-create-piket-swaps.js
```

Jalankan:

```bash
npm run db:migrate
```

---

## 7. File Terkait

| File | Peran |
|---|---|
| `src/models/piketSchedule.model.js` | Model jadwal piket |
| `src/models/piketSwap.model.js` | Model permintaan tukar |
| `src/controllers/piket.controller.js` | Assign, list, hapus |
| `src/controllers/piketSwap.controller.js` | Alur tukar jadwal |
| `src/routes/piket.routes.js` | Definisi endpoint |
| `src/utils/constants.js` | `PIKET_SWAP_STATUS` |
| `frontend/src/pages/Piket.jsx` | Halaman Admin |
