import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../models/attendance.dart';
import '../../../shell/main_shell.dart';
import '../../../widgets/status_badge.dart';

class ScanResultScreen extends StatelessWidget {
  final ScanResult result;
  const ScanResultScreen({super.key, required this.result});

  bool get _isRejected => !result.success;

  ({Color color, Color surface, IconData icon, String heading, String subtitle}) get _visual {
    if (_isRejected) {
      return (
        color: AppColors.danger,
        surface: AppColors.dangerSurface,
        icon: Icons.close_rounded,
        heading: 'Presensi Ditolak',
        subtitle: 'Sistem tidak dapat memvalidasi absensi Anda',
      );
    }
    switch (result.status) {
      case AttendanceStatus.tepatWaktu:
      case AttendanceStatus.diterima:
        return (
          color: AppColors.success,
          surface: AppColors.successSurface,
          icon: Icons.check_rounded,
          heading: 'Presensi Berhasil Diterima',
          subtitle: 'Kehadiran Anda telah tercatat tepat waktu',
        );
      case AttendanceStatus.terlambat:
        return (
          color: AppColors.warning,
          surface: AppColors.warningSurface,
          icon: Icons.check_rounded,
          heading: 'Presensi Diterima (Terlambat)',
          subtitle: 'Kehadiran tercatat dengan status terlambat',
        );
      case AttendanceStatus.lembur:
        return (
          color: AppColors.warning,
          surface: AppColors.warningSurface,
          icon: Icons.check_rounded,
          heading: 'Presensi Pulang (Lembur)',
          subtitle: 'Jam kepulangan dan lembur berhasil dicatat',
        );
      default:
        return (
          color: AppColors.danger,
          surface: AppColors.dangerSurface,
          icon: Icons.close_rounded,
          heading: 'Presensi Ditolak',
          subtitle: 'Terjadi kendala saat memvalidasi absensi',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = _visual;
    final isMasuk = result.requestedType == ScanType.masuk;

    return Scaffold(
      backgroundColor: AppColors.primary,
      body: Stack(
        children: [
          // Ambient graphics
          Positioned(
            top: -40,
            right: -40,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.accent.withValues(alpha: 0.15),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Main Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(26),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.xxl),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.18),
                            blurRadius: 24,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          // Glowing icon container
                          Container(
                            width: 76,
                            height: 76,
                            decoration: BoxDecoration(
                              color: v.surface,
                              shape: BoxShape.circle,
                              border: Border.all(color: v.color.withValues(alpha: 0.4), width: 2),
                              boxShadow: [
                                BoxShadow(
                                  color: v.color.withValues(alpha: 0.25),
                                  blurRadius: 16,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Icon(v.icon, color: v.color, size: 40),
                          ),
                          const SizedBox(height: 18),
                          Text(
                            v.heading,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            v.subtitle,
                            textAlign: TextAlign.center,
                            style: AppTextStyles.caption.copyWith(fontSize: 12.5),
                          ),
                          const SizedBox(height: 20),
                          if (!_isRejected) ...[
                            _buildInfoBox(isMasuk),
                            const SizedBox(height: 14),
                            if (!isMasuk)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceAlt,
                                  borderRadius: BorderRadius.circular(AppRadius.sm),
                                ),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.directions_walk_rounded, size: 16, color: AppColors.textSecondary),
                                    SizedBox(width: 6),
                                    Text(
                                      'Hati-hati di perjalanan pulang ya!',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ] else ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.dangerSurface,
                                borderRadius: BorderRadius.circular(AppRadius.md),
                                border: Border.all(color: AppColors.dangerBorder),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.info_outline_rounded, color: AppColors.danger, size: 20),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      result.message,
                                      style: const TextStyle(
                                        color: AppColors.danger,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                        height: 1.35,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.primary,
                          elevation: 2,
                        ),
                        onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(builder: (_) => const MainShell()),
                          (route) => false,
                        ),
                        child: const Text('Kembali ke Beranda'),
                      ),
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

  Widget _buildInfoBox(bool isMasuk) {
    final hari = DateFormat('EEEE', 'id_ID').format(result.timestamp);
    final tanggal = DateFormat('d MMMM yyyy', 'id_ID').format(result.timestamp);
    final jam = DateFormat('HH:mm:ss').format(result.timestamp);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        children: [
          _row('Jenis Presensi', isMasuk ? 'Absen Masuk' : 'Absen Pulang', isFirst: true),
          _divider(),
          _row('Hari / Tanggal', '$hari, $tanggal'),
          _divider(),
          _row('Waktu Presensi', '$jam WIB'),
          _divider(),
          if (isMasuk && result.terlambatMenit != null && result.terlambatMenit! > 0) ...[
            _row('Terlambat', '${result.terlambatMenit} Menit', valueColor: AppColors.warning),
            _divider(),
          ],
          if (!isMasuk && result.lemburMenit != null && result.lemburMenit! > 0) ...[
            _row('Lembur', '${result.lemburMenit} Menit', valueColor: AppColors.warning),
            _divider(),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Status Validasi', style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
                StatusBadge(status: result.status, compact: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _divider() => const Divider(height: 1, indent: 14, endIndent: 14, color: AppColors.cardBorder);

  Widget _row(String label, String value, {bool isFirst = false, Color? valueColor}) {
    return Padding(
      padding: EdgeInsets.fromLTRB(14, isFirst ? 12 : 10, 14, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: valueColor ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
