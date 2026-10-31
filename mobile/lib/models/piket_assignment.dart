/// Satu jadwal piket pegawai dari `GET /api/piket/me`.
///
/// `source` menandai asal jadwal: `'manual'` (ditetapkan Admin) atau
/// `'rotation'` (dibuat otomatis oleh fitur giliran/cycle piket Sabtu).
class PiketAssignment {
  final DateTime tanggal;
  final String source;

  const PiketAssignment({required this.tanggal, this.source = 'manual'});

  bool get fromRotation => source == 'rotation';

  factory PiketAssignment.fromJson(Map<String, dynamic> json) {
    return PiketAssignment(
      tanggal: DateTime.parse(json['tanggal'] as String),
      source: (json['source'] as String?) ?? 'manual',
    );
  }
}
