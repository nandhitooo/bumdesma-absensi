import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import '../core/network/api_client.dart';
import '../models/piket_assignment.dart';
import '../models/work_schedule.dart';
import 'settings_service.dart';

/// Real implementation of [SettingsService], wired to backend's
/// /api/settings and /api/piket/me routes.
class HttpSettingsService implements SettingsService {
  final ApiClient _api = ApiClient.instance;

  @override
  Future<WorkSchedule> getWorkSchedule() async {
    final res = await _api.get('/settings');
    final data = res['data'] as Map<String, dynamic>;
    final settings = data['settings'] as Map<String, dynamic>;
    final schedules =
        (data['workSchedules'] as List).cast<Map<String, dynamic>>();

    final reguler = schedules.firstWhere(
      (s) => s['day_type'] == 'reguler',
      orElse: () => schedules.first,
    );
    // Jadwal Sabtu opsional — Admin bisa saja belum mengaktifkannya
    // (is_active=false) atau baris day_type='sabtu' belum tersedia.
    final sabtu = schedules.firstWhere(
      (s) => s['day_type'] == 'sabtu',
      orElse: () => const <String, dynamic>{},
    );

    return WorkSchedule(
      jamMasuk: _parseTime(reguler['start_time'] as String),
      jamPulang: _parseTime(reguler['end_time'] as String),
      toleransiMenit: (reguler['late_tolerance_minutes'] as num).toInt(),
      officeLatitude: double.parse(settings['office_latitude'].toString()),
      officeLongitude: double.parse(settings['office_longitude'].toString()),
      radiusMeters: double.parse(
        (settings['geofence_radius_meters'] ?? 50).toString(),
      ),
      sabtuJamMasuk: sabtu['start_time'] != null
          ? _parseTime(sabtu['start_time'] as String)
          : null,
      sabtuJamPulang: sabtu['end_time'] != null
          ? _parseTime(sabtu['end_time'] as String)
          : null,
    );
  }

  @override
  Future<bool> isAssignedSaturdayPiket(String nip) async {
    final res = await _api.get('/piket/me');
    final rows = (res['data'] as List).cast<Map<String, dynamic>>();
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    return rows.any((r) => r['tanggal'] == todayStr);
  }

  /// Seluruh jadwal piket pegawai yang login. Baris dari fitur giliran (cycle)
  /// ditandai `source = 'rotation'` oleh backend (utils/piketRotation.js).
  @override
  Future<List<PiketAssignment>> getMyPiket() async {
    final res = await _api.get('/piket/me');
    final rows = (res['data'] as List).cast<Map<String, dynamic>>();
    return rows.map(PiketAssignment.fromJson).toList();
  }

  // Backend TIME column comes back as 'HH:mm:ss'.
  TimeOfDay _parseTime(String hhmmss) {
    final parts = hhmmss.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  /// national_holidays now supports two shapes for backward compatibility:
  ///   - Legacy: a plain date string, e.g. "2026-08-17"
  ///   - Current: a range object, e.g.
  ///     { "tanggal_mulai": "2026-04-08", "tanggal_selesai": "2026-04-15",
  ///       "keterangan": "Cuti Bersama Lebaran" }
  /// enabling multi-day holiday ranges (long holidays) set from the admin
  /// website's Pengaturan page. Every calendar day within a range is
  /// expanded into the returned list so callers (e.g. ScanSelectScreen's
  /// eligibility check) can keep doing a simple day-equality lookup.
  @override
  Future<List<DateTime>> getNationalHolidays() async {
    final res = await _api.get('/settings');
    final data = res['data'] as Map<String, dynamic>;
    final settings = data['settings'] as Map<String, dynamic>;
    final raw = settings['national_holidays'];
    List<dynamic> list;
    if (raw is String) {
      list = raw.isEmpty ? [] : (jsonDecode(raw) as List<dynamic>);
    } else {
      list = (raw as List<dynamic>?) ?? [];
    }

    final result = <DateTime>[];
    for (final item in list) {
      if (item is String) {
        result.add(DateTime.parse(item));
      } else if (item is Map) {
        final startStr = (item['tanggal_mulai'] ?? item['start']) as String?;
        final endStr = (item['tanggal_selesai'] ?? item['end']) as String?;
        if (startStr == null) continue;
        final start = DateTime.parse(startStr);
        final end = endStr != null ? DateTime.parse(endStr) : start;
        for (var d = start;
            !d.isAfter(end);
            d = d.add(const Duration(days: 1))) {
          result.add(d);
        }
      }
    }
    return result;
  }
}
