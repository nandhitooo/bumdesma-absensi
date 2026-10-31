import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../state/auth_provider.dart';
import '../../shell/main_shell.dart';
import '../../widgets/gradient_app_header.dart';

class AddEmailScreen extends StatefulWidget {
  const AddEmailScreen({super.key});

  @override
  State<AddEmailScreen> createState() => _AddEmailScreenState();
}

class _AddEmailScreenState extends State<AddEmailScreen> {
  late final TextEditingController _emailController;
  static final _emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  @override
  void initState() {
    super.initState();
    final currentEmail = context.read<AuthProvider>().user?.email;
    _emailController = TextEditingController(text: currentEmail ?? '');
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  bool get _isVoluntary => !(context.read<AuthProvider>().mustAddEmail);

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showError('Email wajib diisi untuk keperluan pemulihan password.');
      return;
    }
    if (!_emailRegex.hasMatch(email)) {
      _showError('Format email tidak valid.');
      return;
    }

    final auth = context.read<AuthProvider>();
    final wasVoluntary = _isVoluntary;
    final ok = await auth.updateEmail(email);
    if (!mounted) return;

    if (ok) {
      if (wasVoluntary) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Email pemulihan berhasil disimpan.')),
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
    final voluntary = _isVoluntary;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientAppHeader(
            title: voluntary ? 'Ubah Email Terdaftar' : 'Lengkapi Email Pemulihan',
            subtitle: voluntary
                ? 'Perbarui alamat email akun presensi Anda'
                : 'Tautkan email aktif untuk keperluan keamanan & reset sandi',
            leading: voluntary
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
                    if (!voluntary) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.warningSurface,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          border: Border.all(color: AppColors.warningBorder),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.mark_email_unread_rounded, color: AppColors.warning, size: 20),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Akun Anda belum memiliki email tercatat. Email ini wajib diisi untuk verifikasi kode OTP.',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: AppColors.textPrimary,
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
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Alamat Email Aktif',
                        hintText: 'nama@email.com',
                        prefixIcon: Icon(Icons.email_outlined, color: AppColors.primary),
                        helperText: 'Pastikan email ini aktif dan dapat menerima pesan masuk.',
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
                          : const Text('Simpan Email'),
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
