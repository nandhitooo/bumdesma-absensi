import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../core/env/env.dart';
import '../core/network/api_client.dart';

/// Handler untuk data-message FCM saat app di background/terminated.
/// HARUS top-level function + @pragma('vm:entry-point') agar tidak
/// di-tree-shake oleh release build (syarat firebase_messaging).
///
/// Pesan bertipe "notification" dari backend sudah otomatis ditampilkan
/// Android/iOS ke notif bar tanpa kode apa pun; handler ini hanya
/// jaring pengaman kalau backend mengirim data-only message.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  try {
    await FcmPushService.instance.showRemoteMessage(message);
  } catch (_) {
    // Jangan pernah crash isolate background hanya karena notif gagal.
  }
}

/// Push notification FCM end-to-end:
///
/// 1. [start] dipanggil begitu pegawai berhasil login (AuthProvider.login),
///    meminta izin notifikasi (Android 13+/iOS), membuat 2 channel Android
///    ("piket" & "izin_cuti"), lalu mendaftarkan FCM token ke backend via
///    POST /api/push/register ({ nip, token }) agar Admin/Pimpinan yang
///    approve/reject izin memicu notif bar di HP pegawai ybs.
/// 2. Saat app di foreground, pesan FCM TIDAK otomatis tampil —
///    [showRemoteMessage] menampilkannya lewat flutter_local_notifications
///    dengan channel yang sama persis.
/// 3. [stop] dipanggil saat logout supaya token tidak lagi terikat ke NIP.
class FcmPushService {
  FcmPushService._();
  static final FcmPushService instance = FcmPushService._();

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<String>? _tokenSub;
  String? _nip;
  bool _started = false;

  static const String _channelPiket = 'piket';
  static const String _channelIzinCuti = 'izin_cuti';

  bool get started => _started;

  String _channelIdFor(String? type) =>
      type == _channelPiket ? _channelPiket : _channelIzinCuti;

  Future<void> start({required String nip}) async {
    if (!Env.pushNotificationsEnabled || nip.isEmpty) return;
    if (_started && _nip == nip) return;
    if (_started) await stop();

    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }

      // Izin notifikasi: Android 13+ memunculkan dialog sistem di sini,
      // iOS juga. Tanpa ini notif bar tidak pernah menampilkan apa pun.
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      await _createAndroidChannels();
      await _initLocalNotifications();

      _nip = nip;
      _started = true;

      _foregroundSub = FirebaseMessaging.onMessage.listen((message) {
        // Foreground: sistem TIDAK menampilkan apa pun otomatis,
        // jadi tampilkan sendiri ke notif bar.
        showRemoteMessage(message);
      });

      _tokenSub = FirebaseMessaging.instance.onTokenRefresh.listen((token) {
        // Token FCM bisa di-rotate oleh Google kapan saja; daftarkan ulang
        // supaya push tetap nyampe ke perangkat yang benar.
        _registerToken(token);
      });

      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _registerToken(token);
      }
    } catch (e) {
      debugPrint('FcmPushService.start gagal: $e');
    }
  }

  Future<void> stop() async {
    _foregroundSub?.cancel();
    _foregroundSub = null;
    _tokenSub?.cancel();
    _tokenSub = null;

    final nip = _nip;
    _nip = null;
    _started = false;

    if (nip == null || nip.isEmpty) return;
    try {
      if (Firebase.apps.isNotEmpty) {
        final token = await FirebaseMessaging.instance.getToken();
        if (token != null) {
          // Pakai ApiClient agar ikut membawa Authorization Bearer —
          // endpoint backend diproteksi middleware authenticate.
          await ApiClient.instance.post('/push/unregister', body: {
            'nip': nip,
            'token': token,
          });
        }
      }
    } catch (_) {
      // Logout tidak boleh gagal hanya karena jaringan mati.
    }
  }

  /// Menampilkan pesan FCM ke notif bar (dipakai saat app foreground).
  Future<void> showRemoteMessage(RemoteMessage message) async {
    final type = message.data['type'] as String?;
    final title = message.notification?.title ??
        (message.data['title'] as String?) ??
        'Notifikasi BUMDESMA';
    final body = message.notification?.body ??
        (message.data['body'] as String?) ??
        '';

    final channelId = _channelIdFor(type);
    // ID notifikasi unik per pesan; pakai hash supaya notif berurutan
    // tidak saling menimpa, tapi push ulang untuk pesan sama menimpa.
    final id = (message.messageId ?? title).hashCode & 0x7fffffff;

    await _localNotifications.show(
      id: id,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelId == _channelPiket ? 'Jadwal Piket' : 'Status Izin & Cuti',
          channelDescription: channelId == _channelPiket
              ? 'Pemberitahuan penugasan jadwal piket'
              : 'Pemberitahuan keputusan pengajuan izin & cuti',
          importance: Importance.max,
          priority: Priority.high,
          showWhen: true,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data['notification_id'] as String?,
    );
  }

  Future<void> _createAndroidChannels() async {
    if (!Platform.isAndroid) return;
    final plugin = _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (plugin == null) return;

    // Nama channel "piket" & "izin_cuti" harus sama dengan yang dipakai
    // backend saat mengirim FCM (key android_channel_id).
    await plugin.createNotificationChannel(const AndroidNotificationChannel(
      _channelPiket,
      'Jadwal Piket',
      description: 'Pemberitahuan penugasan jadwal piket',
      importance: Importance.max,
    ));
    await plugin.createNotificationChannel(const AndroidNotificationChannel(
      _channelIzinCuti,
      'Status Izin & Cuti',
      description: 'Pemberitahuan keputusan pengajuan izin & cuti',
      importance: Importance.max,
    ));
  }

  Future<void> _initLocalNotifications() async {
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
  }

  Future<void> _registerToken(String token) async {
    final nip = _nip;
    if (nip == null || nip.isEmpty) return;
    try {
      // Pakai ApiClient agar ikut membawa Authorization Bearer — endpoint
      // /api/push/* backend diproteksi middleware authenticate. Base URL
      // otomatis dari API_BASE_URL (sama dengan REST API utama).
      await ApiClient.instance.post('/push/register', body: {
        'nip': nip,
        'token': token,
        'platform': Platform.isAndroid ? 'android' : 'ios',
      });
    } catch (_) {
      // Registrasi ulang terjadi otomatis di next onTokenRefresh/login.
    }
  }
}
