import '../models/leave_request.dart';

/// Handles Pengajuan Izin/Cuti (Gambar 3.25): pegawai mengisi tanggal,
/// alasan, dan melampirkan file .pdf/.docx. Pengajuan diteruskan ke Admin
/// lalu diputuskan oleh Pimpinan. Selama masa izin yang berstatus
/// "Approved", akses absensi otomatis ditutup untuk tanggal tersebut.
///
/// Swap [LeaveService.instance] for a real HTTP-backed implementation once
/// the Node.js backend is available.
abstract class LeaveService {
  static LeaveService instance = MockLeaveService();

  Future<List<LeaveRequest>> getMyLeaveRequests(String nip);

  Future<LeaveRequest> submit({
    required String nip,
    required LeaveType type,
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
    // Full local filesystem path of the picked attachment (e.g. from
    // file_picker's PlatformFile.path), NOT just the display filename.
    // HttpLeaveService needs the real path to open the file for upload.
    String? attachmentPath,
  });

  Future<bool> isOnApprovedLeave(String nip, DateTime date);
}

class MockLeaveService implements LeaveService {
  final Map<String, List<LeaveRequest>> _byNip = {};
  int _idCounter = 1;

  @override
  Future<List<LeaveRequest>> getMyLeaveRequests(String nip) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final list = List<LeaveRequest>.from(_byNip[nip] ?? []);
    list.sort((a, b) => b.submittedAt.compareTo(a.submittedAt));
    return list;
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
    await Future.delayed(const Duration(milliseconds: 400));

    final request = LeaveRequest(
      id: 'LV-${_idCounter++}',
      type: type,
      startDate: startDate,
      endDate: endDate,
      reason: reason,
      attachmentFileName: attachmentPath,
      submittedAt: DateTime.now(),
      status: LeaveStatus.menunggu,
    );

    _byNip.putIfAbsent(nip, () => []).add(request);
    return request;
  }

  @override
  Future<bool> isOnApprovedLeave(String nip, DateTime date) async {
    final list = _byNip[nip] ?? [];
    final target = DateTime(date.year, date.month, date.day);
    return list.any((r) {
      if (r.status != LeaveStatus.disetujui) return false;
      final start = DateTime(r.startDate.year, r.startDate.month, r.startDate.day);
      final end = DateTime(r.endDate.year, r.endDate.month, r.endDate.day);
      return !target.isBefore(start) && !target.isAfter(end);
    });
  }
}
