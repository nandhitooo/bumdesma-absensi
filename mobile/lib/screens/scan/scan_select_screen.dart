import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../models/attendance.dart';
import '../../models/work_schedule.dart';
import '../../services/settings_service.dart';
import '../../state/auth_provider.dart';
import '../../widgets/gradient_app_header.dart';
import '../../widgets/section_card.dart';
import 'scan_camera_screen.dart';

class ScanSelectScreen extends StatefulWidget {
  const ScanSelectScreen({super.key});

  @override
  State<ScanSelectScreen> createState() => _ScanSelectScreenState();
}

class _ScanSelectScreenState extends State<ScanSelectScreen> {
  bool _loading = true;
  bool _allowedToday = true;
  String _blockedReason = '';
  WorkSchedule? _schedule;

  @override
  void initState() {
    super.initState();
    _checkEligibility();
  }

  Future<void> _checkEligibility() async {
    final nip = context.read<AuthProvider>().user?.nip ?? '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    try {
      // Diambil bersamaan dengan pengecekan kelayakan supaya jam kerja &
      // radius yang ditampilkan di layar ini selalu mengikuti pengaturan
      // Admin di backend, bukan nilai statis.
      _schedule = await SettingsService.instance.getWorkSchedule();

      if (now.weekday == DateTime.sunday) {
        _allowedToday = false;
        _blockedReason =
            'Hari ini hari Minggu, bukan hari kerja. Absensi tidak tersedia.';
      } else {
        final holidays = await SettingsService.instance.getNationalHolidays();
        final isHoliday = holidays.any(
          (h) => DateTime(h.year, h.month, h.day) == today,
        );

        if (isHoliday) {
          _allowedToday = false;
          _blockedReason =
              'Hari ini merupakan hari libur nasional/cuti bersama. Absensi tidak tersedia.';
        } else if (now.weekday == DateTime.saturday) {
          final assigned =
              await SettingsService.instance.isAssignedSaturdayPiket(nip);
          _allowedToday = assigned;
          _blockedReason =
              'Hari ini Sabtu dan Anda tidak terdaftar pada jadwal piket, sehingga absensi tidak tersedia.';
        } else {
          _allowedToday = true;
        }
      }
    } catch (e) {
      _allowedToday = false;
      _blockedReason = 'Gagal memuat data. Periksa koneksi Anda dan coba lagi.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openCamera(ScanType type) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ScanCameraScreen(scanType: type)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientAppHeader(
            title: 'Scan QR Presensi',
            subtitle: 'Pilih jenis absensi yang ingin dilakukan hari ini',
            leading: HeaderIconButton(
              icon: Icons.arrow_back_rounded,
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary))
                : !_allowedToday
                    ? _buildNotScheduled()
                    : _buildOptions(),
          ),
        ],
      ),
    );
  }

  Widget _buildNotScheduled() {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Center(
        child: EmptyState(
          icon: Icons.weekend_rounded,
          title: 'Absensi Tidak Tersedia',
          message: _blockedReason,
        ),
      ),
    );
  }

  Widget _buildOptions() {
    final masukLabel = _schedule != null
        ? 'Jadwal ${_schedule!.jamMasukLabel} WIB'
        : 'Jadwal Masuk';
    final pulangLabel = _schedule != null
        ? 'Jadwal ${_schedule!.jamPulangLabel} WIB'
        : 'Jadwal Pulang';
    final radiusLabel =
        _schedule != null ? '${_schedule!.radiusMeters.round()}m' : '50m';

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      children: [
        _ScanOptionCard(
          label: 'Absen Masuk',
          description: 'Catat waktu kedatangan Anda saat tiba di kantor',
          badgeText: masukLabel,
          icon: Icons.login_rounded,
          gradient: AppColors.emeraldGradient,
          badgeColor: AppColors.success,
          onTap: () => _openCamera(ScanType.masuk),
        ),
        const SizedBox(height: 16),
        _ScanOptionCard(
          label: 'Absen Pulang',
          description: 'Catat waktu kepulangan setelah jam kerja selesai',
          badgeText: pulangLabel,
          icon: Icons.logout_rounded,
          gradient: AppColors.amberGradient,
          badgeColor: AppColors.warning,
          onTap: () => _openCamera(ScanType.pulang),
        ),
        const SizedBox(height: 24),
        // GPS & Guidance Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: AppColors.accent.withValues(alpha: 0.3)),
                ),
                child: const Icon(
                  Icons.my_location_rounded,
                  color: AppColors.accent,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Validasi Lokasi GPS Aktif',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Pastikan Anda berada di area kantor (radius < $radiusLabel) saat melakukan scanning QR Code.',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ScanOptionCard extends StatelessWidget {
  final String label;
  final String description;
  final String badgeText;
  final IconData icon;
  final List<Color> gradient;
  final Color badgeColor;
  final VoidCallback onTap;

  const _ScanOptionCard({
    required this.label,
    required this.description,
    required this.badgeText,
    required this.icon,
    required this.gradient,
    required this.badgeColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final primaryColor = gradient.first;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.xl),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.xl),
            border: Border.all(color: AppColors.cardBorder, width: 1.2),
            boxShadow: AppShadows.medium,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: gradient,
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: primaryColor.withValues(alpha: 0.35),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(icon, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              label,
                              style: const TextStyle(
                                fontSize: 16.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                                letterSpacing: -0.2,
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: badgeColor.withValues(alpha: 0.12),
                                borderRadius:
                                    BorderRadius.circular(AppRadius.round),
                              ),
                              child: Text(
                                badgeText,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: badgeColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          description,
                          style: AppTextStyles.caption.copyWith(fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Buka Kamera Pemindai',
                      style: TextStyle(
                        color: primaryColor,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Icon(
                      Icons.arrow_forward_rounded,
                      color: primaryColor,
                      size: 16,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
