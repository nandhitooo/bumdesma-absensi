import 'package:geolocator/geolocator.dart';

import '../core/utils/geo_utils.dart';
import '../models/attendance.dart';
import '../models/work_schedule.dart';
import 'leave_service.dart';
import 'settings_service.dart';

class LocationPermissionException implements Exception {
  final String message;
  LocationPermissionException(this.message);
}

/// Implements the QR-scan validation pipeline described in Sub Bab 3.2.6
/// (Skema Penggunaan QR Code) and 3.2.7 (Logika-Logika):
///
/// 1. Token QR harus valid (statis, di-generate oleh Admin).
/// 2. Validasi Geofencing: jarak ke kantor harus <= radius (default 50m).
/// 3. Absen Masuk dipicu jika belum ada check-in hari ini -> tepat waktu /
///    terlambat berdasarkan toleransi jadwal kerja.
/// 4. Absen Pulang dipicu jika sudah check-in tapi belum check-out ->
///    diterima / lembur.
/// 5. Selain itu -> Scan Ditolak (token invalid / di luar radius / data
///    absensi hari itu sudah lengkap / tidak ada check-in untuk pulang).
///
/// Swap [AttendanceService.instance] for a real HTTP-backed implementation
/// once the Node.js backend is available — the token, GPS coordinates, and
/// timestamp should be sent to the server, which performs this same
/// validation authoritatively.
abstract class AttendanceService {
  static AttendanceService instance = MockAttendanceService();

  /// The static token encoded in the office QR Code, generated once by
  /// Admin from the website's Pengaturan page.
  static const validOfficeToken = 'BUMDESMA-PODORUKUN-LKD-OFFICE-TOKEN';

  Future<ScanResult> scan({
    required String nip,
    required ScanType requestedType,
    required String scannedToken,
  });

  Future<DailyAttendance?> getToday(String nip);

  Future<List<DailyAttendance>> getHistory(
    String nip, {
    required DateTime month,
  });

  /// Mulai akuisisi posisi lebih awal (dipanggil saat layar scan dibuka)
  /// supaya fix GPS sudah siap ketika QR selesai dipindai. Aman dipanggil
  /// berkali-kali; hasilnya dipakai sekali oleh [scan]. Kegagalan akuisisi
  /// baru terasa saat [scan] dijalankan, bukan di sini.
  void warmUpLocation();
}

class MockAttendanceService implements AttendanceService {
  final Map<String, DailyAttendance> _todayByNip = {};
  final Map<String, List<DailyAttendance>> _historyByNip = {};

  DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  @override
  Future<DailyAttendance?> getToday(String nip) async {
    final today = _dateOnly(DateTime.now());
    final record = _todayByNip[nip];
    if (record != null && _dateOnly(record.date) == today) return record;
    return null;
  }

  @override
  Future<ScanResult> scan({
    required String nip,
    required ScanType requestedType,
    required String scannedToken,
  }) async {
    final now = DateTime.now();

    // 0. Blocked if an approved leave covers today.
    final onApprovedLeave =
        await LeaveService.instance.isOnApprovedLeave(nip, now);
    if (onApprovedLeave) {
      return ScanResult(
        success: false,
        requestedType: requestedType,
        status: AttendanceStatus.izinCuti,
        timestamp: now,
        message:
            'Anda sedang dalam masa Izin/Cuti yang disetujui. Akses absensi ditutup untuk hari ini.',
      );
    }

    // 1. Token validation.
    if (scannedToken != AttendanceService.validOfficeToken) {
      return ScanResult(
        success: false,
        requestedType: requestedType,
        status: AttendanceStatus.ditolakToken,
        timestamp: now,
        message: 'QR Code tidak valid atau sudah tidak berlaku.',
      );
    }

    // 2. Geofencing validation.
    final schedule = await SettingsService.instance.getWorkSchedule();
    final position = await _getCurrentPosition();
    final distance = GeoUtils.distanceInMeters(
      lat1: position.latitude,
      lon1: position.longitude,
      lat2: schedule.officeLatitude,
      lon2: schedule.officeLongitude,
    );

    if (distance > schedule.radiusMeters) {
      return ScanResult(
        success: false,
        requestedType: requestedType,
        status: AttendanceStatus.ditolakGeofence,
        timestamp: now,
        message:
            'Lokasi Anda berada di luar radius kantor (±${distance.round()}m). Absensi ditolak.',
      );
    }

    final today = _dateOnly(now);
    var record = _todayByNip[nip];
    if (record == null || _dateOnly(record.date) != today) {
      record = DailyAttendance(date: today);
    }

    if (requestedType == ScanType.masuk) {
      return _handleMasuk(nip, record, schedule, now);
    } else {
      return _handlePulang(nip, record, schedule, now);
    }
  }

  ScanResult _handleMasuk(
    String nip,
    DailyAttendance record,
    WorkSchedule schedule,
    DateTime now,
  ) {
    if (record.sudahAbsenMasuk) {
      return ScanResult(
        success: false,
        requestedType: ScanType.masuk,
        status: AttendanceStatus.ditolakSudahLengkap,
        timestamp: now,
        message: 'Anda sudah melakukan absen masuk hari ini.',
      );
    }

    final batasMasuk = DateTime(
      now.year,
      now.month,
      now.day,
      schedule.jamMasuk.hour,
      schedule.jamMasuk.minute,
    ).add(Duration(minutes: schedule.toleransiMenit));

    final terlambat = now.isAfter(batasMasuk);
    final status =
        terlambat ? AttendanceStatus.terlambat : AttendanceStatus.tepatWaktu;
    final terlambatMenit = terlambat ? now.difference(batasMasuk).inMinutes : 0;

    _todayByNip[nip] = record.copyWith(jamMasuk: now, statusMasuk: status);

    return ScanResult(
      success: true,
      requestedType: ScanType.masuk,
      status: status,
      timestamp: now,
      terlambatMenit: terlambat ? terlambatMenit : null,
      message: terlambat
          ? 'Absen masuk berhasil. Anda tercatat terlambat $terlambatMenit menit.'
          : 'Absen masuk berhasil. Anda datang tepat waktu.',
    );
  }

  ScanResult _handlePulang(
    String nip,
    DailyAttendance record,
    WorkSchedule schedule,
    DateTime now,
  ) {
    if (!record.sudahAbsenMasuk) {
      return ScanResult(
        success: false,
        requestedType: ScanType.pulang,
        status: AttendanceStatus.ditolakDataTidakLengkap,
        timestamp: now,
        message:
            'Data absen masuk tidak ditemukan untuk hari ini. Absen pulang tidak dapat diproses.',
      );
    }

    if (record.sudahAbsenPulang) {
      return ScanResult(
        success: false,
        requestedType: ScanType.pulang,
        status: AttendanceStatus.ditolakSudahLengkap,
        timestamp: now,
        message: 'Anda sudah melakukan absen pulang hari ini.',
      );
    }

    final batasPulang = DateTime(
      now.year,
      now.month,
      now.day,
      schedule.jamPulang.hour,
      schedule.jamPulang.minute,
    );

    final lembur = now.isAfter(batasPulang);
    final lemburMenit = lembur ? now.difference(batasPulang).inMinutes : 0;
    final status = lembur ? AttendanceStatus.lembur : AttendanceStatus.diterima;

    _todayByNip[nip] = record.copyWith(
      jamPulang: now,
      statusPulang: status,
      lemburMenit: lembur ? lemburMenit : null,
    );

    _appendToHistory(nip, _todayByNip[nip]!);

    return ScanResult(
      success: true,
      requestedType: ScanType.pulang,
      status: status,
      timestamp: now,
      lemburMenit: lembur ? lemburMenit : null,
      message: lembur
          ? 'Absen pulang berhasil. Lembur tercatat $lemburMenit menit.'
          : 'Absen pulang berhasil. Sampai jumpa besok!',
    );
  }

  void _appendToHistory(String nip, DailyAttendance record) {
    final list = _historyByNip.putIfAbsent(nip, () => []);
    list.removeWhere((r) => _dateOnly(r.date) == _dateOnly(record.date));
    list.add(record);
  }

  @override
  void warmUpLocation() {
    // Mock mengambil posisi langsung saat scan(); prefetch tidak diperlukan.
  }

  Future<Position> _getCurrentPosition() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw LocationPermissionException(
        'Izin lokasi diperlukan untuk melakukan absensi.',
      );
    }

    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw LocationPermissionException(
        'Aktifkan layanan lokasi (GPS) untuk melakukan absensi.',
      );
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    );
  }

  @override
  Future<List<DailyAttendance>> getHistory(
    String nip, {
    required DateTime month,
  }) async {
    await Future.delayed(const Duration(milliseconds: 200));

    final real = _historyByNip[nip] ?? [];
    final generated = _generateMockHistory(month);

    // Merge: real scans (if any, for current month) take precedence.
    final byDay = {for (final r in generated) _dateOnly(r.date): r};
    for (final r in real) {
      if (r.date.year == month.year && r.date.month == month.month) {
        byDay[_dateOnly(r.date)] = r;
      }
    }

    final list = byDay.values.toList()
      ..sort((a, b) => a.date.compareTo(b.date));
    return list;
  }

  List<DailyAttendance> _generateMockHistory(DateTime month) {
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final now = DateTime.now();
    final list = <DailyAttendance>[];

    for (var d = 1; d <= daysInMonth; d++) {
      final date = DateTime(month.year, month.month, d);
      if (date.isAfter(now)) break;
      if (date.weekday == DateTime.sunday) continue;
      if (date.weekday == DateTime.saturday) continue;

      final lateDay = d % 7 == 0;
      final masuk = DateTime(
        date.year,
        date.month,
        date.day,
        8,
        lateDay ? 22 : 0,
      );
      final pulang = DateTime(date.year, date.month, date.day, 16, 5);

      list.add(DailyAttendance(
        date: date,
        jamMasuk: masuk,
        jamPulang: pulang,
        statusMasuk:
            lateDay ? AttendanceStatus.terlambat : AttendanceStatus.tepatWaktu,
        statusPulang: AttendanceStatus.diterima,
        terlambatMenit: lateDay ? 22 : null,
      ));
    }
    return list;
  }
}
