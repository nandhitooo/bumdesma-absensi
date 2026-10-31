/// Outcome of a single QR scan attempt, per Sub Bab 3.2.6 (Skema Penggunaan
/// QR Code) point 4: Absen Masuk (tepat waktu / terlambat), Absen Pulang
/// (diterima / lembur), or Scan Ditolak (token invalid, geofencing gagal,
/// atau data absensi hari itu sudah lengkap).
enum ScanType { masuk, pulang }

enum AttendanceStatus {
  tepatWaktu,
  terlambat,
  diterima,
  lembur,
  ditolakGeofence,
  ditolakToken,
  ditolakDataTidakLengkap, // e.g. absen pulang tanpa absen masuk
  ditolakSudahLengkap, // sudah absen masuk & pulang hari ini
  izinCuti,
  alpa,
}

class DailyAttendance {
  final DateTime date;
  final DateTime? jamMasuk;
  final DateTime? jamPulang;
  final AttendanceStatus? statusMasuk;
  final AttendanceStatus? statusPulang;
  final int? lemburMenit;
  final int? terlambatMenit;

  const DailyAttendance({
    required this.date,
    this.jamMasuk,
    this.jamPulang,
    this.statusMasuk,
    this.statusPulang,
    this.lemburMenit,
    this.terlambatMenit,
  });

  bool get sudahAbsenMasuk => jamMasuk != null;
  bool get sudahAbsenPulang => jamPulang != null;
  bool get lengkapHariIni => sudahAbsenMasuk && sudahAbsenPulang;

  DailyAttendance copyWith({
    DateTime? jamMasuk,
    DateTime? jamPulang,
    AttendanceStatus? statusMasuk,
    AttendanceStatus? statusPulang,
    int? lemburMenit,
    int? terlambatMenit,
  }) {
    return DailyAttendance(
      date: date,
      jamMasuk: jamMasuk ?? this.jamMasuk,
      jamPulang: jamPulang ?? this.jamPulang,
      statusMasuk: statusMasuk ?? this.statusMasuk,
      statusPulang: statusPulang ?? this.statusPulang,
      lemburMenit: lemburMenit ?? this.lemburMenit,
      terlambatMenit: terlambatMenit ?? this.terlambatMenit,
    );
  }
}

/// Result returned by AttendanceService.scan(), consumed by the result
/// screen to render the correct icon/color/message per the mockups
/// (Gambar 3.28–3.33).
class ScanResult {
  final bool success;
  final ScanType requestedType;
  final AttendanceStatus status;
  final DateTime timestamp;
  final int? lemburMenit;
  final int? terlambatMenit;
  final String message;

  const ScanResult({
    required this.success,
    required this.requestedType,
    required this.status,
    required this.timestamp,
    required this.message,
    this.lemburMenit,
    this.terlambatMenit,
  });
}
