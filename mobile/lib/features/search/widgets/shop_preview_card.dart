import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/services/favorites_service.dart';
import '../../../shared/models/shop.dart';
import '../../../shared/utils/app_colors.dart';

class ShopPreviewCard extends ConsumerWidget {
  final ShopDto shop;
  final bool isSelected;

  const ShopPreviewCard({
    required this.shop,
    required this.isSelected,
    super.key,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFav = ref.watch(favoritesProvider).contains(shop.id);
    return GestureDetector(
      onTap: () => context.push('/shop/${shop.id}'),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: MediaQuery.of(context).size.width * 0.85,
        margin: const EdgeInsets.only(right: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isSelected ? AppColors.brandOrange : Colors.white,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 20,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 100,
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: shop.imageUrl != null
                    ? CachedNetworkImage(
                        imageUrl: shop.imageUrl!,
                        fit: BoxFit.cover,
                        placeholder: (context, url) =>
                            Container(color: Colors.grey.shade100),
                      )
                    : Container(
                        color: AppColors.brandOrange.withValues(alpha: 0.1),
                        child: Center(
                          child: Text(
                            shop.name.isNotEmpty
                                ? shop.name.substring(0, 1).toUpperCase()
                                : 'S',
                            style: GoogleFonts.outfit(
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                              color: AppColors.brandOrange,
                            ),
                          ),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          shop.name,
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textDark,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => ref.read(favoritesProvider.notifier).toggle(shop.id),
                        child: Icon(
                          isFav ? Icons.favorite_rounded : Icons.favorite_outline_rounded,
                          size: 22,
                          color: isFav ? Colors.redAccent : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, color: Colors.amber, size: 18),
                      const SizedBox(width: 4),
                      Text('${shop.rating?.toStringAsFixed(1) ?? '-'}',
                        style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF424242), fontWeight: FontWeight.w500)),
                      if (shop.pricePerDay > 0) ...[
                        const Spacer(),
                        Text('₺${shop.pricePerDay.toStringAsFixed(0)}${'search.day_unit'.tr()}',
                          style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.brandOrange)),
                      ],
                    ],
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
