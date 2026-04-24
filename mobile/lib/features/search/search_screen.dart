import 'dart:async';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:dio/dio.dart';

import '../../core/api/api_client.dart';
import '../../core/config/env.dart';
import '../../shared/models/shop.dart';

final nearbyShopsProvider = FutureProvider.family<List<ShopDto>, LatLng>((
  ref,
  center,
) async {
  try {
    final dio = ref.watch(dioProvider);
    final res = await dio.get(
      '/shops/nearby',
      queryParameters: {
        'lat': center.latitude,
        'lng': center.longitude,
        'r': 5000,
      },
    );
    final list = res.data as List<dynamic>;
    var shops = list
        .map((e) => ShopDto.fromJson(e as Map<String, dynamic>))
        .toList();

    return shops;
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
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  int _selectedShopIndex = -1;
  List<dynamic> _suggestions = [];
  bool _isSearching = false;
  bool _onlyOpenNow = false;
  bool _only247 = false;
  Timer? _debounce;

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'search.filter'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                title: Text(
                  'search.open_now'.tr(),
                  style: GoogleFonts.outfit(),
                ),
                subtitle: Text(
                  'search.open_now_hint'.tr(),
                  style: GoogleFonts.outfit(fontSize: 12),
                ),
                value: _onlyOpenNow,
                onChanged: (v) {
                  setState(() => _onlyOpenNow = v);
                  setSheetState(() => _onlyOpenNow = v);
                },
                activeThumbColor: const Color(0xFFF97316),
              ),
              SwitchListTile(
                title: Text(
                  'search.open_247'.tr(),
                  style: GoogleFonts.outfit(),
                ),
                subtitle: Text(
                  'search.open_247_hint'.tr(),
                  style: GoogleFonts.outfit(fontSize: 12),
                ),
                value: _only247,
                onChanged: (v) {
                  setState(() => _only247 = v);
                  setSheetState(() => _only247 = v);
                },
                activeThumbColor: const Color(0xFFF97316),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => Navigator.pop(context),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 50),
                ),
                child: Text('search.show_results'.tr()),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _determinePosition();
  }

  @override
  void dispose() {
    _debounce?.cancel();
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
        final dio = ref.read(dioProvider);
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
      _isSearching = false;
      _searchController.text = displayName;
    });

    _mapController.move(newCenter, 14);
    FocusScope.of(context).unfocus();
  }

  Future<void> _determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('search.location_service_disabled'.tr())),
        );
      }
      return;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return;
    }

    if (permission == LocationPermission.deniedForever) return;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      if (!mounted) return;
      setState(() {
        _center = LatLng(position.latitude, position.longitude);
      });
      _mapController.move(_center, 15);
    } catch (e) {
      debugPrint('Location error: $e');
    }
  }

  Future<void> _searchAddress(String query) async {
    if (query.isEmpty) return;
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        'https://photon.komoot.io/api/',
        queryParameters: {'q': query, 'limit': 1},
        options: Options(
          headers: {'User-Agent': 'BagajPark (contact@bagajpark.com)'},
        ),
      );
      final features = res.data['features'] as List<dynamic>;
      if (features.isNotEmpty) {
        final first = features[0];
        final coords = first['geometry']['coordinates'] as List<dynamic>;
        final lat = coords[1] as double;
        final lng = coords[0] as double;
        final newCenter = LatLng(lat, lng);

        setState(() {
          _center = newCenter;
          _isSearching = false;
        });
        _mapController.move(newCenter, 14);
      }
    } catch (e) {
      debugPrint('Geocoding error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final shopsAsync = ref.watch(nearbyShopsProvider(_center));

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13,
              onPositionChanged: (pos, hasGesture) {
                if (hasGesture) {
                  if ((pos.center.latitude - _center.latitude).abs() > 0.002 ||
                      (pos.center.longitude - _center.longitude).abs() >
                          0.002) {
                    setState(() => _center = pos.center);
                  }
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: Env.mapTileUrl,
                userAgentPackageName: 'com.bagajpark.mobile',
              ),
              MarkerLayer(
                markers: shopsAsync.maybeWhen(
                  data: (list) {
                    var filtered = list;
                    if (_only247) {
                      filtered = filtered.where((s) => s.open247).toList();
                    }
                    if (_onlyOpenNow) {
                      filtered = filtered.where((s) => s.isActive).toList();
                    }

                    return filtered.asMap().entries.map((entry) {
                      final index = entry.key;
                      final s = entry.value;
                      final isSelected = _selectedShopIndex == index;
                      return Marker(
                        point: LatLng(s.latitude!, s.longitude!),
                        width: isSelected ? 120 : 60,
                        height: isSelected ? 120 : 60,
                        child: GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            setState(() => _selectedShopIndex = index);
                            _mapController.move(
                              LatLng(s.latitude!, s.longitude!),
                              14,
                            );
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            child: Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? const Color(0xFFF97316)
                                        : Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(
                                          alpha: 0.2,
                                        ),
                                        blurRadius: 10,
                                        spreadRadius: 2,
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    Icons.shopping_bag,
                                    color: isSelected
                                        ? Colors.white
                                        : const Color(0xFFF97316),
                                    size: isSelected ? 32 : 24,
                                  ),
                                ),
                                if (isSelected)
                                  Container(
                                    margin: const EdgeInsets.only(top: 4),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(
                                        alpha: 0.8,
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      s.name,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList();
                  },
                  orElse: () => [],
                ),
              ),
            ],
          ),

          Positioned(
            left: 16,
            right: 16,
            top: MediaQuery.of(context).padding.top + 16,
            child: Column(
              children: [
                Container(
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
                    onSubmitted: (v) => _searchAddress(v),
                    onTap: () => setState(() => _isSearching = true),
                    style: GoogleFonts.outfit(),
                    decoration: InputDecoration(
                      hintText: 'search.hint'.tr(),
                      prefixIcon: const Icon(Icons.search_rounded, size: 28),
                      suffixIcon: _isSearching
                          ? IconButton(
                              icon: const Icon(Icons.close_rounded),
                              onPressed: () {
                                setState(() {
                                  _isSearching = false;
                                  _suggestions = [];
                                  _searchController.clear();
                                });
                                FocusScope.of(context).unfocus();
                              },
                            )
                          : GestureDetector(
                              onTap: _showFilterSheet,
                              child: Container(
                                margin: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: (_onlyOpenNow || _only247)
                                      ? const Color(0xFF0F172A)
                                      : const Color(0xFFF97316),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.tune_rounded,
                                  color: Colors.white,
                                  size: 20,
                                ),
                              ),
                            ),
                      fillColor: Colors.white.withValues(alpha: 0.95),
                      filled: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 20),
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
                            color: Color(0xFFF97316),
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
                  if (filtered.isEmpty) return const SizedBox();

                  return ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final shop = filtered[index];
                      final isSelected = _selectedShopIndex == index;
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
                              color: isSelected
                                  ? const Color(0xFFF97316)
                                  : Colors.white,
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
                                  image: const DecorationImage(
                                    image: NetworkImage(
                                      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=300&auto=format&fit=crop',
                                    ),
                                    fit: BoxFit.cover,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      shop.name,
                                      style: GoogleFonts.outfit(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF0F172A),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.star_rounded,
                                          color: Colors.amber,
                                          size: 18,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${shop.rating} (120+)',
                                          style: GoogleFonts.outfit(
                                            fontSize: 14,
                                            color: Colors.grey.shade600,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const Spacer(),
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          '₺${shop.pricePerDay.toStringAsFixed(0)}${'search.day_unit'.tr()}',
                                          style: GoogleFonts.outfit(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: const Color(0xFFF97316),
                                          ),
                                        ),
                                        Icon(
                                          Icons.arrow_forward_ios_rounded,
                                          size: 16,
                                          color: Colors.grey.shade400,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
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
              foregroundColor: const Color(0xFFF97316),
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
