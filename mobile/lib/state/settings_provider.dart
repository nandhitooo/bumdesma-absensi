import 'package:flutter/material.dart';

import '../models/piket_assignment.dart';
import '../models/work_schedule.dart';
import '../services/settings_service.dart';

/// Cache ringan untuk WorkSchedule (jam kerja, toleransi, radius geofencing)
/// dari backend, dipakai bersama oleh Dashboard, AttendanceSummaryCard, dan
/// ScanSelectScreen supaya tidak ada lagi teks jam/radius yang di-hardcode
/// di UI — semua mengikuti data yang diatur Admin dari Website.
class SettingsProvider extends ChangeNotifier {
  WorkSchedule? _schedule;
  List<PiketAssignment> _piketAssignments = const [];
  bool _loading = false;

  WorkSchedule? get schedule => _schedule;
  bool get loading => _loading;

  /// Jadwal piket terdekat pegawai (hari ini atau setelahnya), atau null kalau
  /// tidak ada. Menjadi sumber kartu "Piket Berikutnya" di Dashboard.
  PiketAssignment? get nextPiket {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final upcoming = _piketAssignments
        .where((p) => !p.tanggal.isBefore(today))
        .toList()
      ..sort((a, b) => a.tanggal.compareTo(b.tanggal));
    return upcoming.isEmpty ? null : upcoming.first;
  }

  /// Memuat schedule sekali saja per sesi aplikasi (dipanggil dari
  /// Dashboard). Layar lain yang butuh data terbaru bisa memanggil
  /// [refresh] secara eksplisit.
  Future<void> loadIfNeeded() async {
    if (_schedule != null || _loading) return;
    await refresh();
  }

  Future<void> refresh() async {
    _loading = true;
    notifyListeners();
    // Dua permintaan terpisah: kegagalan salah satu tidak menghapus data yang
    // lain (mis. jadwal piket gagal dimuat tetap menyisakan jam kerja lama).
    try {
      _schedule = await SettingsService.instance.getWorkSchedule();
    } catch (_) {
      // Biarkan _schedule lama (atau null) — UI pemanggil wajib punya
      // fallback yang aman kalau schedule belum berhasil dimuat.
    }
    try {
      _piketAssignments = await SettingsService.instance.getMyPiket();
    } catch (_) {
      // Jadwal piket gagal dimuat: kartu "Piket Berikutnya" tidak ditampilkan.
    }
    _loading = false;
    notifyListeners();
  }
}
