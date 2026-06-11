import 'dart:async' show unawaited;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/repositories/shop_repository.dart';
import '../../core/services/haptic_service.dart';
import '../../core/services/share_service.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/widgets/skeleton.dart';

class ShopDetailScreen extends ConsumerWidget {
  const ShopDetailScreen({required this.shopId, super.key});
  final String shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shopAsync = ref.watch(shopProvider(shopId));

    return Scaffold(
      body: shopAsync.when(
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
              const Text('shop.error_loading').tr(),
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('common.back').tr(),
              ),
            ],
          ),
        ),
        data: (s) => Stack(
          children: [
            RefreshIndicator(
              onRefresh: () async {
                unawaited(ref.read(hapticServiceProvider).light());
                return ref.refresh(shopProvider(shopId).future);
              },
              color: AppColors.brandOrange,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  // Spectacular Parallax Header
                  SliverAppBar(
                    expandedHeight: 300,
                    pinned: true,
                    leading: Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: CircleAvatar(
                        backgroundColor: Colors.white.withValues(alpha: 0.9),
                        child: IconButton(
                          onPressed: () {
                            unawaited(ref.read(hapticServiceProvider).light());
                            context.pop();
                          },
                          icon: const Icon(
                            Icons.arrow_back_ios_new_rounded,
                            size: 20,
                            color: Colors.black,
                          ),
                        ),
                      ),
                    ),
                    actions: [
                      CircleAvatar(
                        backgroundColor: Colors.white.withValues(alpha: 0.9),
                        child: IconButton(
                          onPressed: () {
                            unawaited(
                              ref.read(hapticServiceProvider).selection(),
                            );
                            ref
                                .read(shareServiceProvider)
                                .shareShop(
                                  id: s.id,
                                  name: s.name,
                                  address: s.address ?? '',
                                );
                          },
                          icon: const Icon(
                            Icons.share_rounded,
                            size: 20,
                            color: Colors.black,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                    ],
                    flexibleSpace: FlexibleSpaceBar(
                      background: Hero(
                        tag: 'shop-${s.id}',
                        child: s.imageUrl != null
                            ? Image.network(
                                s.imageUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => _shopPlaceholder(s.name),
                              )
                            : _shopPlaceholder(s.name),
                      ),
                    ),
                  ),

                  SliverToBoxAdapter(
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.vertical(
                          top: Radius.circular(32),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  s.name,
                                  style: GoogleFonts.outfit(
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textDark,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.orange.shade50,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.star_rounded,
                                      color: Colors.amber,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      s.rating?.toStringAsFixed(1) ?? 'N/A',
                                      style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.brandOrange,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(
                                Icons.location_on_rounded,
                                size: 16,
                                color: Color(0xFF616161),
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  '${s.address ?? ''}, ${s.district ?? ''} / ${s.city ?? ''}',
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFF424242),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 32),

                          // Info Grid
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _infoItem(
                                Icons.access_time_rounded,
                                'shop.hours'.tr(),
                                s.open247
                                    ? 'search.open_247'.tr()
                                    : '${s.openingTime} - ${s.closingTime}',
                              ),
                              _infoItem(
                                Icons.luggage_rounded,
                                'shop.capacity'.tr(),
                                'shop.capacity_val'.tr(
                                  args: [s.capacity.toString()],
                                ),
                              ),
                              _infoItem(
                                Icons.verified_user_rounded,
                                'shop.security'.tr(),
                                'shop.security_high'.tr(),
                              ),
                            ],
                          ),

                          const SizedBox(height: 40),

                          _sectionHeader('shop.about'.tr()),
                          const SizedBox(height: 12),
                          Text(
                            'shop.about_desc'.tr(),
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              color: const Color(0xFF424242),
                              height: 1.6,
                            ),
                          ),

                          const SizedBox(height: 32),

                          // Map Preview
                          _sectionHeader('shop.location'.tr()),
                          const SizedBox(height: 16),
                          Container(
                            height: 180,
                            width: double.infinity,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(24),
                              color: Colors.grey.shade200,
                            ),
                            child: Center(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(
                                        alpha: 0.1,
                                      ),
                                      blurRadius: 10,
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(
                                      Icons.map_rounded,
                                      size: 18,
                                      color: AppColors.brandOrange,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      'shop.view_on_map'.tr(),
                                      style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(height: 40),

                          _sectionHeader('shop.amenities'.tr()),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                              _amenityChip(
                                Icons.videocam_rounded,
                                'search.camera'.tr(),
                              ),
                              _amenityChip(
                                Icons.security_rounded,
                                'search.insurance'.tr(),
                              ),
                              if (s.hasRestroom)
                                _amenityChip(
                                  Icons.wc_rounded,
                                  'search.restroom'.tr(),
                                ),
                              _amenityChip(Icons.wifi_rounded, 'Wi-Fi'),
                              _amenityChip(Icons.accessible_rounded, 'Erişim'),
                            ],
                          ),

                          const SizedBox(height: 40),

                          _sectionHeader('shop.reviews'.tr()),
                          const SizedBox(height: 16),
                          Center(
                            child: Padding(
                              padding: EdgeInsets.all(24),
                              child: Text(
                                'Henüz yorum bulunmuyor.',
                                style: TextStyle(color: Colors.grey),
                              ),
                            ),
                          ),

                          const SizedBox(height: 120), // Bottom bar space
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Bottom Action Bar
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 20,
                      offset: const Offset(0, -10),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'shop.total_amount'.tr(),
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              color: const Color(0xFF424242),
                            ),
                          ),
                          Text(
                            '₺${s.pricePerDay.toStringAsFixed(2)} /gün',
                            style: GoogleFonts.outfit(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: AppColors.brandOrange,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed: () {
                          unawaited(ref.read(hapticServiceProvider).medium());
                          context.push('/checkout/${s.id}');
                        },
                        child: Text('search.book_now'.tr()),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Text(
      title,
      style: GoogleFonts.outfit(
        fontSize: 20,
        fontWeight: FontWeight.bold,
        color: AppColors.textDark,
      ),
    );
  }

  Widget _infoItem(IconData icon, String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: AppColors.brandOrange, size: 28),
          const SizedBox(height: 8),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              color: const Color(0xFF616161),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppColors.textDark,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _amenityChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: AppColors.brandOrange),
          const SizedBox(width: 8),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: AppColors.textDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSkeleton() {
    return const SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Skeleton(height: 300, width: double.infinity, borderRadius: 0),
          Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Skeleton(height: 32, width: 200),
                    Skeleton(height: 32, width: 60),
                  ],
                ),
                SizedBox(height: 16),
                Skeleton(height: 16, width: 250),
                SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Skeleton(height: 60, width: 100),
                    Skeleton(height: 60, width: 100),
                    Skeleton(height: 60, width: 100),
                  ],
                ),
                SizedBox(height: 40),
                Skeleton(height: 24, width: 150),
                SizedBox(height: 16),
                Skeleton(height: 100, width: double.infinity),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _shopPlaceholder(String name) {
    return Container(
      color: AppColors.brandOrange.withValues(alpha: 0.1),
      child: Center(
        child: Text(
          name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'S',
          style: GoogleFonts.outfit(
            fontSize: 48,
            fontWeight: FontWeight.bold,
            color: AppColors.brandOrange,
          ),
        ),
      ),
    );
  }
}
