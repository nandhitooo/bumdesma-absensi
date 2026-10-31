import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../models/attendance.dart';
import '../../services/attendance_service.dart';
import '../../state/attendance_provider.dart';
import '../../state/auth_provider.dart';
import 'result/scan_result_screen.dart';

class ScanCameraScreen extends StatefulWidget {
  final ScanType scanType;
  const ScanCameraScreen({super.key, required this.scanType});

  @override
  State<ScanCameraScreen> createState() => _ScanCameraScreenState();
}

class _ScanCameraScreenState extends State<ScanCameraScreen>
    with SingleTickerProviderStateMixin {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _handled = false;
  bool _processing = false;
  bool _torchOn = false;

  late AnimationController _animController;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    // Prefetch GPS: akuisisi dimulai sejak layar ini dibuka, paralel dengan
    // kamera. Saat QR selesai dipindai posisi biasanya sudah siap, sehingga
    // scan() tidak lagi menunggu fix GPS (sumber latensi terbesar absensi).
    AttendanceService.instance.warmUpLocation();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.1, end: 0.9).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _toggleTorch() async {
    await _controller.toggleTorch();
    setState(() => _torchOn = !_torchOn);
  }

  Future<void> _switchCamera() async {
    await _controller.switchCamera();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled || _processing) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null) return;

    setState(() => _processing = true);
    _handled = true;
    await _controller.stop();

    if (!mounted) return;
    final nip = context.read<AuthProvider>().user?.nip ?? '';

    try {
      final result = await context.read<AttendanceProvider>().scan(
            nip: nip,
            type: widget.scanType,
            token: code,
          );

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => ScanResultScreen(result: result)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyError(e))),
      );
      setState(() {
        _processing = false;
        _handled = false;
      });
      await _controller.start();
    }
  }

  String _friendlyError(Object e) {
    final msg = e.toString();
    if (msg.contains('LocationPermissionException')) {
      return msg.replaceFirst('LocationPermissionException: ', '');
    }
    return 'Gagal memproses absensi. Pastikan GPS aktif dan coba lagi.';
  }

  @override
  Widget build(BuildContext context) {
    final isMasuk = widget.scanType == ScanType.masuk;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera feed
          MobileScanner(controller: _controller, onDetect: _onDetect),

          // Custom Viewfinder Overlay
          SafeArea(
            child: Column(
              children: [
                // Top Action Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _glassButton(
                        icon: Icons.arrow_back_rounded,
                        onTap: () => Navigator.of(context).pop(),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white24, width: 1),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: isMasuk ? AppColors.success : AppColors.warning,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              isMasuk ? 'Scan Absen Masuk' : 'Scan Absen Pulang',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Row(
                        children: [
                          _glassButton(
                            icon: _torchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                            color: _torchOn ? Colors.amber : Colors.white,
                            onTap: _toggleTorch,
                          ),
                          const SizedBox(width: 8),
                          _glassButton(
                            icon: Icons.cameraswitch_rounded,
                            onTap: _switchCamera,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const Spacer(),

                // Center Target Box
                Center(
                  child: Container(
                    width: 270,
                    height: 270,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1.5),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Stack(
                      children: [
                        // Animated Scanning Laser Bar
                        AnimatedBuilder(
                          animation: _animation,
                          builder: (context, _) {
                            return Align(
                              alignment: Alignment(0, (_animation.value * 2) - 1),
                              child: Container(
                                width: 250,
                                height: 3,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.transparent,
                                      isMasuk ? AppColors.accent : AppColors.warning,
                                      Colors.transparent,
                                    ],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: (isMasuk ? AppColors.accent : AppColors.warning).withValues(alpha: 0.8),
                                      blurRadius: 10,
                                      spreadRadius: 2,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                        // Corner borders
                        Positioned(top: 0, left: 0, child: _corner(0)),
                        Positioned(top: 0, right: 0, child: _corner(1)),
                        Positioned(bottom: 0, right: 0, child: _corner(2)),
                        Positioned(bottom: 0, left: 0, child: _corner(3)),
                      ],
                    ),
                  ),
                ),

                const Spacer(),

                // Bottom Instruction Card
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.75),
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      border: Border.all(color: Colors.white24, width: 1),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: (isMasuk ? AppColors.accent : AppColors.warning).withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.qr_code_scanner_rounded,
                            color: isMasuk ? AppColors.accentLight : AppColors.warning,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Arahkan kamera ke QR Code',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'GPS akan divalidasi secara otomatis',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 11.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Processing Indicator
          if (_processing)
            Container(
              color: Colors.black.withValues(alpha: 0.75),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(
                      color: AppColors.accent,
                      strokeWidth: 3,
                    ),
                    SizedBox(height: 18),
                    Text(
                      'Memvalidasi Presensi & Lokasi GPS...',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _glassButton({
    required IconData icon,
    required VoidCallback onTap,
    Color color = Colors.white,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.5),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white24, width: 1),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
      ),
    );
  }

  Widget _corner(int quadrant) {
    const size = 26.0;
    const thickness = 4.0;
    const radius = Radius.circular(16);
    const borderColor = AppColors.accentLight;

    BorderRadius borderRadius;
    Border border;

    switch (quadrant) {
      case 0:
        borderRadius = const BorderRadius.only(topLeft: radius);
        border = const Border(
          top: BorderSide(color: borderColor, width: thickness),
          left: BorderSide(color: borderColor, width: thickness),
        );
        break;
      case 1:
        borderRadius = const BorderRadius.only(topRight: radius);
        border = const Border(
          top: BorderSide(color: borderColor, width: thickness),
          right: BorderSide(color: borderColor, width: thickness),
        );
        break;
      case 2:
        borderRadius = const BorderRadius.only(bottomRight: radius);
        border = const Border(
          bottom: BorderSide(color: borderColor, width: thickness),
          right: BorderSide(color: borderColor, width: thickness),
        );
        break;
      default:
        borderRadius = const BorderRadius.only(bottomLeft: radius);
        border = const Border(
          bottom: BorderSide(color: borderColor, width: thickness),
          left: BorderSide(color: borderColor, width: thickness),
        );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        border: border,
      ),
    );
  }
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
