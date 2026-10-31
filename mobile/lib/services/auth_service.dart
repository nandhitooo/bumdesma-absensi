import '../models/user.dart';

class AuthException implements Exception {
  final String message;
  AuthException(this.message);
}

/// Handles login with NIP + temporary/permanent password, and the
/// mandatory password-change flow described in Flow Pegawai (Gambar 3.11):
/// "Jika pegawai baru pertama kali login, sistem akan mewajibkan
/// penggantian password sementara menjadi password baru."
///
/// Also handles the "Lupa Password" flow for a pegawai who is not logged
/// in at all: [forgotPassword] sends a 6-digit OTP to the account's
/// recovery email, and [resetPassword] verifies that OTP and sets a new
/// password.
///
/// Swap [AuthService.instance] for a real HTTP-backed implementation
/// once the Node.js backend is available.
abstract class AuthService {
  static AuthService instance = MockAuthService();

  Future<AppUser> login({required String nip, required String password});

  /// [oldPassword] wajib diisi — backend memverifikasinya sebelum
  /// mengizinkan penggantian password. [email] wajib diisi kalau akun
  /// pegawai ini belum punya email pemulihan tercatat sama sekali.
  Future<void> changePassword({
    required String nip,
    required String oldPassword,
    required String newPassword,
    String? email,
  });

  /// Melengkapi/memperbarui email pemulihan TANPA mengganti password.
  /// Dipakai oleh layar "Lengkapi Email" untuk pegawai lama yang sudah
  /// tidak lagi melewati layar ganti password tapi belum punya email.
  Future<void> updateEmail({required String nip, required String email});

  /// Langkah 1 dari alur "Lupa Password" (dipanggil dari LoginScreen,
  /// sebelum ada sesi login sama sekali). Mengirim kode OTP ke email
  /// pemulihan yang tercatat untuk [nip]. Selalu "berhasil" walau NIP
  /// tidak ditemukan atau belum punya email — backend sengaja tidak
  /// membocorkan status akun demi keamanan.
  Future<void> forgotPassword(String nip);

  /// Langkah 2: memverifikasi [otp] yang dikirim ke email, lalu mengganti
  /// password akun [nip] menjadi [newPassword].
  Future<void> resetPassword({
    required String nip,
    required String otp,
    required String newPassword,
  });

  Future<void> logout();
}

class MockAuthService implements AuthService {
  // NIP -> (password, mustChangePassword)
  final Map<String, _Credential> _db = {
    '3124510004': _Credential(password: 'temp1234', mustChange: true),
    '3124510099': _Credential(password: 'sudahaman1', mustChange: false),
  };

  final Map<String, AppUser> _profiles = {
    '3124510004': const AppUser(
      nip: '3124510004',
      nama: 'Fernandhito Dian Pratama',
      jabatan: 'Staff IT',
      departemen: 'Operasional',
    ),
    '3124510099': const AppUser(
      nip: '3124510099',
      nama: 'Siti Aminah',
      jabatan: 'Teller',
      departemen: 'Keuangan',
      email: 'siti.aminah@example.com',
    ),
  };

  // NIP -> OTP yang sedang aktif (mock, tanpa hashing/expiry sungguhan).
  final Map<String, String> _otpByNip = {};

  @override
  Future<AppUser> login({
    required String nip,
    required String password,
  }) async {
    await Future.delayed(const Duration(milliseconds: 400));

    final cred = _db[nip];
    final profile = _profiles[nip];
    if (cred == null || profile == null || cred.password != password) {
      throw AuthException('NIP atau password salah.');
    }

    final hasEmail = profile.email != null && profile.email!.isNotEmpty;
    return profile.copyWith(
      mustChangePassword: cred.mustChange,
      mustAddEmail: !hasEmail && !cred.mustChange,
    );
  }

  @override
  Future<void> changePassword({
    required String nip,
    required String oldPassword,
    required String newPassword,
    String? email,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));
    final cred = _db[nip];
    if (cred == null) throw AuthException('User tidak ditemukan.');
    _db[nip] = _Credential(password: newPassword, mustChange: false);

    final profile = _profiles[nip];
    if (profile != null) {
      final nextEmail =
          (email != null && email.isNotEmpty) ? email : profile.email;
      if (nextEmail == null || nextEmail.isEmpty) {
        throw AuthException(
            'Email wajib diisi untuk keperluan pemulihan password.');
      }
      _profiles[nip] = profile.copyWith(email: nextEmail);
    }
  }

  @override
  Future<void> updateEmail({required String nip, required String email}) async {
    await Future.delayed(const Duration(milliseconds: 250));
    final profile = _profiles[nip];
    if (profile == null) throw AuthException('User tidak ditemukan.');
    _profiles[nip] = profile.copyWith(email: email);
  }

  @override
  Future<void> forgotPassword(String nip) async {
    await Future.delayed(const Duration(milliseconds: 400));
    final profile = _profiles[nip];
    // Meniru perilaku backend asli: tetap "berhasil" walau NIP tidak
    // ditemukan atau belum punya email, supaya endpoint ini tidak bisa
    // dipakai mengecek NIP mana yang terdaftar.
    if (profile == null || profile.email == null || profile.email!.isEmpty) {
      return;
    }
    // OTP tetap untuk kebutuhan mock/testing tanpa email sungguhan.
    _otpByNip[nip] = '123456';
  }

  @override
  Future<void> resetPassword({
    required String nip,
    required String otp,
    required String newPassword,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));
    final expectedOtp = _otpByNip[nip];
    if (expectedOtp == null || expectedOtp != otp) {
      throw AuthException('Kode OTP tidak valid atau sudah kedaluwarsa.');
    }
    final cred = _db[nip];
    if (cred == null) throw AuthException('User tidak ditemukan.');
    _db[nip] = _Credential(password: newPassword, mustChange: false);
    _otpByNip.remove(nip);
  }

  @override
  Future<void> logout() async {
    await Future.delayed(const Duration(milliseconds: 100));
  }
}

class _Credential {
  final String password;
  final bool mustChange;
  _Credential({required this.password, required this.mustChange});
}
