import '../core/network/api_client.dart';
import '../core/network/session_store.dart';
import '../models/user.dart';
import 'auth_service.dart';

/// Real implementation of [AuthService], wired to backend's
/// /api/auth routes. NIP is used as the login username (see auth.routes.js
/// and auth.controller.js#login on the backend).
class HttpAuthService implements AuthService {
  final ApiClient _api = ApiClient.instance;

  @override
  Future<AppUser> login({required String nip, required String password}) async {
    try {
      final res = await _api.post('/auth/login', body: {
        'nip': nip,
        'password': password,
      });
      final data = res['data'] as Map<String, dynamic>;
      final user = data['user'] as Map<String, dynamic>;

      await SessionStore.save(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
        nip: user['nip'] as String,
      );

      final email = user['email'] as String?;
      return AppUser(
        nip: user['nip'] as String,
        nama: user['name'] as String,
        jabatan: user['jabatan'] as String? ?? '-',
        departemen: user['departemen'] as String? ?? '-',
        email: email,
        mustChangePassword: data['mustChangePassword'] as bool? ?? false,
        mustAddEmail:
            data['mustAddEmail'] as bool? ?? (email == null || email.isEmpty),
      );
    } on ApiException catch (e) {
      throw AuthException(e.message);
    }
  }

  @override
  Future<void> changePassword({
    required String nip,
    required String oldPassword,
    required String newPassword,
    String? email,
  }) async {
    try {
      // NB: oldPassword used to be missing here entirely, so the backend
      // (which requires it to verify the account) always rejected this
      // call with "Password lama tidak sesuai" — the whole first-login /
      // voluntary password-change flow was silently broken end-to-end.
      await _api.post('/auth/change-password', body: {
        'oldPassword': oldPassword,
        'newPassword': newPassword,
        if (email != null && email.isNotEmpty) 'email': email,
      });
    } on ApiException catch (e) {
      throw AuthException(e.message);
    }
  }

  @override
  Future<void> updateEmail({required String nip, required String email}) async {
    try {
      await _api.post('/auth/email', body: {'email': email});
    } on ApiException catch (e) {
      throw AuthException(e.message);
    }
  }

  @override
  Future<void> forgotPassword(String nip) async {
    try {
      // Endpoint ini tidak butuh sesi login (belum ada Authorization
      // token sama sekali di titik ini) - lihat auth.routes.js, rute ini
      // sengaja tidak dipasangi middleware authenticate.
      await _api.post('/auth/forgot-password', body: {'nip': nip});
    } on ApiException catch (e) {
      throw AuthException(e.message);
    }
  }

  @override
  Future<void> resetPassword({
    required String nip,
    required String otp,
    required String newPassword,
  }) async {
    try {
      await _api.post('/auth/reset-password', body: {
        'nip': nip,
        'otp': otp,
        'newPassword': newPassword,
      });
    } on ApiException catch (e) {
      throw AuthException(e.message);
    }
  }

  @override
  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } on ApiException catch (_) {
      // Ignore backend errors on logout — always clear the local session.
    } finally {
      await SessionStore.clear();
    }
  }
}
