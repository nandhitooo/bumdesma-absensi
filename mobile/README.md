# Absensi BUMDESMA Podo Rukun LKD — Mobile App (Flutter)

Aplikasi mobile untuk Sistem Manajemen Absensi Pegawai Berbasis QR Code
pada BUMDESMA Podo Rukun LKD, dibuat sesuai mockup dan workflow pada
Laporan Akhir (Sub Bab 3.2.6 – 3.2.10).

## Fitur yang sudah diimplementasikan

- **Login** dengan NIP + password, termasuk alur wajib ganti password
  pada login pertama.
- **Dashboard**: ringkasan absensi hari ini (jam masuk/pulang, status),
  panel notifikasi (jadwal piket & status izin/cuti).
- **Scan QR**: pilih Absen Masuk / Absen Pulang → kamera QR
  (`mobile_scanner`) → validasi token + **geofencing** (jarak GPS ke
  kantor, Haversine formula) → hasil (Tepat Waktu / Terlambat / Diterima /
  Lembur / Ditolak), sesuai mockup Gambar 3.26–3.34.
- **Ajukan Izin & Cuti**: tanggal, jenis, alasan, lampiran file
  (.pdf/.docx).
- **Riwayat**: daftar absensi bulanan dengan status berwarna.
- **Profile**: data pegawai, reset password, log-out.
- Aturan Sabtu piket: tombol absen otomatis disembunyikan jika pegawai
  tidak terjadwal piket pada hari Sabtu.

App sudah terhubung ke backend nyata: `main.dart` mengganti semua service
dengan implementasi HTTP (`HttpAuthService`, `HttpAttendanceService`,
`HttpLeaveService`, `HttpSettingsService`, `HttpNotificationService`)
yang memanggil REST API Node.js lewat `core/network/api_client.dart`.
Implementasi mock di `services/*_service.dart` dipertahankan sebagai
fallback/demo tanpa server — cukup tukar kembali
`XxxService.instance = MockXxxService()` di `main.dart`.
Tidak ada kode UI yang perlu diubah.

## Struktur proyek

```
lib/
  core/           # theme, .env wrapper, geofencing math (Haversine)
  models/         # AppUser, DailyAttendance, ScanResult, LeaveRequest, dll
  services/       # interface service + implementasi mock & HTTP (auth, attendance, leave, notification, settings)
  state/          # AuthProvider, AttendanceProvider (ChangeNotifier)
  screens/        # login, dashboard, scan, leave, history, profile
  shell/          # bottom navigation (Beranda/Riwayat/Scan/Izin/Profil)
  main.dart
.env                    # Maps API keys (JANGAN commit ke git — sudah di .gitignore)
.env.example            # template tanpa key asli
native_setup/           # panduan + snippet untuk wiring key Maps ke Android/iOS native
```

## Setup

### 1. Prasyarat

- **Flutter 3.50.0** (channel stable) dengan **Dart 3.14.0** — versi inilah
  yang dipakai untuk `flutter analyze` dan `flutter build apk --debug`
  terakhir (mesin Windows saat ini). `pubspec.yaml` memaku Flutter ke
  `>=3.44.0 <=3.50.0` (3.44.0 adalah constraint Flutter tertinggi yang
  diminta dependency yang ter-resolve, mis. `google_maps_flutter_android`).
  Jalankan `flutter doctor` dulu untuk memastikan environment kamu siap.
- **JDK 17+** untuk build Android. Mesin Windows saat ini memakai JDK bawaan
  Android Studio (JBR 25) tanpa konfigurasi tambahan, dan
  `flutter build apk --debug` berhasil. Kalau perlu memilih JDK lain, set lewat
  `flutter config --jdk-dir`, **bukan** `JAVA_HOME` dan **bukan**
  `android/gradle.properties`:

  ```bash
  # Linux
  flutter config --jdk-dir=/usr/lib/jvm/java-17-openjdk
  # Windows (PowerShell)
  flutter config --jdk-dir="C:\Program Files\Java\jdk-17"
  ```

  Alasannya, urutan pencarian JDK di Flutter (`flutter_tools/lib/src/android/java.dart`)
  adalah: `flutter config --jdk-dir` → **JDK bawaan Android Studio** →
  `JAVA_HOME` → `java` di PATH, jadi `JAVA_HOME` **kalah** oleh JBR Android
  Studio. Cek JDK yang benar-benar dipakai: `flutter doctor -v` → baris
  `Java binary at:`.
- Toolchain Android di repo: **Gradle 9.5.0**, **AGP 9.3.1**, **Kotlin 2.4.20**,
  `compileSdk` 37, `targetSdk` 36, `ndkVersion` 30.0.16248370.
  - Angka di atas = default template `flutter create` Flutter 3.50.0, karena
    Flutter 3.50 mewajibkan AGP >= 9.1.1 dan Gradle >= 9.5.0 (AGP 8.13.1
    gagal saat apply `dev.flutter.flutter-gradle-plugin`).
  - `compileSdk` 37 dan NDK 30.0.16248370 mengikuti yang terpasang di mesin
    Windows ini; Flutter 3.50 default-nya compileSdk 36 / NDK 28.2.13676358.
  - `android.newDsl=false` dan `android.builtInKotlin=false` dipertahankan
    supaya DSL lama tetap dipakai.

- Copy `.env` dari `.env.example` kalau clone baru — `.env` di-`.gitignore`,
  dan `flutter_dotenv` akan error saat app start kalau asset-nya tidak ada.

### 2. Install dependencies

```bash
cd mobile
flutter pub get
```

### 3. Generate folder platform (android/ ios/)

Folder `android/` dan `ios/` **belum disertakan** (dibuat oleh Flutter
tooling, bukan ditulis manual, supaya versi Gradle/Xcode selalu cocok
dengan Flutter SDK kamu). Generate dengan:

```bash
flutter create --platforms=android,ios --org com.bumdesma .
```

Perintah ini aman dijalankan di folder yang sudah berisi `lib/` dan
`pubspec.yaml` — ia hanya menambahkan folder platform yang belum ada,
tidak menimpa kode Dart kamu.

### 4. Wiring Google Maps API Key (Android & iOS)

Kunci di `.env` (`MAPS_API_ANDROID`, `MAPS_API_IOS`) dipakai oleh Maps
SDK secara **native**, bukan dibaca langsung oleh Dart saat runtime.
Ikuti file-file di `native_setup/`:

- `native_setup/android/AndroidManifest.xml.snippet` → tempel ke
  `android/app/src/main/AndroidManifest.xml`
- `native_setup/android/build.gradle.snippet` → tempel ke
  `android/app/build.gradle` (atau versi `.kts`)
- `native_setup/ios/Env.xcconfig.instructions` → buat
  `ios/Flutter/Env.xcconfig` dan sertakan di `Debug.xcconfig` /
  `Release.xcconfig`
- `native_setup/ios/Info.plist.snippet` → tempel ke
  `ios/Runner/Info.plist` dan `ios/Runner/AppDelegate.swift`

Dengan pola ini, key **hanya ada di satu tempat** (`.env`), tidak perlu
disalin manual ke berbagai file native, dan tidak pernah ter-commit ke
git (`.env` sudah masuk `.gitignore`; gunakan `.env.example` sebagai
referensi untuk kolaborator).

⚠️ **Catatan keamanan**: karena kedua key Maps sempat dibagikan secara
plaintext di percakapan ini, sebaiknya **rotate/regenerate** key
tersebut di Google Cloud Console, lalu batasi (restrict) key baru
berdasarkan nama paket Android / bundle ID iOS dan API yang diizinkan
(Maps SDK for Android/iOS saja).

### 5. Jalankan

```bash
flutter run
```

Di PC Windows ini (tanpa emulator Android dan tanpa Visual Studio untuk
desktop), jalankan versi web di Chrome:

```bash
cd mobile
flutter run -d chrome --web-port 5599
```

Halaman terbuka di `http://localhost:5599`. Dukungan web ditambahkan lewat
`flutter create --platforms=web .`; lampiran izin/cuti tetap bisa diunggah
di web (file dibaca sebagai bytes, bukan path), dan push FCM otomatis
dilewati. Untuk login, backend harus berjalan dan `API_BASE_URL` di `.env`
mengarah ke `http://localhost:5000` (browser tidak bisa memakai
`adb reverse`); bila `CORS_ORIGINS` backend diisi, tambahkan origin
`http://localhost:5599`.

## Menghubungkan app ke backend

`API_BASE_URL` di `.env` harus menunjuk ke backend yang benar — nilainya
berbeda tergantung cara menjalankan app (versi lengkap di `.env.example`):

| Cara menjalankan | Nilai                           | Catatan                                      |
| ---------------- | ------------------------------- | -------------------------------------------- |
| HP/tablet fisik  | `http://localhost:5000`         | plus `adb reverse tcp:5000 tcp:5000`         |
| Emulator (AVD)   | `http://10.0.2.2:5000`          | `10.0.2.2` = alias host dari dalam emulator  |
| HP via Wi-Fi     | `http://<IP-LAN-komputer>:5000` | satu jaringan + port 5000 diizinkan firewall |

Nilai ini **tanpa** akhiran `/api` — `ApiClient` yang menambahkan `/api`.

Kalau backend dijalankan lewat Docker Compose (lihat README root), port host
tetap **5000** dan sudah listen di `0.0.0.0`, jadi tabel di atas berlaku tanpa
perubahan konfigurasi. `http://<IP-LAN-komputer>:5000` adalah nilai paling
aman karena sekaligus bekerja untuk emulator, HP fisik via Wi-Fi, dan desktop
Linux — dengan syarat HP ada di jaringan yang sama dan port 5000 tidak
diblokir firewall. Database di container **terpisah** dari PostgreSQL lokal,
jadi jalankan seeder dulu agar akun demo ada:

```bash
docker compose run --rm backend npx sequelize-cli db:seed:all
```

⚠️ `adb reverse` **hilang** setiap kali adb server restart atau device
tercabut. Gejalanya persis seperti backend mati: app tiba-tiba "tidak bisa
login" padahal server hidup. Solusinya cukup jalankan ulang:

```bash
adb reverse tcp:5000 tcp:5000
adb reverse --list   # untuk memastikan mapping-nya aktif
```

## Pindah OS (CachyOS ⇄ Windows)

Proyek ini dikerjakan di dua OS. Ada 2 hal yang **wajib** dijaga:

1. **Jangan commit/menyalin path absolut per-OS.** Yang sudah dibereskan:
   `org.gradle.java.home` di `android/gradle.properties` (dulu berisi path
   JDK CachyOS, bikin Gradle gagal total di Windows). Yang perlu kamu jaga:
   `android/local.properties` berisi `sdk.dir` + `flutter.sdk` yang berbeda
   tiap OS — file ini sudah di-`.gitignore`, jadi **jangan** disalin manual
   antar mesin dan jangan ditaruh di folder yang di-sync (OneDrive/drive
   bersama). Biarkan `flutter run`/Android Studio yang menulis ulang.
2. **Selalu bersihkan cache generated saat ganti OS**, karena isinya path
   absolut OS sebelumnya (`.flutter-plugins-dependencies` contohnya menunjuk
   ke pub cache Windows `C:\Users\...\Pub\Cache`, sedangkan di CachyOS
   pub cache-nya `~/.pub-cache`).
3. `android/app/build.gradle.kts` mem-pin `ndkVersion = "30.0.16248370"`,
   `compileSdk` 37, dan `targetSdk` 36. Kalau di OS satunya NDK/platform versi
   itu belum terinstall, Gradle berhenti dengan _“No version of NDK matched”_.
   Install lewat SDK Manager (`sdkmanager "ndk;30.0.16248370"
"platforms;android-37"`), atau samakan `ndkVersion` di kedua mesin.
4. Di Windows tanpa Developer Mode, `flutter clean` menghapus
   `linux/flutter/ephemeral/.plugin_symlinks`, lalu `flutter pub get` bisa
   berhenti dengan “Building with plugins requires symlink support”. Aktifkan
   Developer Mode (`start ms-settings:developers`) — cara yang disarankan
   Flutter — atau jalankan ulang `flutter pub get`; folder symlink sudah
   dibuat sehingga percobaan berikutnya lolos.

```bash
flutter clean
rm -rf .dart_tool build android/.gradle android/.kotlin .flutter-plugins-dependencies
flutter pub get
flutter run
```

Catatan: folder platform yang ada baru `android/`, `ios/`, dan `linux/`.
Kalau mau jalan di desktop Windows, generate dulu:

```bash
flutter create --platforms=windows .
```

### Akun demo (backend seeder)

Dibuat oleh seeder backend
`backend/src/seeders/20260101000002-users.js`
(`npx sequelize-cli db:seed:all` di folder backend). Login ini memakai
backend nyata — bukan lagi mock service.

| NIP        | Password    | Catatan                                                  |
| ---------- | ----------- | -------------------------------------------------------- |
| 3124510004 | 12345678    | Password permanen — langsung masuk dashboard             |
| KAR001     | Pegawai@123 | Wajib ganti password saat login pertama (is_first_login) |

⚠️ Akun **admin** tidak bisa dipakai login di app mobile: admin tersimpan
di tabel `admin_accounts` yang terpisah dari `users` pegawai, dan hanya
bisa login lewat web frontend.

QR Code yang valid untuk demo scan: buat QR Code apa saja yang berisi
teks persis berikut (misal via generator QR online), lalu scan dengan
kamera perangkat/emulator kamu:

```
BUMDESMA-PODORUKUN-LKD-OFFICE-TOKEN
```

Karena geofencing membandingkan lokasi GPS aktual perangkat terhadap
koordinat kantor di `.env` (`OFFICE_LATITUDE`/`OFFICE_LONGITUDE`,
radius `OFFICE_RADIUS_METERS`), saat testing di emulator kamu bisa
mengatur lokasi mock emulator ke koordinat yang sama agar validasi
lolos (di Android Studio: Extended Controls → Location).

## Menghubungkan ke backend nyata (sudah terpasang)

Semua service sudah di-wiring ke implementasi HTTP di `main.dart`:

```dart
AuthService.instance = HttpAuthService(); // dst. untuk attendance, leave,
                                          // settings, notification
```

`HttpAuthService` dkk. memakai `ApiClient` (package `http`) yang membaca
`Env.apiBaseUrl` dari `.env` — lihat bagian "Menghubungkan app ke backend"
di atas untuk nilai `API_BASE_URL` per skenario (HP fisik/emulator/Wi-Fi).
Kalau butuh mode demo tanpa server, cukup kembalikan
`XxxService.instance = MockXxxService()` di `main.dart`.
