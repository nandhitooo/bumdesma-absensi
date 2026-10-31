import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../models/attendance.dart';
import '../../services/attendance_service.dart';
import '../../state/auth_provider.dart';
import '../../widgets/gradient_app_header.dart';
import '../../widgets/section_card.dart';
import '../../widgets/status_badge.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  int _filterIndex = 0; // 0: Semua, 1: Tepat Waktu, 2: Terlambat, 3: Cuti/Lainnya

  Future<void> _pickMonth() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _month,
      firstDate: DateTime(DateTime.now().year - 2),
      lastDate: DateTime.now(),
      initialDatePickerMode: DatePickerMode.year,
      helpText: 'Pilih Bulan',
    );
    if (picked != null) {
      setState(() => _month = DateTime(picked.year, picked.month));
    }
  }

  @override
  Widget build(BuildContext context) {
    final nip = context.watch<AuthProvider>().user?.nip ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: GradientAppHeader(
              title: 'Riwayat Kehadiran',
              subtitle: 'Rekap absensi bulanan dan rincian waktu kerja',
              bottom: Row(
                children: [
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: _pickMonth,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.calendar_month_rounded, size: 16, color: Colors.white),
                            const SizedBox(width: 8),
                            Text(
                              DateFormat('MMMM yyyy', 'id_ID').format(_month),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: Colors.white),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
            sliver: FutureBuilder<List<DailyAttendance>>(
              future: AttendanceService.instance.getHistory(nip, month: _month),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: CircularProgressIndicator(color: AppColors.primary),
                    ),
                  );
                }

                final allItems = snapshot.data!.reversed.toList();

                // Compute monthly stats
                final totalHadir = allItems.where((d) => d.jamMasuk != null).length;
                final tepatWaktu = allItems.where((d) => d.statusMasuk == AttendanceStatus.tepatWaktu).length;
                final terlambat = allItems.where((d) => d.statusMasuk == AttendanceStatus.terlambat).length;

                // Filter items
                final items = allItems.where((item) {
                  if (_filterIndex == 1) {
                    return item.statusMasuk == AttendanceStatus.tepatWaktu;
                  }
                  if (_filterIndex == 2) {
                    return item.statusMasuk == AttendanceStatus.terlambat;
                  }
                  if (_filterIndex == 3) {
                    return item.statusMasuk == AttendanceStatus.izinCuti || item.jamMasuk == null;
                  }
                  return true;
                }).toList();

                return SliverList(
                  delegate: SliverChildListDelegate([
                    // Monthly metrics card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(color: AppColors.cardBorder, width: 1.1),
                        boxShadow: AppShadows.soft,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _MetricItem(label: 'Total Hadir', count: totalHadir, color: AppColors.primary),
                          _dividerVertical(),
                          _MetricItem(label: 'Tepat Waktu', count: tepatWaktu, color: AppColors.success),
                          _dividerVertical(),
                          _MetricItem(label: 'Terlambat', count: terlambat, color: AppColors.warning),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Filter chips
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _filterChip(0, 'Semua (${allItems.length})'),
                          const SizedBox(width: 8),
                          _filterChip(1, 'Tepat Waktu ($tepatWaktu)'),
                          const SizedBox(width: 8),
                          _filterChip(2, 'Terlambat ($terlambat)'),
                          const SizedBox(width: 8),
                          _filterChip(3, 'Izin / Tidak Masuk'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (items.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: EmptyState(
                          icon: Icons.event_busy_rounded,
                          title: 'Tidak Ada Data',
                          message: 'Tidak ditemukan riwayat kehadiran untuk filter ini.',
                        ),
                      )
                    else
                      ...items.map(
                        (rec) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _DayCard(record: rec),
                        ),
                      ),
                  ]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _dividerVertical() => Container(
        height: 36,
        width: 1,
        color: AppColors.cardBorder,
      );

  Widget _filterChip(int index, String label) {
    final selected = _filterIndex == index;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => setState(() => _filterIndex = index),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.surface,
      labelStyle: TextStyle(
        color: selected ? Colors.white : AppColors.textSecondary,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
        fontSize: 12,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: selected ? AppColors.primary : AppColors.cardBorder,
          width: 1,
        ),
      ),
    );
  }
}

class _MetricItem extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _MetricItem({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$count',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: color,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}

class _DayCard extends StatelessWidget {
  final DailyAttendance record;
  const _DayCard({required this.record});

  @override
  Widget build(BuildContext context) {
    final dateLabel =
        DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(record.date);

    return SectionCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.calendar_today_rounded, size: 14, color: AppColors.primary),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  dateLabel,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              if (record.date.weekday == DateTime.saturday)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
                  ),
                  child: const Text(
                    'Piket Sabtu',
                    style: TextStyle(
                      color: AppColors.info,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          _HistoryRow(
            icon: Icons.login_rounded,
            iconColor: AppColors.success,
            title: 'Absen Masuk',
            time: record.jamMasuk,
            status: record.statusMasuk,
            extraText: record.statusMasuk == AttendanceStatus.terlambat && record.terlambatMenit != null
                ? '${record.terlambatMenit}m'
                : null,
          ),
          const SizedBox(height: 8),
          _HistoryRow(
            icon: Icons.logout_rounded,
            iconColor: AppColors.danger,
            title: 'Absen Pulang',
            time: record.jamPulang,
            status: record.statusPulang,
            extraText: record.lemburMenit != null && record.lemburMenit! > 0
                ? '+${record.lemburMenit}m'
                : null,
          ),
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final DateTime? time;
  final AttendanceStatus? status;
  final String? extraText;

  const _HistoryRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.time,
    required this.status,
    this.extraText,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
          Text(
            time == null ? '--:--' : DateFormat('HH:mm').format(time!),
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: time == null ? AppColors.textMuted : AppColors.textPrimary,
            ),
          ),
          const SizedBox(width: 8),
          if (status != null)
            StatusBadge(status: status!, compact: true)
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.textMuted.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Belum Absen',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
