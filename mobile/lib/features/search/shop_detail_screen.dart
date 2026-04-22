import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../shared/models/shop.dart';

final shopProvider = FutureProvider.family<ShopDto, String>((ref, id) async {
  try {
    final res = await ref.watch(dioProvider).get('/shops/$id');
    return ShopDto.fromJson(res.data as Map<String, dynamic>);
  } catch (e) {
    rethrow;
  }
});

class ShopDetailScreen extends ConsumerWidget {
  const ShopDetailScreen({super.key, required this.shopId});
  final String shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shopAsync = ref.watch(shopProvider(shopId));

    return Scaffold(
      body: shopAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
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
              const Text('Dükkan yüklenirken bir hata oluştu'),
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('Geri Dön'),
              ),
            ],
          ),
        ),
        data: (s) => Stack(
          children: [
            CustomScrollView(
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
                        onPressed: () => context.pop(),
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
                        onPressed: () {},
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
                      child: Image.network(
                        'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=800&auto=format&fit=crop',
                        fit: BoxFit.cover,
                      ),
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
                                  color: const Color(0xFF0F172A),
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
                                      color: const Color(0xFFF97316),
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
                              color: Colors.grey,
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                '${s.address ?? ''}, ${s.district ?? ''} / ${s.city ?? ''}',
                                style: GoogleFonts.outfit(
                                  color: Colors.grey.shade600,
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
                              'Çalışma Saatleri',
                              s.open247
                                  ? '7/24 Açık'
                                  : '${s.openingTime} - ${s.closingTime}',
                            ),
                            _infoItem(
                              Icons.luggage_rounded,
                              'Kapasite',
                              '${s.capacity} Valiz',
                            ),
                            _infoItem(
                              Icons.verified_user_rounded,
                              'Güvenlik',
                              'Üst Düzey',
                            ),
                          ],
                        ),

                        const SizedBox(height: 40),

                        Text(
                          'Dükkan Hakkında',
                          style: GoogleFonts.outfit(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Bu dükkan BagajPark güvencesiyle valizlerinizi güvenle emanet edebileceğiniz, merkezi konumda ve kamera sistemiyle korunan bir noktadır. Siz şehri keşfederken valizleriniz mühürlü ve sigortalı olarak bekler.',
                          style: GoogleFonts.outfit(
                            fontSize: 15,
                            color: Colors.grey.shade600,
                            height: 1.6,
                          ),
                        ),

                        const SizedBox(height: 40),

                        Text(
                          'Hizmetler',
                          style: GoogleFonts.outfit(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 16),
                        _amenityItem(
                          Icons.videocam_rounded,
                          '7/24 Kamera İzleme',
                        ),
                        _amenityItem(
                          Icons.security_rounded,
                          'Sigortalı Emanet',
                        ),
                        if (s.hasRestroom)
                          _amenityItem(
                            Icons.wc_rounded,
                            'Ücretsiz Tuvalet / Lavabo',
                          ),
                        _amenityItem(Icons.wifi_rounded, 'Ücretsiz Wi-Fi'),
                        _amenityItem(Icons.accessible_rounded, 'Kolay Erişim'),

                        const SizedBox(height: 100), // Buton için boşluk
                      ],
                    ),
                  ),
                ),
              ],
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
                            'Toplam Tutar',
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          Text(
                            '₺${s.pricePerDay.toStringAsFixed(2)} /gün',
                            style: GoogleFonts.outfit(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFFF97316),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed: () => context.push('/checkout/${s.id}'),
                        child: const Text('Rezervasyon Yap'),
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

  Widget _infoItem(IconData icon, String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: const Color(0xFFF97316), size: 28),
          const SizedBox(height: 8),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              color: Colors.grey.shade500,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0F172A),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _amenityItem(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: const Color(0xFF0F172A)),
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 15,
              color: Colors.grey.shade700,
            ),
          ),
        ],
      ),
    );
  }
}
