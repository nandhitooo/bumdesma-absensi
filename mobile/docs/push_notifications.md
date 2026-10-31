# Push Notification ke Notif Bar HP (FCM)

Dokumen ini menjelaskan alur push notification end-to-end untuk notifikasi
piket dan keputusan izin/cuti, agar notif muncul di **notif bar HP**
(Android/iOS), bukan hanya di panel lonceng dalam app.

## Gambaran Alur

1. Pegawai login di app → `AuthProvider.login` memanggil
   `FcmPushService.instance.start(nip)`.
2. `FcmPushService` meminta izin notifikasi (Android 13+ / iOS), membuat
   channel Android `piket` & `izin_cuti`, lalu mengambil FCM token perangkat.
3. Token didaftarkan ke backend via `POST /api/push/register`
   (`{ nip, token, platform }`) dengan header `Authorization: Bearer` dari
   sesi login (lewat `ApiClient`, base URL = `API_BASE_URL`).
4. Saat Admin/Pimpinan memutuskan izin/cuti atau menekan tombol
   "Kirim Notifikasi" piket, backend `notifier.js` membuat notifikasi in-app
   (tabel `notifications`) **dan sekaligus** mengirim push FCM ke semua
   token milik pegawai tersebut (tabel `push_tokens`).
5. OS menampilkan notifikasi di notif bar (app boleh sedang background
   atau ditutup). Saat app foreground, `FcmPushService` menampilkannya
   sendiri via flutter_local_notifications.
6. Logout → app memanggil `POST /api/push/unregister` (masih membawa Bearer,
   sebelum `SessionStore` dibersihkan) → baris token dihapus.

## Setup Firebase (sekali)

1. Buka https://console.firebase.google.com → buat project (atau pakai
   yang sudah ada) — project saat ini: `absensi-bumdesma`.
2. Tambahkan aplikasi **Android** dengan package name
   `com.bumdesma.absensi_bumdesma` (harus persis sama dengan
   `applicationId`).
3. Unduh `google-services.json` → simpan di
   `android/app/google-services.json`. (Sudah ada; file ini di-apply
   kondisional oleh `android/app/build.gradle.kts` sehingga build tetap
   jalan meski file belum ada, mis. di CI.)
4. (Opsional, untuk iOS) tambahkan app iOS dan ikuti langkah
   APNs + `GoogleService-Info.plist`.
5. Buat **Service Account** (Project settings → Service accounts →
   Generate new private key) → unduh JSON → simpan aman di server
   backend, JANGAN di-commit.

## Sisi Frontend (sudah selesai)

- `pubspec.yaml`: `firebase_core`, `firebase_messaging`,
  `flutter_local_notifications`.
- `android/app/src/main/AndroidManifest.xml`: permission
  `POST_NOTIFICATIONS` (Android 13+) + meta-data channel default `piket`.
- `lib/services/fcm_push_service.dart`: izin notifikasi, channel, token,
  tampil notif saat foreground. Register/unregister token memakai
  `ApiClient` (otomatis `Authorization: Bearer` + retry 401 via refresh
  token) ke `/push/register` & `/push/unregister`.
- `lib/state/auth_provider.dart`: `start()` saat login; saat logout,
  `stop()` dipanggil **sebelum** `AuthService.logout()` supaya sesi masih
  ada saat unregister.
- `.env`: `PUSH_NOTIFICATIONS_ENABLED=true`. Endpoint pendaftaran token
  otomatis mengikuti `API_BASE_URL`.

## Sisi Backend (backend, sudah selesai)

### Struktur file

| File | Isi |
|------|-----|
| `src/migrations/20260914000001-create-push-tokens.js` | Tabel `push_tokens` (FK ke `users.id`, unique `(user_id, token)`) |
| `src/models/pushToken.model.js` | Model Sequelize `PushToken` |
| `src/services/push.service.js` | `pushToUser(userId, { title, message, type, notificationId })` via `firebase-admin` (API **modular** v14) |
| `src/controllers/push.controller.js` | `register` / `unregister` token |
| `src/routes/push.routes.js` | `POST /api/push/register` & `/api/push/unregister` (diproteksi `authenticate`) |
| `src/utils/notifier.js` | Setiap `notifyUser`/`notifyUsers` otomatis menyisipkan push FCM |

### 1. Install & migrasi (sekali)

```bash
npm install                # firebase-admin sudah ada di package.json
npm run db:migrate         # membuat tabel push_tokens
```

### 2. Kredensial service account

Simpan file JSON service account di `backend/secrets/` (folder ini
sudah ada di `.gitignore` dan **tidak boleh** ikut ter-commit), lalu isi
`.env` backend dengan path **relatif** terhadap root project backend:

```
GOOGLE_APPLICATION_CREDENTIALS=secrets/firebase-service-account.json
```

Path relatif wajib, bukan path absolut. `push.service.js` me-resolve nilai
relatif terhadap root project (bukan cwd server), supaya `.env` yang sama
tetap benar di Windows maupun di CachyOS — path absolut seperti
`C:\secrets\x.json` atau `/home/user/x.json` tidak portable antar OS.

**Tanpa env ini server tetap jalan** — push FCM dilewati dengan warning
`[push]` di log, dan notifikasi in-app tetap normal (penting untuk dev tanpa
kredensial).

Verifikasi sekali jalan (tanpa mengirim push ke siapa pun):

```bash
npm run push:check
```

Skrip ini memeriksa file service account ketemu, `firebase-admin` berhasil
diinisialisasi, kredensialnya benar-benar diterima Google (lewat
`getAccessToken()`), dan berapa perangkat yang sudah terdaftar di
`push_tokens`.

> **Catatan API firebase-admin v14.** Di v14 `admin.apps`,
> `admin.credential`, dan `admin.messaging` pada root **sudah tidak ada**
> (semuanya `undefined`) — API-nya sekarang modular:
> `require('firebase-admin/app')` untuk `getApps`/`initializeApp`/`cert`, dan
> `require('firebase-admin/messaging')` untuk `getMessaging()`. Memakai API
> v11/v12 akan membuat `pushToUser` selalu melempar `TypeError` yang
> tertelan `try/catch`-nya sendiri, sehingga notif bar tidak pernah muncul
> tanpa error yang kelihatan di log.

### 3. Titik pengiriman

Tidak perlu memanggil push manual di controller. Dua titik ini otomatis
terpush lewat `notifier.js`:

- `leave.controller.js#decide` → type `izin_cuti`
  (channel Android `izin_cuti`).
- `piket.controller.js#notify` → type `piket`
  (channel Android `piket`).

`pushToUser` menggunakan multicast `sendEachForMulticast` ke semua token
milik user (satu orang bisa login di >1 perangkat), memilih channel
Android sesuai `type`, lalu menghapus token invalid (app diuninstall)
dari `push_tokens`. Push gagal **tidak pernah** menggagalkan request
utama — semua error ditelan dengan log `[push]`. Dan kalau tabel
`push_tokens` tidak punya baris untuk user ybs, `pushToUser` balik
tanpa memanggil FCM sama sekali — lihat "Jebakan Umum" di bawah.

## Jebakan Umum: Token Kosong (push tidak berbunyi walau semua "sudah disetup")

Gejala: konfigurasi terlihat lengkap (service account OK, kredensial
diterima Google, app tidak crash), tapi push tidak pernah muncul atau
berbunyi. Jalankan `npm run push:check` — kalau muncul:

```
⚠️  Belum ada perangkat terdaftar di tabel push_tokens.
```

…itu penyebabnya, dan memang **diam-diam**: `pushToUser()` mencari token
penerima di tabel `push_tokens` dan kalau kosong langsung balik tanpa
error, tanpa log, tanpa memanggil FCM. Backend hanya tidak punya target
kirim. Payload bunyi/channel di sisi app bisa sebenus apa pun — tidak ada
pesan yang dikirim berarti tidak ada yang berbunyi.

Kenapa token bisa kosong padahal user sudah berhasil login:

- Registrasi token (`FcmPushService._registerToken` →
  `POST /api/push/register`) **menelan error tanpa log**
  (`catch (_) {}`), jadi kegagalannya tidak terlihat di log app maupun
  backend.
- Registrasi memakai `ApiClient` → `API_BASE_URL`, jalur yang sama dengan
  REST API utama. Kalau `adb reverse` hilang / backend tidak jalan /
  `API_BASE_URL` salah pada saat login, `POST /auth/login` pun ikut gagal
  — tapi cukup satu kegagalan kecil setelah login sukses (device
  tercabut, adb restart, jaringan putus) agar register gagal diam-diam
  dan token tidak pernah sampai ke backend.
- Dialog izin notifikasi (Android 13+) yang ditolak TIDAK mencegah
  registrasi token — `getToken()` tetap jalan; yang diblokir hanya
  tampilannya. Jadi token kosong bukan karena permission.

Cara memverifikasi & memperbaiki:

1. Setelah setiap login, jalankan di folder backend:

   ```bash
   npm run push:check
   ```

   Wajib muncul `✅ N token terdaftar` (N ≥ 1) SEBELUM mengetes bunyi
   notifikasi. Kalau masih `⚠️ Belum ada perangkat terdaftar`, push pasti
   tidak terkirim — perbaiki dulu, jangan lanjut ke tes notif.
2. Token masih kosong setelah login ulang (full restart `flutter run`,
   bukan hot reload — token didaftarkan saat `start()` di alur login):
   - HP fisik: `adb reverse --list` harus menampilkan `tcp:5000
     tcp:5000`; jalankan ulang `adb reverse tcp:5000 tcp:5000` kalau
     kosong, lalu login ulang.
   - Emulator/Wi-Fi: cek `API_BASE_URL` di `.env` mobile
     (`10.0.2.2` / IP-LAN), lalu build ulang.
   - Pastikan backend hidup di OS yang sama dengan adb dan
     `API_BASE_URL`-nya benar.
3. Baru setelah token terdaftar: picu notifikasi (keputusan izin dari
   Pimpinan / penugasan piket). Payload `notification` + `channel_id`
   dengan channel `Importance.max` otomatis berbunyi + heads-up di
   Android — tidak ada setting bunyi terpisah yang perlu diaktifkan.
4. Catatan Android: kalau dulu terpasang build lama, preferensi channel
   bisa tertanam dari build lama (mis. importance rendah = tanpa bunyi).
   Uninstall atau clear storage app sebelum tes supaya channel `piket`
   & `izin_cuti` dibuat ulang fresh oleh `FcmPushService`.

## Format Payload

| Field | Keterangan |
|-------|-----------|
| `notification.title` | Judul di notif bar |
| `notification.body` | Isi notif |
| `android.channel_id` | `piket` atau `izin_cuti` |
| `data.type` | `piket` / `izin_cuti` |
| `data.notification_id` | UUID baris notifikasi in-app (untuk deeplink) |

## Checklist Testing

1. Setup service account di `.env` backend (langkah 2 di atas), lalu
   `npm run db:migrate` dan restart server.
2. Cek konfigurasi: `npm run push:check` → harus muncul
   `✅ Kredensial FCM diterima Google`.
3. Pastikan `API_BASE_URL` di `.env` mobile menunjuk ke backend yang benar
   (lihat panduan lengkap di `.env.example`). Yang penting: nilai ini **tanpa**
   akhiran `/api` — `ApiClient` yang menambahkan `/api`.
   - HP/tablet fisik: `http://localhost:5000` + `adb reverse tcp:5000 tcp:5000`
     (mapping hilang setiap adb restart / device tercabut, jadi ulangi)
   - Emulator AVD: `http://10.0.2.2:5000`
   - HP via Wi-Fi: `http://<IP-LAN-komputer>:5000`

   Kalau salah satu tidak beres, `POST /api/push/register` ikut gagal dan
   token tidak pernah terdaftar, sehingga tidak ada push yang bisa dikirim.
4. `flutter clean && flutter pub get`, jalankan `flutter run`.
5. Saat pertama login, dialog "izinkan notifikasi" muncul → pilih izinkan.
6. Cek log backend saat login: `POST /api/push/register` 200 (dengan
   Bearer token), baris baru di tabel `push_tokens` — atau jalankan
   `npm run push:check` dan lihat token yang terdaftar. **Wajib ≥ 1
   token terdaftar sebelum lanjut** — kalau masih kosong, lihat
   bagian "Jebakan Umum: Token Kosong" di atas; push tidak akan pernah
   terkirim walau semua langkah lain hijau.
7. Trigger keputusan izin dari akun Pimpinan → notif muncul di notif bar
   HP meski app di background.
8. App foreground → notif tetap muncul (dikirim flutter_local_notifications).
9. Logout → baris token terhapus dari `push_tokens`.
10. Matikan `GOOGLE_APPLICATION_CREDENTIALS` → server tetap hidup, muncul
    warning `[push]`, notifikasi in-app tetap jalan.
