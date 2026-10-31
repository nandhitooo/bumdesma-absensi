import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../state/auth_provider.dart';
import '../../shell/main_shell.dart';
import '../../widgets/gradient_app_header.dart';

class ChangePasswordScreen extends StatefulWidget {
  final bool isVoluntary; // true when opened from Profile, not forced
  final String? temporaryPassword;

  const ChangePasswordScreen({
    super.key,
    this.isVoluntary = false,
    this.temporaryPassword,
  });

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmController = TextEditingController();
  late final TextEditingController _emailController;
  bool _obscureOld = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  static final _emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  @override
  void initState() {
    super.initState();
    final currentEmail = context.read<AuthProvider>().user?.email;
    _emailController = TextEditingController(text: currentEmail ?? '');
  }

  @override
  void dispose() {
    _oldPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  bool get _emailRequired {
    if (!widget.isVoluntary) return true;
    return context.read<AuthProvider>().mustAddEmail;
  }

  Future<void> _submit() async {
    final newPass = _newPasswordController.text;
    final confirm = _confirmController.text;
    final email = _emailController.text.trim();

    if (newPass.length < 8) {
      _showError('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPass != confirm) {
      _showError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (_emailRequired && email.isEmpty) {
      _showError('Email pemulihan wajib diisi.');
      return;
    }
    if (email.isNotEmpty && !_emailRegex.hasMatch(email)) {
      _showError('Format email tidak valid.');
      return;
    }

    final oldPassword = widget.isVoluntary
        ? _oldPasswordController.text
        : (widget.temporaryPassword ?? '');
    if (oldPassword.isEmpty) {
      _showError('Kata sandi saat ini wajib diisi.');
      return;
    }

    final auth = context.read<AuthProvider>();
    final ok = await auth.changePassword(
      oldPassword: oldPassword,
      newPassword: newPass,
      email: email.isEmpty ? null : email,
    );
    if (!mounted) return;

    if (ok) {
      if (widget.isVoluntary) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Kata sandi berhasil diperbarui.')),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const MainShell()),
        );
      }
    } else if (auth.error != null) {
      _showError(auth.error!);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final emailRequired = _emailRequired;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientAppHeader(
            title: widget.isVoluntary ? 'Ubah Kata Sandi' : 'Aktivasi Sandi Baru',
            subtitle: widget.isVoluntary
                ? 'Perbarui kata sandi akun presensi Anda'
                : 'Langkah pengamanan akun pada login pertama',
            leading: widget.isVoluntary
                ? HeaderIconButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => Navigator.of(context).maybePop(),
                  )
                : null,
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
                    if (!widget.isVoluntary) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.shield_rounded, color: AppColors.accent, size: 20),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Ini adalah login pertama Anda. Silakan ganti password sementara demi keamanan akun.',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: AppColors.primary,
                                  height: 1.35,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                    ],
                    if (widget.isVoluntary) ...[
                      TextField(
                        controller: _oldPasswordController,
                        obscureText: _obscureOld,
                        decoration: InputDecoration(
                          labelText: 'Kata Sandi Saat Ini',
                          prefixIcon: const Icon(Icons.lock_person_outlined, color: AppColors.primary),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscureOld ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                              color: AppColors.textSecondary,
                            ),
                            onPressed: () => setState(() => _obscureOld = !_obscureOld),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],
                    TextField(
                      controller: _newPasswordController,
                      obscureText: _obscureNew,
                      decoration: InputDecoration(
                        labelText: 'Kata Sandi Baru (Min. 8 Karakter)',
                        prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.primary),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscureNew ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            color: AppColors.textSecondary,
                          ),
                          onPressed: () => setState(() => _obscureNew = !_obscureNew),
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
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: emailRequired ? 'Email Pemulihan *' : 'Email Pemulihan',
                        hintText: 'nama@email.com',
                        prefixIcon: const Icon(Icons.email_outlined, color: AppColors.primary),
                        helperText: 'Digunakan untuk verifikasi OTP saat lupa password.',
                        helperMaxLines: 2,
                      ),
                      onSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: auth.loading ? null : _submit,
                      child: auth.loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Simpan Perubahan'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
