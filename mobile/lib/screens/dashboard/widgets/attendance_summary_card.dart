import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../models/attendance.dart';
import '../../../models/work_schedule.dart';
import '../../../widgets/section_card.dart';
import '../../../widgets/status_badge.dart';

class AttendanceSummaryCard extends StatelessWidget {
  final DailyAttendance? record;
  final bool loading;
  final WorkSchedule? schedule;

  const AttendanceSummaryCard({
    super.key,
    required this.record,
    required this.loading,
    this.schedule,
  });

  String _fmtTime(DateTime? t) =>
      t == null ? '--:--' : DateFormat('HH:mm').format(t);

  String get _statusHeader {
    if (record?.jamMasuk != null && record?.jamPulang != null) {
      return 'Absensi Hari Ini Lengkap';
    } else if (record?.jamMasuk != null) {
      return 'Sudah Absen Masuk';
    } else {
      return 'Belum Melakukan Absen';
    }
  }

  Color get _statusHeaderColor {
    if (record?.jamMasuk != null && record?.jamPulang != null) {
      return AppColors.accent;
    } else if (record?.jamMasuk != null) {
      return AppColors.info;
    } else {
      return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasMasuk = record?.jamMasuk != null;
    final hasPulang = record?.jamPulang != null;

    final jadwalMasukText = schedule != null
        ? 'Jadwal ${schedule!.jamMasukLabel} WIB'
        : 'Memuat jadwal...';
    final jadwalPulangText = schedule != null
        ? 'Jadwal ${schedule!.jamPulangLabel} WIB'
        : 'Memuat jadwal...';

    return SectionCard(
      title: 'Status Presensi Hari Ini',
      icon: Icons.calendar_today_rounded,
      trailing: loading
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.primary,
              ),
            )
          : Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _statusHeaderColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.round),
                border: Border.all(
                  color: _statusHeaderColor.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Text(
                _statusHeader,
                style: TextStyle(
                  color: _statusHeaderColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
      child: Column(
        children: [
          Row(
            children: [
              // Masuk Card
              Expanded(
                child: _AttendanceItemCard(
                  title: 'Absen Masuk',
                  time: _fmtTime(record?.jamMasuk),
                  isActive: hasMasuk,
                  icon: Icons.login_rounded,
                  iconColor: AppColors.success,
                  gradient: AppColors.emeraldGradient,
                  statusWidget: record?.statusMasuk != null
                      ? StatusBadge(status: record!.statusMasuk!, compact: true)
                      : Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius:
                                BorderRadius.circular(AppRadius.round),
                          ),
                          child: const Text(
                            'Belum Absen',
                            style: TextStyle(
                              fontSize: 10.5,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                  detailText: record?.statusMasuk == AttendanceStatus.terlambat
                      ? 'Terlambat ${record?.terlambatMenit ?? ''}m'
                      : (hasMasuk ? 'Tepat Waktu' : jadwalMasukText),
                ),
              ),
              const SizedBox(width: 12),
              // Pulang Card
              Expanded(
                child: _AttendanceItemCard(
                  title: 'Absen Pulang',
                  time: _fmtTime(record?.jamPulang),
                  isActive: hasPulang,
                  icon: Icons.logout_rounded,
                  iconColor: AppColors.danger,
                  gradient: AppColors.amberGradient,
                  statusWidget: record?.statusPulang != null
                      ? StatusBadge(
                          status: record!.statusPulang!, compact: true)
                      : Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius:
                                BorderRadius.circular(AppRadius.round),
                          ),
                          child: const Text(
                            'Belum Absen',
                            style: TextStyle(
                              fontSize: 10.5,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                  detailText:
                      record?.lemburMenit != null && record!.lemburMenit! > 0
                          ? 'Lembur ${record!.lemburMenit}m'
                          : (hasPulang ? 'Selesai Kerja' : jadwalPulangText),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AttendanceItemCard extends StatelessWidget {
  final String title;
  final String time;
  final bool isActive;
  final IconData icon;
  final Color iconColor;
  final List<Color> gradient;
  final Widget statusWidget;
  final String detailText;

  const _AttendanceItemCard({
    required this.title,
    required this.time,
    required this.isActive,
    required this.icon,
    required this.iconColor,
    required this.gradient,
    required this.statusWidget,
    required this.detailText,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isActive
            ? AppColors.surface
            : AppColors.surfaceAlt.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: isActive
              ? iconColor.withValues(alpha: 0.25)
              : AppColors.cardBorder,
          width: 1.2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isActive
                        ? gradient
                        : [AppColors.textMuted, AppColors.textSecondary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: iconColor.withValues(alpha: 0.3),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Icon(icon, color: Colors.white, size: 16),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            time,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: isActive ? AppColors.textPrimary : AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 8),
          statusWidget,
          const SizedBox(height: 4),
          Text(
            detailText,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: isActive ? AppColors.textSecondary : AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}
