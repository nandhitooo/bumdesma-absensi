import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../models/piket_assignment.dart';
import '../../../widgets/section_card.dart';

/// Kartu "Piket Berikutnya" di Dashboard.
///
/// Menampilkan jadwal piket terdekat pegawai, termasuk yang dibuat otomatis
/// oleh fitur giliran (cycle) piket Sabtu — kalau barisnya berasal dari
/// giliran, kartu menandainya dengan badge "Giliran Otomatis".
class PiketNextCard extends StatelessWidget {
  final PiketAssignment assignment;

  const PiketNextCard({super.key, required this.assignment});

  @override
  Widget build(BuildContext context) {
    final tanggal =
        DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(assignment.tanggal);

    return SectionCard(
      title: 'Piket Berikutnya',
      icon: Icons.event_available_rounded,
      trailing: assignment.fromRotation
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.round),
              ),
              child: const Text(
                'Giliran Otomatis',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            )
          : null,
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: AppColors.emeraldGradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.cleaning_services_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tanggal,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Mohon hadir sesuai jadwal piket Sabtu.',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
