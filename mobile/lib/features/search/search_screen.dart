import 'dart:async';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';

import '../../core/repositories/shop_repository.dart';
import '../../core/services/analytics_service.dart';
import '../../core/services/location_service.dart';
import '../../shared/models/shop.dart';
import '../../shared/utils/app_colors.dart';
import 'widgets/search_map.dart';
import 'widgets/shop_preview_card.dart';

final geocodingDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
    ),
  );
});

class DebouncedLocationNotifier extends Notifier<LatLng?> {
  @override
  LatLng? build() => null;
  void updateLocation(LatLng center) => state = center;
}

final debouncedLocationProvider =
    NotifierProvider<DebouncedLocationNotifier, LatLng?>(
      DebouncedLocationNotifier.new,
    );

final nearbyShopsProvider = FutureProvider<List<ShopDto>>((ref) async {
  final center = ref.watch(debouncedLocationProvider);
  if (center == null) return [];

  try {
    final result = await ref
        .watch(shopRepositoryProvider)
        .getNearby(lat: center.latitude, lng: center.longitude);
    return result.fold((data) => data, (error) => []);
  } catch (e) {
    return [];
  }
});

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  static const _istanbul = LatLng(41.0082, 28.9784);
  LatLng _center = _istanbul;
  LatLng? _userLocation;
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  String? _selectedShopId;
  List<dynamic> _suggestions = [];
  bool _onlyOpenNow = false;
  bool _only247 = false;
  int _minRating = 0;
  double _maxPrice = 0;
  bool _hasRestroom = false;
  bool _hasCctv = false;
  bool _hasClimate = false;
  bool _acceptsLarge = false;
  String _sortBy = 'distance'; // distance | price | rating
  Timer? _debounce;
  final _maxPriceController = TextEditingController();

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('search.filter'.tr(), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),

              SwitchListTile(title: Text('search.open_now'.tr(), style: GoogleFonts.outfit()), subtitle: Text('search.open_now_hint'.tr(), style: GoogleFonts.outfit(fontSize: 12)), value: _onlyOpenNow,
                onChanged: (v) { setState(() => _onlyOpenNow = v); setSheetState(() {}); }, activeThumbColor: AppColors.brandOrange),
              SwitchListTile(title: Text('search.open_247'.tr(), style: GoogleFonts.outfit()), subtitle: Text('search.open_247_hint'.tr(), style: GoogleFonts.outfit(fontSize: 12)), value: _only247,
                onChanged: (v) { setState(() => _only247 = v); setSheetState(() {}); }, activeThumbColor: AppColors.brandOrange),

              const SizedBox(height: 8),
              Text('search.sort_by'.tr(), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold)),
              Row(children: [
                _filterChip('search.sort_distance'.tr(), _sortBy == 'distance', () { setState(() => _sortBy = 'distance'); setSheetState(() {}); }),
                const SizedBox(width: 8),
                _filterChip('search.sort_price'.tr(), _sortBy == 'price', () { setState(() => _sortBy = 'price'); setSheetState(() {}); }),
                const SizedBox(width: 8),
                _filterChip('search.sort_rating'.tr(), _sortBy == 'rating', () { setState(() => _sortBy = 'rating'); setSheetState(() {}); }),
              ]),

              const SizedBox(height: 12),
              Text('search.amenities'.tr(), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                _filterChip('search.restroom'.tr(), _hasRestroom, () { setState(() => _hasRestroom = !_hasRestroom); setSheetState(() {}); }),
                _filterChip('search.camera'.tr(), _hasCctv, () { setState(() => _hasCctv = !_hasCctv); setSheetState(() {}); }),
                _filterChip('search.climate'.tr(), _hasClimate, () { setState(() => _hasClimate = !_hasClimate); setSheetState(() {}); }),
                _filterChip('search.large_items'.tr(), _acceptsLarge, () { setState(() => _acceptsLarge = !_acceptsLarge); setSheetState(() {}); }),
              ]),

              const SizedBox(height: 12),
              Text('search.min_rating'.tr(), style: GoogleFonts.outfit(fontSize: 14)),
              Row(children: List.generate(5, (i) => IconButton(
                icon: Icon(i < _minRating ? Icons.star_rounded : Icons.star_outline_rounded, color: Colors.amber),
                onPressed: () { setState(() => _minRating = i + 1 == _minRating ? i : i + 1); setSheetState(() {}); },
              ))),

              const SizedBox(height: 12),
              Text('search.max_price'.tr(), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextField(
                controller: _maxPriceController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  hintText: 'search.max_price'.tr(),
                  prefixText: '₺ ',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                onChanged: (v) { setState(() => _maxPrice = double.tryParse(v) ?? 0); },
              ),

              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => Navigator.pop(context),
                style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
                child: Text('search.show_results'.tr()),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _filterChip(String label, bool selected, VoidCallback onTap) {
    return FilterChip(
      label: Text(label, style: GoogleFonts.outfit(fontSize: 13)),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.brandOrange.withValues(alpha: 0.15),
      checkmarkColor: AppColors.brandOrange,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    );
  }

  Timer? _locationDebounce;

  void _onMapMoved(LatLng center) {
    if (_locationDebounce?.isActive ?? false) _locationDebounce?.cancel();
    _locationDebounce = Timer(const Duration(milliseconds: 600), () {
      if (mounted) {
        ref.read(debouncedLocationProvider.notifier).updateLocation(center);
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _determinePosition();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _onMapMoved(_center);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _locationDebounce?.cancel();
    _maxPriceController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchSuggestions(String query) async {
    if (_debounce?.isActive ?? false) _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (query.length < 3) {
        setState(() => _suggestions = []);
        return;
      }
      try {
        final dio = ref.read(geocodingDioProvider);
        final res = await dio.get(
          'https://photon.komoot.io/api/',
          queryParameters: {'q': query, 'limit': 5},
          options: Options(
            headers: {'User-Agent': 'BagajPark (contact@bagajpark.com)'},
          ),
        );
        final features = res.data['features'] as List<dynamic>;
        setState(() => _suggestions = features);
      } catch (e) {
        debugPrint('Suggestions error: $e');
      }
    });
  }

  Future<void> _selectSuggestion(dynamic suggestion) async {
    final coords = suggestion['geometry']['coordinates'] as List<dynamic>;
    final lat = coords[1] as double;
    final lng = coords[0] as double;
    final newCenter = LatLng(lat, lng);

    final props = suggestion['properties'] as Map<String, dynamic>;
    final name = props['name'] ?? '';
    final city = props['city'] ?? '';
    final displayName = '$name${city.isNotEmpty ? ', $city' : ''}';

    setState(() {
      _center = newCenter;
      _suggestions = [];
      _searchController.text = displayName;
    });

    _mapController.move(newCenter, 14);
    FocusScope.of(context).unfocus();
  }

  Future<void> _determinePosition() async {
    try {
      final pos = await ref.read(locationServiceProvider).getCurrentPosition();
      if (pos == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('search.location_denied'.tr())),
          );
        }
        return;
      }

      if (!mounted) return;
      final newCenter = LatLng(pos.latitude, pos.longitude);
      setState(() {
        _center = newCenter;
        _userLocation = newCenter;
      });
      _mapController.move(newCenter, 15);
      ref.read(debouncedLocationProvider.notifier).updateLocation(newCenter);
    } catch (e) {
      debugPrint('Location error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('search.location_denied'.tr())),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.read(analyticsServiceProvider).logScreenView('Search');

    final shopsAsync = ref.watch(nearbyShopsProvider);

    return Scaffold(
      body: Stack(
        children: [
          Builder(
            builder: (context) {
              final list = shopsAsync.maybeWhen(
                data: (d) => d,
                orElse: () => <ShopDto>[],
              );
              var filtered = list;
              if (_only247) {
                filtered = filtered.where((s) => s.open247).toList();
              }
              if (_onlyOpenNow) {
                filtered = filtered.where((s) => s.isActive).toList();
              }
              if (_minRating > 0) {
                filtered = filtered.where((s) => (s.rating ?? 0) >= _minRating).toList();
              }
              if (_hasRestroom) {
                filtered = filtered.where((s) => s.hasRestroom).toList();
              }
              if (_hasCctv) {
                filtered = filtered.where((s) => s.hasCctv).toList();
              }
              if (_hasClimate) {
                filtered = filtered.where((s) => s.hasClimateControl).toList();
              }
              if (_acceptsLarge) {
                filtered = filtered.where((s) => s.acceptsLargeItems).toList();
              }
              if (_maxPrice > 0) {
                filtered = filtered.where((s) => s.pricePerDay <= _maxPrice).toList();
              }
              if (_sortBy == 'price') {
                filtered = filtered..sort((a, b) => a.pricePerDay.compareTo(b.pricePerDay));
              } else if (_sortBy == 'rating') {
                filtered = filtered..sort((a, b) => -(a.rating ?? 0).compareTo(b.rating ?? 0));
              }

              return SearchMap(
                mapController: _mapController,
                shops: filtered,
                selectedShopIndex: filtered.indexWhere((s) => s.id == _selectedShopId),
                center: _center,
                userPosition: _userLocation,
                onShopSelected: (index) {
                  if (index >= 0 && index < filtered.length) {
                    setState(() => _selectedShopId = filtered[index].id);
                  }
                },
                onPositionChanged: _onMapMoved,
              );
            },
          ),
          if (shopsAsync.isLoading &&
              shopsAsync.maybeWhen(data: (d) => d, orElse: () => null) == null)
            const Center(child: CircularProgressIndicator()),

          Positioned(
            left: 16,
            right: 16,
            top: MediaQuery.of(context).padding.top + 16,
            child: Column(
              children: [
                Semantics(
                  label: 'Search for luggage storage locations',
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 30,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: _searchController,
                      onChanged: _fetchSuggestions,
                      decoration: InputDecoration(
                        hintText: 'search.hint'.tr(),
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.close_rounded),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _suggestions = []);
                                },
                              )
: Semantics(
  label: 'Filtrele',
  child: GestureDetector(
    onTap: _showFilterSheet,
    child: Container(
      margin: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: (_onlyOpenNow || _only247 || _maxPrice > 0)
            ? AppColors.textDark
            : AppColors.brandOrange,
        shape: BoxShape.circle,
      ),
      child: const Icon(
        Icons.tune_rounded,
        color: Colors.white,
        size: 20,
      ),
    ),
  ),
),
                        fillColor: Colors.white.withValues(alpha: 0.95),
                        filled: true,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 20,
                        ),
                      ),
                    ),
                  ),
                ),
                if (_suggestions.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 20,
                        ),
                      ],
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _suggestions.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final s = _suggestions[index];
                        final props = s['properties'] as Map<String, dynamic>;
                        final name = props['name'] ?? '';
                        final city = props['city'] ?? '';
                        return ListTile(
                          leading: const Icon(
                            Icons.location_on_outlined,
                            color: AppColors.brandOrange,
                          ),
                          title: Text(
                            '$name${city.isNotEmpty ? ", $city" : ""}',
                            style: GoogleFonts.outfit(fontSize: 14),
                          ),
                          onTap: () => _selectSuggestion(s),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),

          Positioned(
            left: 0,
            right: 0,
            bottom: 24,
            child: SizedBox(
              height: 140,
              child: shopsAsync.maybeWhen(
                data: (list) {
                  var filtered = list;
                  if (_only247) {
                    filtered = filtered.where((s) => s.open247).toList();
                  }
                  if (_onlyOpenNow) {
                    filtered = filtered.where((s) => s.isActive).toList();
                  }
                  if (_minRating > 0) {
                    filtered = filtered.where((s) => (s.rating ?? 0) >= _minRating).toList();
                  }
                  if (_hasRestroom) {
                    filtered = filtered.where((s) => s.hasRestroom).toList();
                  }
                  if (_hasCctv) {
                    filtered = filtered.where((s) => s.hasCctv).toList();
                  }
                  if (_maxPrice > 0) {
                    filtered = filtered.where((s) => s.pricePerDay <= _maxPrice).toList();
                  }
                  if (filtered.isEmpty) return const SizedBox();

                  return ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final shop = filtered[index];
                      final isSelected = shop.id == _selectedShopId;
                      return ShopPreviewCard(
                        shop: shop,
                        isSelected: isSelected,
                      );
                    },
                  );
                },
                orElse: () => const SizedBox(),
              ),
            ),
          ),

          Positioned(
            right: 16,
            bottom: 180,
            child: FloatingActionButton.small(
              onPressed: _determinePosition,
              backgroundColor: Colors.white,
              foregroundColor: AppColors.brandOrange,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.my_location_rounded),
            ),
          ),
        ],
      ),
    );
  }
}
