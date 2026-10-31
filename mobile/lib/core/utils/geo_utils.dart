import 'dart:math';

/// Geofencing helper: computes great-circle distance between two
/// coordinates using the Haversine formula.
///
/// Per Sub Bab 3.2.7 (Logika Validasi Geofencing): if the distance between
/// the employee's GPS position and the office coordinate exceeds the
/// configured radius (default 50 meters), the scan must be rejected even
/// if the QR token itself is valid.
class GeoUtils {
  GeoUtils._();

  static const double _earthRadiusMeters = 6371000;

  static double distanceInMeters({
    required double lat1,
    required double lon1,
    required double lat2,
    required double lon2,
  }) {
    final dLat = _degToRad(lat2 - lat1);
    final dLon = _degToRad(lon2 - lon1);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_degToRad(lat1)) *
            cos(_degToRad(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return _earthRadiusMeters * c;
  }

  static bool isWithinRadius({
    required double lat1,
    required double lon1,
    required double lat2,
    required double lon2,
    required double radiusMeters,
  }) {
    return distanceInMeters(lat1: lat1, lon1: lon1, lat2: lat2, lon2: lon2) <=
        radiusMeters;
  }

  static double _degToRad(double deg) => deg * (pi / 180);
}
