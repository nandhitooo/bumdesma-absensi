import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT pair issued by POST /api/auth/login so the app stays
/// logged in across restarts and [ApiClient] can attach the access token
/// to every authenticated request.
///
/// Token disimpan di flutter_secure_storage (terenkripsi via Keychain di
/// iOS / Keystore+AES-GCM di Android), bukan shared_preferences yang
/// plaintext. Android default sudah enkripsi kuat (RSA-OAEP key wrapping +
/// AES-GCM); iOS pakai accessibility `unlocked` supaya token hanya bisa
/// dibaca saat perangkat terbuka dan tidak ikut backup cloud mentah.
class SessionStore {
  SessionStore._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.unlocked),
  );

  static const _kAccessToken = 'auth.accessToken';
  static const _kRefreshToken = 'auth.refreshToken';
  static const _kNip = 'auth.nip';

  static Future<void> save({
    required String accessToken,
    required String refreshToken,
    required String nip,
  }) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
    await _storage.write(key: _kRefreshToken, value: refreshToken);
    await _storage.write(key: _kNip, value: nip);
  }

  static Future<void> saveAccessToken(String accessToken) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
  }

  static Future<String?> getAccessToken() async {
    return _storage.read(key: _kAccessToken);
  }

  static Future<String?> getRefreshToken() async {
    return _storage.read(key: _kRefreshToken);
  }

  static Future<String?> getNip() async {
    return _storage.read(key: _kNip);
  }

  static Future<void> clear() async {
    await _storage.delete(key: _kAccessToken);
    await _storage.delete(key: _kRefreshToken);
    await _storage.delete(key: _kNip);
  }
}
