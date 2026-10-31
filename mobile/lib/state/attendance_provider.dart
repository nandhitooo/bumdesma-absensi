import 'package:flutter/material.dart';

import '../models/attendance.dart';
import '../services/attendance_service.dart';

class AttendanceProvider extends ChangeNotifier {
  DailyAttendance? _today;
  bool _loading = false;

  DailyAttendance? get today => _today;
  bool get loading => _loading;

  Future<void> refreshToday(String nip) async {
    _loading = true;
    notifyListeners();
    _today = await AttendanceService.instance.getToday(nip);
    _loading = false;
    notifyListeners();
  }

  Future<ScanResult> scan({
    required String nip,
    required ScanType type,
    required String token,
  }) async {
    final result = await AttendanceService.instance.scan(
      nip: nip,
      requestedType: type,
      scannedToken: token,
    );
    await refreshToday(nip);
    return result;
  }
}
