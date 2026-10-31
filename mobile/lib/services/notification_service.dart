import '../models/notification_item.dart';

/// Backs the notification bell panel on Dashboard (Gambar 3.24): shows
/// Saturday piket assignments pushed by Admin, and Izin/Cuti decision
/// notifications pushed automatically once Pimpinan approves/rejects.
///
/// Swap [NotificationService.instance] for a real push-notification /
/// HTTP-backed implementation once the Node.js backend is available.
abstract class NotificationService {
  static NotificationService instance = MockNotificationService();

  Future<List<AppNotification>> getNotifications(String nip);

  /// Jumlah notifikasi yang belum dibaca — dipakai untuk menampilkan titik
  /// merah pada ikon lonceng di Dashboard (lihat NotificationProvider).
  Future<int> unreadCount(String nip);

  Future<void> markAllRead(String nip);
}

class MockNotificationService implements NotificationService {
  final Map<String, List<AppNotification>> _byNip = {
    '3124510004': [
      AppNotification(
        id: 'n1',
        type: NotificationType.piket,
        title: 'Jadwal Piket Sabtu',
        description:
            'Anda ditugaskan piket pada hari Sabtu mendatang. Mohon hadir sesuai jadwal.',
        createdAt: DateTime.now().subtract(const Duration(hours: 5)),
      ),
      AppNotification(
        id: 'n2',
        type: NotificationType.izinCuti,
        title: 'Pengajuan Cuti Disetujui',
        description:
            'Pengajuan cuti Anda telah disetujui oleh Pimpinan.',
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
        read: true,
      ),
    ],
  };

  @override
  Future<List<AppNotification>> getNotifications(String nip) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final list = List<AppNotification>.from(_byNip[nip] ?? []);
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  @override
  Future<int> unreadCount(String nip) async {
    await Future.delayed(const Duration(milliseconds: 100));
    final list = _byNip[nip] ?? [];
    return list.where((n) => !n.read).length;
  }

  @override
  Future<void> markAllRead(String nip) async {
    final list = _byNip[nip];
    if (list == null) return;
    _byNip[nip] = list.map((n) => n.copyWith(read: true)).toList();
  }
}
