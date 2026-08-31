import 'dart:async' show unawaited;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';

import '../../core/api/api_client.dart';
import '../../core/repositories/shop_repository.dart';
import '../../core/services/favorites_service.dart';
import '../../core/services/haptic_service.dart';
import '../../core/services/share_service.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/widgets/skeleton.dart';

final shopReviewsProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, id) async {
  final dio = ref.read(dioProvider);
  final res = await dio.get('/shops/$id/reviews');
  return (res.data as List<dynamic>).map((e) => Map<String, dynamic>.from(e as Map)).toList();
});

class ShopDetailScreen extends ConsumerStatefulWidget {
  const ShopDetailScreen({required this.shopId, super.key});
  final String shopId;

  @override
  ConsumerState<ShopDetailScreen> createState() => _ShopDetailScreenState();
}

class _ShopDetailScreenState extends ConsumerState<ShopDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final shopAsync = ref.watch(shopProvider(widget.shopId));
    final isFav = ref.watch(favoritesProvider).contains(widget.shopId);

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
                return ref.refresh(shopProvider(widget.shopId).future);
              },
              color: AppColors.brandOrange,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
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
                            unawaited(ref.read(hapticServiceProvider).selection());
                            ref.read(shareServiceProvider).shareShop(
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
                                loadingBuilder: (_, child, progress) {
                                  if (progress == null) return child;
                                  return Container(
                                    color: Colors.grey.shade100,
                                    child: const Center(child: CircularProgressIndicator()),
                                  );
                                },
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
                                child: Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        s.name,
                                        style: GoogleFonts.outfit(
                                          fontSize: 28,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.textDark,
                                        ),
                                      ),
                                    ),
                                    if (s.isVerified) ...[
                                      const SizedBox(width: 8),
                                      Tooltip(
                                        message: 'shop.verified'.tr(),
                                        child: Icon(Icons.verified_rounded,
                                            color: Colors.blue.shade700, size: 24),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Row(
                                children: [
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
                                  const SizedBox(width: 8),
                                  IconButton(
                                    onPressed: () {
                                      ref
                                          .read(favoritesProvider.notifier)
                                          .toggle(s.id);
                                      final isNowFav = !isFav;
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text(
                                            isNowFav
                                                ? 'shop.favorite'.tr()
                                                : 'shop.unfavorite'.tr(),
                                          ),
                                          duration: const Duration(seconds: 1),
                                        ),
                                      );
                                    },
                                    icon: Icon(
                                      isFav
                                          ? Icons.favorite_rounded
                                          : Icons.favorite_outline_rounded,
                                      color: isFav ? Colors.redAccent : Colors.grey,
                                    ),
                                  ),
                                ],
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
                          if (shop.latitude != null && shop.longitude != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(24),
                              child: SizedBox(
                                height: 180,
                                width: double.infinity,
                                child: FlutterMap(
                                  options: MapOptions(
                                    initialCenter: LatLng(shop.latitude!, shop.longitude!),
                                    initialZoom: 15.0,
                                    interactionOptions: const InteractionOptions(
                                      flags: InteractiveFlag.none,
                                    ),
                                  ),
                                  children: [
                                    TileLayer(
                                      urlTemplate:
                                          'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                                      userAgentPackageName: 'com.bagajpark.app',
                                    ),
                                    MarkerLayer(
                                      markers: [
                                        Marker(
                                          point: LatLng(shop.latitude!, shop.longitude!),
                                          width: 36,
                                          height: 36,
                                          child: const Icon(
                                            Icons.location_on_rounded,
                                            color: AppColors.brandOrange,
                                            size: 36,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            )
                          else
                            Container(
                              height: 180,
                              width: double.infinity,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(24),
                                color: Colors.grey.shade200,
                              ),
                              child: Center(
                                child: Text(
                                  'shop.no_location'.tr(),
                                  style: GoogleFonts.outfit(
                                    fontWeight: FontWeight.w500,
                                    color: Colors.grey,
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
                              if (s.hasClimateControl)
                                _amenityChip(
                                  Icons.ac_unit_rounded,
                                  'search.climate'.tr(),
                                ),
                              if (s.acceptsLargeItems)
                                _amenityChip(
                                  Icons.luggage_rounded,
                                  'search.large_items'.tr(),
                                ),
                              _amenityChip(Icons.wifi_rounded, 'Wi-Fi'),
                              _amenityChip(Icons.accessible_rounded, 'Erişim'),
                            ],
                          ),

                          const SizedBox(height: 40),

                          // Reviews Section
                          _sectionHeader('shop.reviews'.tr()),
                          const SizedBox(height: 16),
                          Consumer(builder: (context, ref, _) {
                            final reviewsAsync =
                                ref.watch(shopReviewsProvider(widget.shopId));
                            return reviewsAsync.when(
                              data: (reviews) {
                                if (reviews.isEmpty) {
                                  return Center(
                                    child: Padding(
                                      padding: const EdgeInsets.all(24),
                                      child: Text(
                                        'shop.no_reviews'.tr(),
                                        style: const TextStyle(color: Colors.grey),
                                      ),
                                    ),
                                  );
                                }
                                return Column(
                                  children: reviews.take(5).map((review) {
                                    final rating =
                                        (review['rating'] as num?)?.toInt() ?? 0;
                                    final userName =
                                        (review['userName'] as String?) ??
                                            'profile.guest'.tr();
                                    final comment =
                                        review['comment'] as String? ?? '';
                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 12),
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: Colors.grey.shade50,
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                            color: Colors.grey.shade100),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              CircleAvatar(
                                                radius: 16,
                                                backgroundColor: AppColors
                                                    .brandOrange
                                                    .withValues(alpha: 0.1),
                                                child: Text(
                                                  userName.isNotEmpty
                                                      ? userName[0].toUpperCase()
                                                      : '?',
                                                  style: GoogleFonts.outfit(
                                                    fontWeight: FontWeight.bold,
                                                    color: AppColors.brandOrange,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  userName,
                                                  style: GoogleFonts.outfit(
                                                      fontWeight:
                                                          FontWeight.w600),
                                                ),
                                              ),
                                              Row(
                                                children: List.generate(
                                                  5,
                                                  (i) => Icon(
                                                    i < rating
                                                        ? Icons.star_rounded
                                                        : Icons
                                                            .star_outline_rounded,
                                                    size: 14,
                                                    color: Colors.amber,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          if (comment.isNotEmpty) ...[
                                            const SizedBox(height: 8),
                                            Text(
                                              comment,
                                              style: GoogleFonts.outfit(
                                                fontSize: 13,
                                                color: const Color(0xFF424242),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    );
                                  }).toList(),
                                );
                              },
                              loading: () =>
                                  const Center(child: CircularProgressIndicator()),
                              error: (_, __) => Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(24),
                                  child: Text(
                                    'shop.no_reviews'.tr(),
                                    style: const TextStyle(color: Colors.grey),
                                  ),
                                ),
                              ),
                            );
                          }),

                          const SizedBox(height: 120),
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
                            s.isPrelaunch
                                ? 'search.coming_soon'.tr()
                                : '\u20BA${s.pricePerDay.toStringAsFixed(2)} /g\u00fcn',
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
                      // Talep testi noktasinda rezervasyon dugmesi KAPALI.
                      // Sunucu zaten `409 shop_not_open_yet` doner; misafiri o
                      // reddedilise kadar goturmek, tutamayacagimiz bir sozu
                      // once vermek demek.
                      child: FilledButton(
                        onPressed: s.isPrelaunch
                            ? null
                            : () {
                                unawaited(ref.read(hapticServiceProvider).medium());
                                context.push('/checkout/${s.id}');
                              },
                        child: Text(
                          s.isPrelaunch
                              ? 'search.coming_soon'.tr()
                              : 'search.book_now'.tr(),
                        ),
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