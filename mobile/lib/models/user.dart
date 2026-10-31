class AppUser {
  final String nip;
  final String nama;
  final String jabatan;
  final String departemen;
  final String? email;
  final bool mustChangePassword;
  // True kalau akun pegawai ini belum punya email pemulihan tercatat di
  // sistem — dipakai untuk mengarahkan ke layar wajib isi email.
  final bool mustAddEmail;

  const AppUser({
    required this.nip,
    required this.nama,
    required this.jabatan,
    required this.departemen,
    this.email,
    this.mustChangePassword = false,
    this.mustAddEmail = false,
  });

  AppUser copyWith({
    String? email,
    bool? mustChangePassword,
    bool? mustAddEmail,
  }) {
    return AppUser(
      nip: nip,
      nama: nama,
      jabatan: jabatan,
      departemen: departemen,
      email: email ?? this.email,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      mustAddEmail: mustAddEmail ?? this.mustAddEmail,
    );
  }
}
