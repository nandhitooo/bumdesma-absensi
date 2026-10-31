import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../state/attendance_provider.dart';
import '../../state/auth_provider.dart';
import '../../state/notification_provider.dart';
import '../../state/settings_provider.dart';
import '../../widgets/gradient_app_header.dart';
import '../history/history_screen.dart';
import '../leave/leave_form_screen.dart';
import '../notification/notification_panel.dart';
import '../scan/scan_select_screen.dart';
import 'widgets/attendance_summary_card.dart';
import 'widgets/piket_next_card.dart';
import 'widgets/quick_action_tile.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Timer? _clockTimer;
  DateTime _currentTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _currentTime = DateTime.now());
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final nip = context.read<AuthProvider>().user?.nip;
      if (nip != null) {
        context.read<AttendanceProvider>().refreshToday(nip);
        context.read<NotificationProvider>().refresh(nip);
      }
      context.read<SettingsProvider>().loadIfNeeded();
    });
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    super.dispose();
  }

  String _greeting() {
    final hour = _currentTime.hour;
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }

  IconData _greetingIcon() {
    final hour = _currentTime.hour;
    if (hour >= 6 && hour < 11) return Icons.wb_sunny_rounded;
    if (hour >= 11 && hour < 15) return Icons.wb_cloudy_rounded;
    if (hour >= 15 && hour < 18) return Icons.wb_twilight_rounded;
    return Icons.nights_stay_rounded;
  }

  Future<void> _openNotifications(String nip) async {
    context.read<NotificationProvider>().clear();
    await showNotificationPanel(context, nip);
    if (!mounted) return;
    context.read<NotificationProvider>().refresh(nip);
  }

  void _showOfficeInfo() {
    final schedule = context.read<SettingsProvider>().schedule;

    final jamReguler = schedule != null
        ? '${schedule.jamMasukLabel} - ${schedule.jamPulangLabel} WIB'
        : 'Memuat...';
    final jamSabtu = schedule?.sabtuJamMasukLabel != null
        ? '${schedule!.sabtuJamMasukLabel} - ${schedule.sabtuJamPulangLabel} WIB (Sesuai Jadwal)'
        : 'Sesuai jadwal piket yang ditetapkan Admin';
    final radiusText = schedule != null
        ? 'Maksimal ${schedule.radiusMeters.round()} meter dari titik kantor'
        : 'Memuat...';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.divider,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.business_rounded,
                      color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'BUMDESMA Podo Rukun LKD',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                      Text(
                        'Informasi Kantor & Jam Kerja',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _infoRow(Icons.schedule_rounded, 'Hari Kerja Reguler',
                'Senin — Jumat : $jamReguler'),
            _infoRow(
                Icons.event_available_rounded, 'Piket Hari Sabtu', jamSabtu),
            _infoRow(
                Icons.location_on_rounded, 'Radius Presensi GPS', radiusText),
            _infoRow(Icons.verified_user_rounded, 'Verifikasi Absen',
                'Scan QR Code Resmi di Kantor'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Tutup'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final attendance = context.watch<AttendanceProvider>();
    final notification = context.watch<NotificationProvider>();
    final settings = context.watch<SettingsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          if (user != null) {
            await attendance.refreshToday(user.nip);
            if (!mounted) return;
            await context.read<NotificationProvider>().refresh(user.nip);
          }
          if (!mounted) return;
          await context.read<SettingsProvider>().refresh();
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: _buildHeader(
                user?.nama ?? '',
                user?.jabatan ?? '',
                user?.nip ?? '',
                notification.hasUnread,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  AttendanceSummaryCard(
                    record: attendance.today,
                    loading: attendance.loading,
                    schedule: settings.schedule,
                  ),
                  if (settings.nextPiket != null) ...[
                    const SizedBox(height: 16),
                    PiketNextCard(assignment: settings.nextPiket!),
                  ],
                  const SizedBox(height: 24),
                  const Row(
                    children: [
                      Icon(Icons.grid_view_rounded,
                          size: 18, color: AppColors.primary),
                      SizedBox(width: 8),
                      Text('Menu & Aksi Cepat',
                          style: AppTextStyles.sectionTitle),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: QuickActionTile(
                          icon: Icons.qr_code_scanner_rounded,
                          label: 'Scan Absen',
                          subtitle: 'Masuk / Pulang',
                          gradient: AppColors.emeraldGradient,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const ScanSelectScreen(),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: QuickActionTile(
                          icon: Icons.event_note_rounded,
                          label: 'Izin & Cuti',
                          subtitle: 'Ajukan Form',
                          gradient: AppColors.blueGradient,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const LeaveFormScreen(),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: QuickActionTile(
                          icon: Icons.history_rounded,
                          label: 'Riwayat',
                          subtitle: 'Rekap Kehadiran',
                          gradient: [
                            const Color(0xFF6D28D9),
                            const Color(0xFF8B5CF6),
                          ],
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const HistoryScreen(),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: QuickActionTile(
                          icon: Icons.business_rounded,
                          label: 'Info Kantor',
                          subtitle: 'Jadwal & Lokasi',
                          gradient: [
                            const Color(0xFF0D9488),
                            const Color(0xFF14B8A6),
                          ],
                          onTap: _showOfficeInfo,
                        ),
                      ),
                    ],
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(String nama, String jabatan, String nip, bool hasUnread) {
    final todayStr =
        DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(_currentTime);
    final timeStr = DateFormat('HH:mm:ss').format(_currentTime);
    final initial = nama.isNotEmpty ? nama[0].toUpperCase() : '?';

    return GradientAppHeader(
      title: '',
      padding: EdgeInsets.zero,
      bottom: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 26),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                HeaderAvatar(initial: initial, size: 52),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            _greetingIcon(),
                            size: 14,
                            color: Colors.white.withValues(alpha: 0.85),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '${_greeting()},',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        nama.isEmpty ? 'Pegawai' : nama,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        jabatan.isNotEmpty ? jabatan : 'Pegawai BUMDESMA',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.78),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                HeaderIconButton(
                  icon: Icons.notifications_rounded,
                  showDot: hasUnread,
                  onTap: () => _openNotifications(nip),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.2),
                  width: 1.1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.calendar_today_rounded,
                    size: 14,
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      todayStr,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.92),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.access_time_rounded,
                            size: 12, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          '$timeStr WIB',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
