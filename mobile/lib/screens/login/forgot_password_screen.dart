import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../../widgets/gradient_app_header.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _nipController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmController = TextEditingController();

  int _step = 1; // 1 = masukkan NIP, 2 = masukkan OTP + password baru
  bool _loading = false;
  bool _obscure = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _nipController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _requestOtp() async {
    final nip = _nipController.text.trim();
    if (nip.isEmpty) {
      _showError('NIP wajib diisi.');
      return;
    }

    setState(() => _loading = true);
    try {
      await AuthService.instance.forgotPassword(nip);
      if (!mounted) return;
      setState(() {
        _step = 2;
        _loading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Jika NIP terdaftar dan memiliki email pemulihan, kode OTP telah dikirim.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _showError(_friendlyError(e));
    }
  }

  Future<void> _resetPassword() async {
    if (_otpController.text.trim().isEmpty) {
      _showError('Kode OTP wajib diisi.');
      return;
    }
    if (_newPasswordController.text.length < 8) {
      _showError('Password baru minimal 8 karakter.');
      return;
    }
    if (_newPasswordController.text != _confirmController.text) {
      _showError('Konfirmasi password tidak cocok.');
      return;
    }

    setState(() => _loading = true);
    try {
      await AuthService.instance.resetPassword(
        nip: _nipController.text.trim(),
        otp: _otpController.text.trim(),
        newPassword: _newPasswordController.text,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Password berhasil direset. Silakan login dengan password baru Anda.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _showError(_friendlyError(e));
    }
  }

  String _friendlyError(Object e) {
    if (e is AuthException) return e.message;
    return 'Terjadi kesalahan. Silakan coba lagi.';
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientAppHeader(
            title: 'Lupa Kata Sandi',
            subtitle: 'Pemulihan akun dan reset password pegawai',
            leading: HeaderIconButton(
              icon: Icons.arrow_back_rounded,
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                  border: Border.all(color: AppColors.cardBorder, width: 1.1),
                  boxShadow: AppShadows.soft,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Step Indicator Pill
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primarySoft,
                            borderRadius: BorderRadius.circular(AppRadius.round),
                          ),
                          child: Text(
                            'Langkah $_step dari 2',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      _step == 1 ? 'Masukkan Nomor Induk Pegawai' : 'Verifikasi OTP & Buat Sandi',
                      style: const TextStyle(
                        fontSize: 16.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _step == 1
                          ? 'Kode OTP 6 digit akan dikirimkan ke email pemulihan yang ditautkan pada NIP Anda.'
                          : 'Periksa kotak masuk email Anda dan masukkan kode OTP untuk mengatur kata sandi baru.',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 22),
                    if (_step == 1) ..._buildStepOne() else ..._buildStepTwo(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildStepOne() {
    return [
      TextField(
        controller: _nipController,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(
          labelText: 'Nomor Induk Pegawai (NIP)',
          hintText: 'Contoh: 19850101...',
          prefixIcon: Icon(Icons.badge_outlined, color: AppColors.primary),
        ),
        onSubmitted: (_) => _requestOtp(),
      ),
      const SizedBox(height: 24),
      ElevatedButton(
        onPressed: _loading ? null : _requestOtp,
        child: _loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
              )
            : const Text('Kirim Kode OTP Pemulihan'),
      ),
    ];
  }

  List<Widget> _buildStepTwo() {
    return [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Row(
          children: [
            const Icon(Icons.badge_outlined, size: 18, color: AppColors.primary),
            const SizedBox(width: 8),
            Text(
              'NIP: ${_nipController.text.trim()}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      TextField(
        controller: _otpController,
        keyboardType: TextInputType.number,
        maxLength: 6,
        decoration: const InputDecoration(
          labelText: 'Kode OTP (6 Digit)',
          hintText: '123456',
          prefixIcon: Icon(Icons.pin_outlined, color: AppColors.primary),
          counterText: '',
        ),
      ),
      const SizedBox(height: 14),
      TextField(
        controller: _newPasswordController,
        obscureText: _obscure,
        decoration: InputDecoration(
          labelText: 'Kata Sandi Baru (Min. 8 Karakter)',
          prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.primary),
          suffixIcon: IconButton(
            icon: Icon(
              _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              color: AppColors.textSecondary,
            ),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        ),
      ),
      const SizedBox(height: 14),
      TextField(
        controller: _confirmController,
        obscureText: _obscureConfirm,
        decoration: InputDecoration(
          labelText: 'Konfirmasi Kata Sandi Baru',
          prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.primary),
          suffixIcon: IconButton(
            icon: Icon(
              _obscureConfirm ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              color: AppColors.textSecondary,
            ),
            onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
          ),
        ),
        onSubmitted: (_) => _resetPassword(),
      ),
      const SizedBox(height: 24),
      ElevatedButton(
        onPressed: _loading ? null : _resetPassword,
        child: _loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
              )
            : const Text('Simpan Kata Sandi Baru'),
      ),
      const SizedBox(height: 12),
      Center(
        child: TextButton(
          onPressed: _loading ? null : () => setState(() => _step = 1),
          child: const Text('Ganti NIP / Kirim Ulang OTP'),
        ),
      ),
    ];
  }
}
