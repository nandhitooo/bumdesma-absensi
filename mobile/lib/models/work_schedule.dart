import 'package:flutter/material.dart';

/// Mirrors Tabel 3.1 (Work Schedule) and the Pengaturan page: jam kerja
/// reguler, batas toleransi keterlambatan, serta konfigurasi geofencing.
///
/// [sabtuJamMasuk]/[sabtuJamPulang] null berarti jadwal Sabtu belum
/// dikonfigurasi Admin, atau baris day_type='sabtu' tidak ditemukan di
/// backend — UI harus menampilkan fallback yang aman, bukan jam hardcode.
class WorkSchedule {
  final TimeOfDay jamMasuk;
  final TimeOfDay jamPulang;
  final int toleransiMenit;
  final double officeLatitude;
  final double officeLongitude;
  final double radiusMeters;
  final TimeOfDay? sabtuJamMasuk;
  final TimeOfDay? sabtuJamPulang;

  const WorkSchedule({
    required this.jamMasuk,
    required this.jamPulang,
    required this.toleransiMenit,
    required this.officeLatitude,
    required this.officeLongitude,
    required this.radiusMeters,
    this.sabtuJamMasuk,
    this.sabtuJamPulang,
  });

  String get jamMasukLabel => _fmt(jamMasuk);
  String get jamPulangLabel => _fmt(jamPulang);
  String? get sabtuJamMasukLabel => sabtuJamMasuk != null ? _fmt(sabtuJamMasuk!) : null;
  String? get sabtuJamPulangLabel => sabtuJamPulang != null ? _fmt(sabtuJamPulang!) : null;

  static String _fmt(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
}