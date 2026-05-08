import 'dart:io' show Platform;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screen_protector/screen_protector.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/repositories/booking_repository.dart';
import '../../shared/models/booking.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/utils/booking_helpers.dart';
import '../../shared/widgets/skeleton.dart';

final bookingProvider = FutureProvider.family<BookingDto, String>((
  ref,
  id,
) async {
  final result = await ref.watch(bookingRepositoryProvider).getById(id);
  return result.fold((data) => data, (error) => throw Exception(error));
});

class BookingDetailScreen extends ConsumerStatefulWidget {
  const BookingDetailScreen({required this.bookingId, super.key});
  final String bookingId;

  @override
  ConsumerState<BookingDetailScreen> createState() =>
      _BookingDetailScreenState();
}

class _BookingDetailScreenState extends ConsumerState<BookingDetailScreen> {
  @override
  void initState() {
    super.initState();
    _protectScreen();
  }

  Future<void> _protectScreen() async {
    await ScreenProtector.preventScreenshotOn();
  }

  @override
  void dispose() {
    ScreenProtector.preventScreenshotOff();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bookingAsync = ref.watch(bookingProvider(widget.bookingId));
    final fmt = DateFormat('dd MMMM yyyy, HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'booking.detail_title'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
      ),
      body: bookingAsync.when(
        loading: _buildSkeleton,
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 64,
                color: Colors.redAccent,
              ),
              const SizedBox(height: 16),
              Text('common.error'.tr()),
              TextButton(
                onPressed: () => ref.refresh(bookingProvider(widget.bookingId)),
                child: Text('common.retry'.tr()),
              ),
            ],
          ),
        ),
        data: (bk) => SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              // Ticket Design
              DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          Text(
                            bk.shopName,
                            style: GoogleFonts.outfit(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          _statusBadge(bk.status),
                        ],
                      ),
                    ),
                    const _DashedLine(),
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          if (bk.qrCodeToken != null) ...[
                            QrImageView(
                              data: bk.qrCodeToken!,
                              size: 200,
                              eyeStyle: const QrEyeStyle(
                                eyeShape: QrEyeShape.square,
                                color: AppColors.textDark,
                              ),
                              dataModuleStyle: const QrDataModuleStyle(
                                dataModuleShape: QrDataModuleShape.square,
                                color: AppColors.textDark,
                              ),
                              embeddedImage: const AssetImage(
                                'assets/images/logo.png',
                              ),
                              embeddedImageStyle: const QrEmbeddedImageStyle(
                                size: Size(40, 40),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'booking.qr_hint'.tr(),
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: Colors.grey.shade500,
                              ),
                            ),
                            const SizedBox(height: 32),
                          ],
                          _infoRow(
                            'checkout.check_in'.tr(),
                            fmt.format(bk.checkInTime),
                          ),
                          const SizedBox(height: 16),
                          _infoRow(
                            'checkout.check_out'.tr(),
                            fmt.format(bk.checkOutTime),
                          ),
                          const SizedBox(height: 16),
                          _infoRow(
                            'nav.bookings'.tr(),
                            '${bk.totalBags} Adet (S:${bk.bagCountS}, M:${bk.bagCountM}, XL:${bk.bagCountXl})',
                          ),
                          const SizedBox(height: 16),
                          _infoRow(
                            'checkout.total'.tr(),
                            '₺${bk.totalPrice.toStringAsFixed(2)}',
                            isBold: true,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _launchMaps(bk),
                      icon: const Icon(Icons.map_rounded),
                      label: Text('booking.directions'.tr()),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _callShop(bk.shopPhone),
                      icon: const Icon(Icons.phone_rounded),
                      label: Text('booking.call_shop'.tr()),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.help_outline_rounded, size: 20),
                  label: Text('booking.get_help'.tr()),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.grey.shade600,
                  ),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusBadge(BookingStatus status) {
    final color = bookingStatusColor(status);
    final label = bookingStatusLabel(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        label,
        style: GoogleFonts.outfit(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.outfit(color: Colors.grey.shade500)),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: GoogleFonts.outfit(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              fontSize: isBold ? 16 : 14,
              color: AppColors.textDark,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _launchMaps(BookingDto bk) async {
    Uri url;
    if (bk.latitude != null && bk.longitude != null) {
      if (Platform.isIOS) {
        url = Uri.parse(
          'https://maps.apple.com/?q=${bk.shopName}&ll=${bk.latitude},${bk.longitude}',
        );
      } else {
        url = Uri.parse('google.navigation:q=${bk.latitude},${bk.longitude}');
      }
    } else {
      url = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=${bk.shopName}',
      );
    }

    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  Future<void> _callShop(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  Widget _buildSkeleton() {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(24),
      child: Column(
        children: [
          Skeleton(height: 400, width: double.infinity, borderRadius: 24),
          SizedBox(height: 32),
          Row(
            children: [
              Expanded(child: Skeleton(height: 56, borderRadius: 16)),
              SizedBox(width: 16),
              Expanded(child: Skeleton(height: 56, borderRadius: 16)),
            ],
          ),
        ],
      ),
    );
  }
}

class _DashedLine extends StatelessWidget {
  const _DashedLine();
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: List.generate(
          20,
          (index) => Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              height: 1,
              color: Colors.grey.shade200,
            ),
          ),
        ),
      ),
    );
  }
}
