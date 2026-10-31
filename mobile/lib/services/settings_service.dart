import 'package:flutter/material.dart';

import '../core/env/env.dart';
import '../models/piket_assignment.dart';
import '../models/work_schedule.dart';

/// Provides the system configuration that, per the report, is normally
/// managed by Admin from the website's "Pengaturan" page: jam kerja,
/// toleransi keterlambatan, titik koordinat kantor + radius Geofencing,
/// dan jadwal piket hari Sabtu.
///
/// Backed by a mock implementation here; swap [SettingsService.instance]
/// for a real API-backed implementation once the Node.js backend exists.
abstract class SettingsService {
  static SettingsService instance = MockSettingsService();

  Future<WorkSchedule> getWorkSchedule();

  /// Returns true if [nip] is assigned to Saturday piket duty. Per Sub Bab
  /// 3.2.7 point 2: if it's Saturday and the employee is NOT on the piket
  /// roster, the scan button must not be shown at all.
  Future<bool> isAssignedSaturdayPiket(String nip);

  /// Seluruh jadwal piket pegawai yang login (`GET /api/piket/me`), termasuk
  /// yang dibuat otomatis oleh fitur giliran (cycle) piket.
  Future<List<PiketAssignment>> getMyPiket();
  Future<List<DateTime>> getNationalHolidays();
}

class MockSettingsService implements SettingsService {
  // Employees on Saturday piket duty (would normally come from the
  // "User Schedule" table managed by Admin on the Piket page).
  static const _piketRoster = <String>{'3124510004', '3124510099'};

  @override
  Future<WorkSchedule> getWorkSchedule() async {
    await Future.delayed(const Duration(milliseconds: 150));
    return WorkSchedule(
      jamMasuk: const TimeOfDay(hour: 8, minute: 0),
      jamPulang: const TimeOfDay(hour: 16, minute: 0),
      toleransiMenit: 15,
      officeLatitude: Env.officeLatitude,
      officeLongitude: Env.officeLongitude,
      radiusMeters: Env.officeRadiusMeters,
      sabtuJamMasuk: const TimeOfDay(hour: 9, minute: 0),
      sabtuJamPulang: const TimeOfDay(hour: 12, minute: 0),
    );
  }

  @override
  Future<bool> isAssignedSaturdayPiket(String nip) async {
    await Future.delayed(const Duration(milliseconds: 100));
    return _piketRoster.contains(nip);
  }

  @override
  Future<List<PiketAssignment>> getMyPiket() async {
    await Future.delayed(const Duration(milliseconds: 100));
    // Sabtu terdekat (hari ini kalau kebetulan Sabtu), sebagai contoh giliran.
    final now = DateTime.now();
    final daysUntilSaturday = (DateTime.saturday - now.weekday + 7) % 7;
    final nextSaturday =
        DateTime(now.year, now.month, now.day).add(Duration(days: daysUntilSaturday));
    return [PiketAssignment(tanggal: nextSaturday, source: 'rotation')];
  }

  @override
  Future<List<DateTime>> getNationalHolidays() async => [];
}
