enum LeaveStatus { menunggu, disetujui, ditolak }

enum LeaveType { izin, cuti, sakit }

class LeaveRequest {
  final String id;
  final LeaveType type;
  final DateTime startDate;
  final DateTime endDate;
  final String reason;
  final String? attachmentFileName;
  final LeaveStatus status;
  final DateTime submittedAt;

  const LeaveRequest({
    required this.id,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.submittedAt,
    this.attachmentFileName,
    this.status = LeaveStatus.menunggu,
  });

  LeaveRequest copyWith({LeaveStatus? status}) {
    return LeaveRequest(
      id: id,
      type: type,
      startDate: startDate,
      endDate: endDate,
      reason: reason,
      submittedAt: submittedAt,
      attachmentFileName: attachmentFileName,
      status: status ?? this.status,
    );
  }
}
