import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
// DevicePreview hanya di-wrap saat debug (release build tidak membungkus
// app dengan overlay preview sama sekali).
import 'package:device_preview/device_preview.dart' if (dart.library.io) 'package:device_preview/device_preview.dart';
import 'core/env/env.dart';
import 'services/fcm_push_service.dart';
import 'core/theme/app_theme.dart';
import 'screens/login/login_screen.dart';
import 'services/attendance_service.dart';
import 'services/auth_service.dart';
import 'services/http_attendance_service.dart';
import 'services/http_auth_service.dart';
import 'services/http_leave_service.dart';
import 'services/http_notification_service.dart';
import 'services/http_settings_service.dart';
import 'services/leave_service.dart';
import 'services/notification_service.dart';
import 'services/settings_service.dart';
import 'state/attendance_provider.dart';
import 'state/auth_provider.dart';
import 'state/notification_provider.dart';
import 'state/settings_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Env.load();
  await initializeDateFormatting('id_ID', null);

  // Wajib didaftarkan SEBELUM runApp supaya pesan FCM data-only yang
  // datang saat app di background/terminated tetap tampil di notif bar.
  // Notifikasi "notification payload" dari backend sudah otomatis
  // ditampilkan OS; ini jaring pengaman untuk data-only message.
  if (Env.pushNotificationsEnabled) {
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }

  AuthService.instance = HttpAuthService();
  AttendanceService.instance = HttpAttendanceService();
  LeaveService.instance = HttpLeaveService();
  SettingsService.instance = HttpSettingsService();
  NotificationService.instance = HttpNotificationService();

  // DevicePreview hanya aktif di debug build (flutter run tanpa --release).
  // Production build membungkus app langsung tanpa overlay preview.
  if (kDebugMode) {
    runApp(
      DevicePreview(
        enabled: true,
        builder: (context) => const AbsensiBumdesmaApp(),
      ),
    );
  } else {
    runApp(const AbsensiBumdesmaApp());
  }
}

class AbsensiBumdesmaApp extends StatelessWidget {
  const AbsensiBumdesmaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
      ],
      child: MaterialApp(
        title: 'BUMDESMA',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        // DevicePreview hanya aktif di debug; di release locale/builder
        // standar dipakai apa adanya.
        locale: kDebugMode ? DevicePreview.locale(context) : null,
        builder: kDebugMode ? DevicePreview.appBuilder : null,
        home: const LoginScreen(),
      ),
    );
  }
}
