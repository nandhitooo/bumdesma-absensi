import 'dart:io';

import 'package:intl/intl.dart';

import '../core/network/api_client.dart';
import '../models/leave_request.dart';
import 'leave_service.dart';

/// Real implementation of [LeaveService], wired to backend's
/// /api/leaves routes (POST is multipart/form-data because of the optional
/// .pdf/.docx lampiran — see leave.routes.js + upload.middleware.js).
class HttpLeaveService implements LeaveService {
  final ApiClient _api = ApiClient.instance;
  final _dateFmt = DateFormat('yyyy-MM-dd');

  @override
  Future<List<LeaveRequest>> getMyLeaveRequests(String nip) async {
    final res = await _api.get('/leaves/me');
    final rows = (res['data'] as List).cast<Map<String, dynamic>>();
    return rows.map(_fromJson).toList();
  }

  @override
  Future<LeaveRequest> submit({
    required String nip,
    required LeaveType type,
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
    String? attachmentPath,
  }) async {
    final fields = {
      'jenis': _typeToJson(type),
      'tanggal_mulai': _dateFmt.format(startDate),
      'tanggal_selesai': _dateFmt.format(endDate),
      'alasan': reason,
    };

    final file = attachmentPath != null ? File(attachmentPath) : null;

    final res = await _api.postMultipart('/leaves', fields: fields, file: file);
    return _fromJson(res['data'] as Map<String, dynamic>);
  }

  String _typeToJson(LeaveType type) {
    switch (type) {
      case LeaveType.cuti:
        return 'cuti';
      case LeaveType.sakit:
        return 'sakit';
      case LeaveType.izin:
        return 'izin';
    }
  }

  LeaveType _typeFromJson(String? jenis) {
    switch (jenis) {
      case 'cuti':
        return LeaveType.cuti;
      case 'sakit':
        return LeaveType.sakit;
      case 'izin':
      default:
        return LeaveType.izin;
    }
  }

  LeaveRequest _fromJson(Map<String, dynamic> row) {
    return LeaveRequest(
      id: row['id'] as String,
      type: _typeFromJson(row['jenis'] as String?),
      startDate: DateTime.parse(row['tanggal_mulai'] as String).toLocal(),
      endDate: DateTime.parse(row['tanggal_selesai'] as String).toLocal(),
      reason: row['alasan'] as String,
      attachmentFileName: row['file_lampiran'] as String?,
      submittedAt: DateTime.parse(row['created_at'] as String).toLocal(),
      status: _mapStatus(row['status'] as String?),
    );
  }

  @override
  Future<bool> isOnApprovedLeave(String nip, DateTime date) async {
    // Purely advisory on the mobile side (e.g. to hide the scan button) —
    // POST /attendance/scan already rejects scans during an approved leave
    // authoritatively on the server regardless of this check.
    final list = await getMyLeaveRequests(nip);
    final target = DateTime(date.year, date.month, date.day);
    return list.any((r) {
      if (r.status != LeaveStatus.disetujui) return false;
      final start =
          DateTime(r.startDate.year, r.startDate.month, r.startDate.day);
      final end = DateTime(r.endDate.year, r.endDate.month, r.endDate.day);
      return !target.isBefore(start) && !target.isAfter(end);
    });
  }

  // status ('pending' | 'diteruskan' | 'approved' | 'rejected') -> LeaveStatus
  LeaveStatus _mapStatus(String? status) {
    switch (status) {
      case 'approved':
        return LeaveStatus.disetujui;
      case 'rejected':
        return LeaveStatus.ditolak;
      case 'pending':
      case 'diteruskan':
      default:
        return LeaveStatus.menunggu;
    }
  }
}
