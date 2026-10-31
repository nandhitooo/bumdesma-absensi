import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/leave_request.dart';
import '../../services/leave_service.dart';
import '../../state/auth_provider.dart';
import '../../widgets/gradient_app_header.dart';
import '../../widgets/section_card.dart';

class LeaveFormScreen extends StatefulWidget {
  const LeaveFormScreen({super.key});

  @override
  State<LeaveFormScreen> createState() => _LeaveFormScreenState();
}

class _LeaveFormScreenState extends State<LeaveFormScreen> {
  DateTime? _startDate;
  DateTime? _endDate;
  LeaveType _type = LeaveType.izin;
  final _reasonController = TextEditingController();
  PlatformFile? _attachment;
  bool _submitting = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDateRange() async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1),
      initialDateRange: _startDate != null && _endDate != null
          ? DateTimeRange(start: _startDate!, end: _endDate!)
          : null,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              surface: AppColors.surface,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );
    if (range != null) {
      setState(() {
        _startDate = range.start;
        _endDate = range.end;
      });
    }
  }

  Future<void> _pickAttachment() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'docx'],
    );
    if (result.isNotEmpty) {
      setState(() => _attachment = result.first);
    }
  }

  int get _daysCount {
    if (_startDate == null || _endDate == null) return 0;
    return _endDate!.difference(_startDate!).inDays + 1;
  }

  Future<void> _submit() async {
    if (_startDate == null || _endDate == null) {
      _showError('Silakan pilih tanggal izin/cuti.');
      return;
    }
    if (_reasonController.text.trim().isEmpty) {
      _showError('Alasan pengajuan wajib diisi.');
      return;
    }

    setState(() => _submitting = true);
    final nip = context.read<AuthProvider>().user?.nip ?? '';

    try {
      await LeaveService.instance.submit(
        nip: nip,
        type: _type,
        startDate: _startDate!,
        endDate: _endDate!,
        reason: _reasonController.text.trim(),
        attachmentPath: _attachment?.path,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pengajuan berhasil dikirim, menunggu persetujuan Admin/Atasan.'),
        ),
      );
      setState(() {
        _startDate = null;
        _endDate = null;
        _attachment = null;
        _reasonController.clear();
      });
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError('Gagal mengirim pengajuan: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  String _dateLabel() {
    if (_startDate == null || _endDate == null) return 'Pilih Rentang Tanggal';
    final fmt = DateFormat('d MMM yyyy', 'id_ID');
    if (_startDate == _endDate) return fmt.format(_startDate!);
    return '${fmt.format(_startDate!)} — ${fmt.format(_endDate!)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          const SliverToBoxAdapter(
            child: GradientAppHeader(
              title: 'Pengajuan Izin & Cuti',
              subtitle: 'Formulir permohonan izin sakit, keperluan, atau cuti kerja',
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                SectionCard(
                  title: 'Formulir Permohonan',
                  icon: Icons.edit_note_rounded,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Type Selector Cards
                      const Text(
                        'Pilih Jenis Pengajuan',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _typeOption(LeaveType.izin, 'Izin', Icons.event_note_rounded, AppColors.accent),
                          const SizedBox(width: 8),
                          _typeOption(LeaveType.sakit, 'Sakit', Icons.sick_outlined, AppColors.danger),
                          const SizedBox(width: 8),
                          _typeOption(LeaveType.cuti, 'Cuti', Icons.beach_access_rounded, AppColors.info),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Date Range Picker
                      const Text(
                        'Tanggal Berhalangan',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: _pickDateRange,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              border: Border.all(
                                color: _startDate != null ? AppColors.primary : AppColors.cardBorder,
                                width: _startDate != null ? 1.4 : 1.1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: AppColors.primarySoft,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.primary),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    _dateLabel(),
                                    style: TextStyle(
                                      color: _startDate != null ? AppColors.textPrimary : AppColors.textMuted,
                                      fontSize: 13.5,
                                      fontWeight: _startDate != null ? FontWeight.w600 : FontWeight.w400,
                                    ),
                                  ),
                                ),
                                if (_daysCount > 0)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.primarySoft,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      '$_daysCount Hari',
                                      style: const TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Reason Field
                      const Text(
                        'Alasan Pengajuan',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _reasonController,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          hintText: 'Tuliskan alasan pengajuan secara jelas...',
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Attachment Card
                      const Text(
                        'Lampiran Dokumen (Opsional / Surat Dokter)',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      if (_attachment == null)
                        Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: _pickAttachment,
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceAlt,
                                borderRadius: BorderRadius.circular(AppRadius.md),
                                border: Border.all(color: AppColors.cardBorder, width: 1.1),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.upload_file_rounded, color: AppColors.primary, size: 20),
                                  SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      'Unggah file .pdf atau .docx',
                                      style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                                    ),
                                  ),
                                  Icon(Icons.add_rounded, color: AppColors.primary, size: 20),
                                ],
                              ),
                            ),
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.successSurface,
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            border: Border.all(color: AppColors.successBorder),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.description_rounded, color: AppColors.success, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _attachment!.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.danger),
                                onPressed: () => setState(() => _attachment = null),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 22),

                      // Submit Button
                      Container(
                        height: 52,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: AppColors.emeraldGradient,
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.accent.withValues(alpha: 0.35),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            onTap: _submitting ? null : _submit,
                            child: Center(
                              child: _submitting
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.4,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text(
                                      'Kirim Pengajuan',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.1,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const Row(
                  children: [
                    Icon(Icons.history_rounded, size: 18, color: AppColors.primary),
                    SizedBox(width: 8),
                    Text('Riwayat Pengajuan Anda', style: AppTextStyles.sectionTitle),
                  ],
                ),
                const SizedBox(height: 12),
                _buildHistoryList(),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _typeOption(LeaveType type, String label, IconData icon, Color color) {
    final selected = _type == type;
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.md),
          onTap: () => setState(() => _type = type),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: selected ? color.withValues(alpha: 0.12) : AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(
                color: selected ? color : AppColors.cardBorder,
                width: selected ? 1.6 : 1.1,
              ),
            ),
            child: Column(
              children: [
                Icon(icon, color: selected ? color : AppColors.textSecondary, size: 22),
                const SizedBox(height: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                    color: selected ? color : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHistoryList() {
    final nip = context.watch<AuthProvider>().user?.nip ?? '';
    return FutureBuilder<List<LeaveRequest>>(
      future: LeaveService.instance.getMyLeaveRequests(nip),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          );
        }
        final items = snapshot.data!;
        if (items.isEmpty) {
          return const EmptyState(
            icon: Icons.inbox_outlined,
            title: 'Belum Ada Pengajuan',
            message: 'Semua permohonan izin/cuti yang Anda kirim akan muncul di sini.',
          );
        }
        return Column(
          children: items
              .map(
                (r) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _LeaveTile(request: r),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _LeaveTile extends StatelessWidget {
  final LeaveRequest request;
  const _LeaveTile({required this.request});

  Color get _statusColor {
    switch (request.status) {
      case LeaveStatus.disetujui:
        return AppColors.success;
      case LeaveStatus.ditolak:
        return AppColors.danger;
      case LeaveStatus.menunggu:
        return AppColors.warning;
    }
  }

  Color get _statusSurface {
    switch (request.status) {
      case LeaveStatus.disetujui:
        return AppColors.successSurface;
      case LeaveStatus.ditolak:
        return AppColors.dangerSurface;
      case LeaveStatus.menunggu:
        return AppColors.warningSurface;
    }
  }

  Color get _statusBorder {
    switch (request.status) {
      case LeaveStatus.disetujui:
        return AppColors.successBorder;
      case LeaveStatus.ditolak:
        return AppColors.dangerBorder;
      case LeaveStatus.menunggu:
        return AppColors.warningBorder;
    }
  }

  String get _statusLabel {
    switch (request.status) {
      case LeaveStatus.disetujui:
        return 'Disetujui';
      case LeaveStatus.ditolak:
        return 'Ditolak';
      case LeaveStatus.menunggu:
        return 'Menunggu';
    }
  }

  IconData get _typeIcon {
    switch (request.type) {
      case LeaveType.cuti:
        return Icons.beach_access_rounded;
      case LeaveType.sakit:
        return Icons.sick_outlined;
      case LeaveType.izin:
        return Icons.event_note_rounded;
    }
  }

  Color get _typeColor {
    switch (request.type) {
      case LeaveType.cuti:
        return AppColors.info;
      case LeaveType.sakit:
        return AppColors.danger;
      case LeaveType.izin:
        return AppColors.accent;
    }
  }

  String get _typeLabel {
    switch (request.type) {
      case LeaveType.cuti:
        return 'Cuti';
      case LeaveType.sakit:
        return 'Sakit';
      case LeaveType.izin:
        return 'Izin';
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('d MMM yyyy', 'id_ID');

    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: _typeColor.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: Icon(_typeIcon, color: _typeColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _typeLabel,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${fmt.format(request.startDate)} — ${fmt.format(request.endDate)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (request.reason.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    request.reason,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _statusSurface,
              borderRadius: BorderRadius.circular(AppRadius.round),
              border: Border.all(color: _statusBorder),
            ),
            child: Text(
              _statusLabel,
              style: TextStyle(
                color: _statusColor,
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
