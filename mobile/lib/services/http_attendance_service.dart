import 'dart:async';

import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';

import '../core/network/api_client.dart';
import '../models/attendance.dart';
import 'attendance_service.dart';

/// Real implementation of [AttendanceService], wired to backend's
/// /api/attendance routes. All validation (token, geofencing, jadwal
/// kerja/piket, izin/cuti) happens authoritatively on the server — see
/// attendance.controller.js#scan — this class only forwards the GPS
/// coordinates and scanned token and translates the JSON response back
/// into the app's [ScanResult]/[DailyAttendance] models.
class HttpAttendanceService implements AttendanceService {
  final ApiClient _api = ApiClient.instance;
  final _dateFmt = DateFormat('yyyy-MM-dd');

  @override
  Future<ScanResult> scan({
    required String nip,
    required ScanType requestedType,
    required String scannedToken,
  }) async {
    final position = await _getCurrentPosition();
    final now = DateTime.now();

    try {
      final res = await _api.post('/attendance/scan', body: {
        'token': scannedToken,
        'latitude': position.latitude,
        'longitude': position.longitude,
      });
      final data = res['data'] as Map<String, dynamic>;
      final attendance = data['attendance'] as Map<String, dynamic>;
      final jenis = data['jenis'] as String; // 'masuk' | 'pulang'

      final status = jenis == 'masuk'
          ? _mapMasukStatus(attendance['status'] as String?)
          : _mapPulangStatus(attendance['checkout_status'] as String?);

      return ScanResult(
        success: true,
        requestedType: jenis == 'masuk' ? ScanType.masuk : ScanType.pulang,
        status: status,
        timestamp: now,
        terlambatMenit: jenis == 'masuk'
            ? (attendance['late_minutes'] as num?)?.toInt()
            : null,
        lemburMenit: jenis == 'pulang'
            ? (attendance['overtime_minutes'] as num?)?.toInt()
            : null,
        message: res['message'] as String,
      );
    } on ApiException catch (e) {
      return ScanResult(
        success: false,
        requestedType: requestedType,
        status: _mapRejectionStatus(e),
        timestamp: now,
        message: e.message,
      );
    }
  }

  @override
  Future<DailyAttendance?> getToday(String nip) async {
    final today = DateTime.now();
    final list = await getHistory(nip, month: today);
    final todayOnly = DateTime(today.year, today.month, today.day);
    try {
      return list.firstWhere(
        (r) => DateTime(r.date.year, r.date.month, r.date.day) == todayOnly,
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Future<List<DailyAttendance>> getHistory(
    String nip, {
    required DateTime month,
  }) async {
    final start = DateTime(month.year, month.month, 1);
    final end = DateTime(month.year, month.month + 1, 0);

    final res = await _api.get('/attendance/me', query: {
      'start': _dateFmt.format(start),
      'end': _dateFmt.format(end),
    });
    final rows = (res['data'] as List).cast<Map<String, dynamic>>();

    return rows.map((row) {
      final date = DateTime.parse(row['tanggal'] as String);
      final jamMasuk = row['jam_masuk'] != null
          ? DateTime.parse(row['jam_masuk'] as String).toLocal()
          : null;
      final jamPulang = row['jam_pulang'] != null
          ? DateTime.parse(row['jam_pulang'] as String).toLocal()
          : null;

      return DailyAttendance(
        date: date,
        jamMasuk: jamMasuk,
        jamPulang: jamPulang,
        statusMasuk: _mapMasukStatus(row['status'] as String?),
        statusPulang: jamPulang != null
            ? _mapPulangStatus(row['checkout_status'] as String?)
            : null,
        lemburMenit: (row['overtime_minutes'] as num?)?.toInt(),
        terlambatMenit: (row['late_minutes'] as num?)?.toInt(),
      );
    }).toList();
  }

  // status ('tepat_waktu' | 'terlambat' | 'alpa' | 'izin_cuti') -> AttendanceStatus
  AttendanceStatus _mapMasukStatus(String? status) {
    switch (status) {
      case 'terlambat':
        return AttendanceStatus.terlambat;
      case 'izin_cuti':
        return AttendanceStatus.izinCuti;
      case 'alpa':
        return AttendanceStatus.alpa;
      case 'tepat_waktu':
      default:
        return AttendanceStatus.tepatWaktu;
    }
  }

  // checkout_status ('normal' | 'lembur' | 'belum_pulang') -> AttendanceStatus
  AttendanceStatus _mapPulangStatus(String? checkoutStatus) {
    return checkoutStatus == 'lembur'
        ? AttendanceStatus.lembur
        : AttendanceStatus.diterima;
  }

  AttendanceStatus _mapRejectionStatus(ApiException e) {
    final msg = e.message.toLowerCase();
    if (msg.contains('qr code') || msg.contains('token')) {
      return AttendanceStatus.ditolakToken;
    }
    if (msg.contains('radius')) return AttendanceStatus.ditolakGeofence;
    if (msg.contains('izin/cuti')) return AttendanceStatus.izinCuti;
    if (msg.contains('sudah melakukan absen masuk dan pulang')) {
      return AttendanceStatus.ditolakSudahLengkap;
    }
    if (msg.contains('absen pulang tidak dapat diproses')) {
      return AttendanceStatus.ditolakDataTidakLengkap;
    }
    return AttendanceStatus.ditolakSudahLengkap;
  }

  /// Batas tunggu fix GPS. Radius geofence kantor hanya puluhan meter, jadi
  /// akurasi high tetap dipertahankan; yang membuat absensi terasa lama
  /// adalah menunggu fix GPS murni (indoor/sinyal buruk bisa 30 detik lebih
  /// tanpa batas). timeLimit membatasi tunggu maksimum, dan bila timeout
  /// kita jatuh ke posisi terakhir yang sudah diketahui sistem. Backend
  /// tetap memvalidasi radius, jadi posisi basi hanya berujung penolakan
  /// dengan pesan jarak, bukan data absensi yang salah.
  static const _positionTimeLimit = Duration(seconds: 10);

  /// Hasil [warmUpLocation]: akuisisi yang dimulai sejak layar scan dibuka,
  /// paralel dengan pemindaian QR. Dikonsumsi sekali oleh scan(); null
  /// berarti tidak ada prefetch aktif (atau sudah terpakai).
  Future<Position>? _positionPrefetch;

  @override
  void warmUpLocation() {
    if (_positionPrefetch != null) return;
    final future = _acquirePosition();
    // Listener no-op: kalau user keluar tanpa scan, kegagalan akuisisi
    // (mis. timeout tanpa posisi terakhir) tidak menjadi unhandled error.
    unawaited(future.then<void>((_) {}, onError: (Object _) {}));
    _positionPrefetch = future;
  }

  /// Pakai hasil prefetch bila ada, kalau tidak mulai akuisisi baru.
  Future<Position> _getCurrentPosition() {
    final prefetch = _positionPrefetch;
    _positionPrefetch = null;
    return prefetch ?? _acquirePosition();
  }

  Future<Position> _acquirePosition() async {
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

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: _positionTimeLimit,
        ),
      );
    } on TimeoutException {
      // GPS tidak menghasilkan fix dalam batas waktu (typical indoor):
      // pakai posisi terakhir yang diketahui sistem, kalau ada.
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) return lastKnown;
      rethrow;
    }
  }
}
