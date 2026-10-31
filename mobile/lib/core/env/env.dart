import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Thin typed wrapper around the `.env` file loaded via flutter_dotenv.
///
/// NOTE on Google Maps keys: the Maps SDK for Android/iOS reads its API key
/// natively (AndroidManifest.xml meta-data / Info.plist), not from Dart at
/// runtime — that wiring is done at build time from the same `.env` values
/// (see android/app/build.gradle and ios/Flutter/Env.xcconfig). The getters
/// below exist so Dart code can still check "is a Maps key configured?"
/// without hardcoding secrets in source.
class Env {
  Env._();

  static Future<void> load() => dotenv.load(fileName: '.env');

  static String get mapsApiAndroid => dotenv.env['MAPS_API_ANDROID'] ?? '';
  static String get mapsApiIos => dotenv.env['MAPS_API_IOS'] ?? '';

  static String get apiBaseUrl =>
      dotenv.env['API_BASE_URL'] ?? 'https://api.absensi-bumdesma.example.com';

  static double get officeLatitude =>
      double.tryParse(dotenv.env['OFFICE_LATITUDE'] ?? '') ?? -7.5188;

  static double get officeLongitude =>
      double.tryParse(dotenv.env['OFFICE_LONGITUDE'] ?? '') ?? 111.8965;

  static double get officeRadiusMeters =>
      double.tryParse(dotenv.env['OFFICE_RADIUS_METERS'] ?? '') ?? 50;

  /// "true" -> FCM push diaktifkan, service dipanggil dari main.dart.
  /// Kalau false/kosong, app jalan seperti biasa tanpa notif bar.
  static bool get pushNotificationsEnabled =>
      (dotenv.env['PUSH_NOTIFICATIONS_ENABLED'] ?? '').toLowerCase() == 'true';
}
