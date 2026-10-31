// Menghitung jarak antar dua koordinat GPS menggunakan Haversine formula.
// Dipakai untuk validasi Layer 3 (Geofencing) pada proses absensi:
// jika jarak pegawai terhadap titik kantor > radius yang dikonfigurasi, absensi ditolak.

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * @param {number} lat1 - latitude titik 1 (derajat)
 * @param {number} lon1 - longitude titik 1 (derajat)
 * @param {number} lat2 - latitude titik 2 (derajat)
 * @param {number} lon2 - longitude titik 2 (derajat)
 * @returns {number} jarak dalam meter
 */
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Memeriksa apakah koordinat pegawai berada di dalam radius aman kantor.
 * @returns {{ distance: number, isWithinRadius: boolean }}
 */
function checkGeofence(userLat, userLon, officeLat, officeLon, radiusMeters) {
  const distance = haversineDistanceMeters(userLat, userLon, officeLat, officeLon);
  return {
    distance: Math.round(distance * 100) / 100,
    isWithinRadius: distance <= radiusMeters,
  };
}

module.exports = { haversineDistanceMeters, checkGeofence };
