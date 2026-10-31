import 'package:flutter/material.dart';

import '../services/notification_service.dart';

/// Drives the red dot on the Dashboard's notification bell. Refreshed on
/// Dashboard load/pull-to-refresh, and whenever the notification panel is
/// opened/closed (which marks everything read on the backend).
class NotificationProvider extends ChangeNotifier {
  int _unreadCount = 0;
  bool _loading = false;

  int get unreadCount => _unreadCount;
  bool get hasUnread => _unreadCount > 0;
  bool get loading => _loading;

  Future<void> refresh(String nip) async {
    if (nip.isEmpty) return;
    _loading = true;
    notifyListeners();
    try {
      _unreadCount = await NotificationService.instance.unreadCount(nip);
    } catch (_) {
      // Keep the last known count on a transient network failure rather
      // than flashing the dot away.
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Optimistically clears the dot the moment the bell is tapped (the
  /// notification panel marks everything read as soon as it opens), then
  /// call [refresh] afterwards to reconcile with the server.
  void clear() {
    _unreadCount = 0;
    notifyListeners();
  }
}
