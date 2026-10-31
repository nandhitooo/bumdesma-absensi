import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../models/attendance.dart';

class StatusBadge extends StatelessWidget {
  final AttendanceStatus status;
  final bool compact;

  const StatusBadge({
    super.key,
    required this.status,
    this.compact = false,
  });

  ({Color color, Color surface, Color border, String label, IconData icon}) get _spec {
    switch (status) {
      case AttendanceStatus.tepatWaktu:
        return (
          color: AppColors.success,
          surface: AppColors.successSurface,
          border: AppColors.successBorder,
          label: 'Tepat Waktu',
          icon: Icons.check_circle_rounded,
        );
      case AttendanceStatus.terlambat:
        return (
          color: AppColors.warning,
          surface: AppColors.warningSurface,
          border: AppColors.warningBorder,
          label: 'Terlambat',
          icon: Icons.access_time_filled_rounded,
        );
      case AttendanceStatus.diterima:
        return (
          color: AppColors.success,
          surface: AppColors.successSurface,
          border: AppColors.successBorder,
          label: 'Diterima',
          icon: Icons.check_circle_rounded,
        );
      case AttendanceStatus.lembur:
        return (
          color: AppColors.warning,
          surface: AppColors.warningSurface,
          border: AppColors.warningBorder,
          label: 'Lembur',
          icon: Icons.timer_rounded,
        );
      case AttendanceStatus.ditolakGeofence:
      case AttendanceStatus.ditolakToken:
      case AttendanceStatus.ditolakDataTidakLengkap:
      case AttendanceStatus.ditolakSudahLengkap:
        return (
          color: AppColors.danger,
          surface: AppColors.dangerSurface,
          border: AppColors.dangerBorder,
          label: 'Ditolak',
          icon: Icons.cancel_rounded,
        );
      case AttendanceStatus.izinCuti:
        return (
          color: AppColors.info,
          surface: AppColors.infoSurface,
          border: AppColors.infoBorder,
          label: 'Izin/Cuti',
          icon: Icons.event_busy_rounded,
        );
      case AttendanceStatus.alpa:
        return (
          color: AppColors.textSecondary,
          surface: AppColors.surfaceAlt,
          border: AppColors.cardBorder,
          label: 'Alpa',
          icon: Icons.remove_circle_rounded,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _spec;
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: s.surface,
        borderRadius: BorderRadius.circular(AppRadius.round),
        border: Border.all(color: s.border, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(s.icon, size: compact ? 12 : 14, color: s.color),
          const SizedBox(width: 5),
          Text(
            s.label,
            style: TextStyle(
              color: s.color,
              fontSize: compact ? 11 : 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}
