import '../core/network/api_client.dart';
import '../models/notification_item.dart';
import 'notification_service.dart';

/// Real implementation of [NotificationService], wired to backend's
/// /api/notifications routes (notification.controller.js).
///
/// This class did not exist before: `NotificationService.instance` was
/// still pointing at [MockNotificationService] with hardcoded sample data,
/// even though Auth/Attendance/Leave/Settings had all been swapped to real
/// HTTP services in main.dart. That's why real piket-assignment and
/// izin/cuti-decision notifications sent by Admin/Pimpinan never showed up
/// (or updated the bell badge) on the employee's phone.
class HttpNotificationService implements NotificationService {
  final ApiClient _api = ApiClient.instance;

  @override
  Future<List<AppNotification>> getNotifications(String nip) async {
    final res = await _api.get('/notifications');
    final rows = (res['data'] as List).cast<Map<String, dynamic>>();
    return rows.map(_fromJson).toList();
  }

  @override
  Future<int> unreadCount(String nip) async {
    final res = await _api.get('/notifications/unread-count');
    final data = res['data'] as Map<String, dynamic>;
    return (data['count'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<void> markAllRead(String nip) async {
    await _api.post('/notifications/read-all');
  }

  AppNotification _fromJson(Map<String, dynamic> row) {
    final type = (row['type'] as String?) == 'piket'
        ? NotificationType.piket
        : NotificationType.izinCuti;

    return AppNotification(
      id: row['id'] as String,
      type: type,
      title: row['title'] as String,
      description: row['message'] as String,
      createdAt: DateTime.parse(row['created_at'] as String).toLocal(),
      read: row['is_read'] as bool? ?? false,
    );
  }
}
