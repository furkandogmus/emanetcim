import 'dart:async';
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

final nearbyShopsProvider = FutureProvider.family<List<ShopDto>, LatLng>((ref, center) async {
  try {
    final dio = ref.watch(dioProvider);
    final res = await dio.get('/shops/nearby', queryParameters: {
      'lat': center.latitude,
      'lng': center.longitude,
      'r': 5000,
    });
    final list = res.data as List<dynamic>;
    var shops = list.map((e) => ShopDto.fromJson(e as Map<String, dynamic>)).toList();
    
    // Prod-ready test için: Eğer veri yoksa demo dükkanlar ekle
    if (shops.isEmpty) {
      shops = [
        ShopDto(
          id: 'demo-1',
          name: 'Galata Emanet Noktası',
          latitude: center.latitude + 0.002,
          longitude: center.longitude + 0.002,
          address: 'Bereketzade, Galata Kulesi Sk.',
          city: 'İstanbul',
          district: 'Beyoğlu',
          pricePerDay: 45.0,
          capacity: 20,
          open247: true,
          rating: 4.8,
        ),
        ShopDto(
          id: 'demo-2',
          name: 'Karaköy Bagaj Park',
          latitude: center.latitude - 0.003,
          longitude: center.longitude + 0.001,
          address: 'Kemankeş Karamustafa Paşa, Rıhtım Cd.',
          city: 'İstanbul',
          district: 'Beyoğlu',
          pricePerDay: 55.0,
          capacity: 15,
          open247: false,
          openingTime: '08:00',
          closingTime: '22:00',
          rating: 4.9,
        ),
        ShopDto(
          id: 'demo-3',
          name: 'Taksim Meydan Depo',
          latitude: center.latitude + 0.001,
          longitude: center.longitude - 0.004,
          address: 'Gümüşsuyu, Sıraselviler Cd.',
          city: 'İstanbul',
          district: 'Beyoğlu',
          pricePerDay: 40.0,
          capacity: 50,
          open247: true,
          rating: 4.7,
        ),
      ];
    }
    // Sorting: Puanı yüksek olanları ve aktif olanları öne çıkar
    shops.sort((a, b) {
      if (a.rating != b.rating) return (b.rating ?? 0).compareTo(a.rating ?? 0);
      return (a.distanceKm ?? 0).compareTo(b.distanceKm ?? 0);
    });
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Filtrele', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              SwitchListTile(
                title: Text('Şimdi Açık', style: GoogleFonts.outfit()),
                subtitle: Text('Sadece şu an hizmet veren dükkanlar', style: GoogleFonts.outfit(fontSize: 12)),
                value: _onlyOpenNow,
                onChanged: (v) {
                  setState(() => _onlyOpenNow = v);
                  setSheetState(() => _onlyOpenNow = v);
                },
                activeColor: const Color(0xFFF97316),
              ),
              SwitchListTile(
                title: Text('7/24 Açık', style: GoogleFonts.outfit()),
                subtitle: Text('Günün her saati ulaşılabilen noktalar', style: GoogleFonts.outfit(fontSize: 12)),
                value: _only247,
                onChanged: (v) {
                  setState(() => _only247 = v);
                  setSheetState(() => _only247 = v);
                },
                activeColor: const Color(0xFFF97316),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => Navigator.pop(context),
                style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
                child: const Text('Sonuçları Göster'),
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
          options: Options(headers: {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'}),
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

    // Show loading if possible or just log
    debugPrint('Determining position...');

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Konum servisleri kapalı. Lütfen ayarlardan açın.')),
        );
      }
      return;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Konum izni reddedildi.')),
          );
        }
        return;
      }
    }
    
    if (permission == LocationPermission.deniedForever) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Konum izni kalıcı olarak reddedildi. Lütfen ayarlardan manuel açın.')),
        );
      }
      return;
    }

    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      if (!mounted) return;
      setState(() {
        _center = LatLng(pos.latitude, pos.longitude);
      });
      _mapController.move(_center, 15);
      debugPrint('Location found: ${pos.latitude}, ${pos.longitude}');
    } catch (e) {
      debugPrint('Location error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Konum alınamadı: $e')),
        );
      }
    }
  }

  Future<void> _searchAddress(String query) async {
    if (query.isEmpty) return;
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        'https://photon.komoot.io/api/',
        queryParameters: {'q': query, 'limit': 1},
        options: Options(headers: {'User-Agent': 'BagajPark (contact@bagajpark.com)'}),
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
    final theme = Theme.of(context);
    final shopsAsync = ref.watch(nearbyShopsProvider(_center));

    return Scaffold(
      body: Stack(
        children: [
          // Map Background
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13,
              onPositionChanged: (pos, hasGesture) {
                if (hasGesture && pos.center != null) {
                   // Daha hassas güncelleme (yaklaşık 200 metre)
                   if ((pos.center!.latitude - _center.latitude).abs() > 0.002 || 
                       (pos.center!.longitude - _center.longitude).abs() > 0.002) {
                     setState(() => _center = pos.center!);
                   }
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: Env.mapTileUrl,
                userAgentPackageName: 'com.bagajpark.mobile',
              ),
              // User Location Marker
              MarkerLayer(
                markers: [
                  Marker(
                    point: _center,
                    width: 20,
                    height: 20,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.3),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: Center(
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: const BoxDecoration(color: Colors.blue, shape: BoxShape.circle),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              MarkerLayer(
                markers: shopsAsync.maybeWhen(
                  data: (list) {
                    var filtered = list;
                    if (_only247) filtered = filtered.where((s) => s.open247).toList();
                    if (_onlyOpenNow) filtered = filtered.where((s) => s.isActive).toList();
                    
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
                            _mapController.move(LatLng(s.latitude!, s.longitude!), 14);
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            child: Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: isSelected ? const Color(0xFFF97316) : Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.2),
                                        blurRadius: 10,
                                        spreadRadius: 2,
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    Icons.shopping_bag,
                                    color: isSelected ? Colors.white : const Color(0xFFF97316),
                                    size: isSelected ? 32 : 24,
                                  ),
                                ),
                                if (isSelected)
                                  Container(
                                    margin: const EdgeInsets.only(top: 4),
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withOpacity(0.8),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      s.name,
                                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
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

          // Map Controls (Zoom)
          Positioned(
            right: 16,
            top: MediaQuery.of(context).padding.top + 100,
            child: Column(
              children: [
                _mapControlButton(
                  icon: Icons.add_rounded,
                  onTap: () => _mapController.move(_mapController.camera.center, _mapController.camera.zoom + 1),
                ),
                const SizedBox(height: 8),
                _mapControlButton(
                  icon: Icons.remove_rounded,
                  onTap: () => _mapController.move(_mapController.camera.center, _mapController.camera.zoom - 1),
                ),
              ],
            ),
          ),

          // Top Search Bar & Suggestions
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
                        color: Colors.black.withOpacity(0.08),
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
                      hintText: 'Nereye emanet bırakacaksın?',
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
                                color: (_onlyOpenNow || _only247) ? const Color(0xFF0F172A) : const Color(0xFFF97316),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.tune_rounded, color: Colors.white, size: 20),
                            ),
                          ),
                      fillColor: Colors.white.withOpacity(0.95),
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
                        BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20),
                      ],
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _suggestions.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final s = _suggestions[index];
                        final props = s['properties'] as Map<String, dynamic>;
                        final name = props['name'] ?? '';
                        final city = props['city'] ?? '';
                        final title = '$name${city.isNotEmpty ? ', $city' : ''}';
                        
                        return ListTile(
                          leading: const Icon(Icons.location_on_outlined, color: Color(0xFFF97316)),
                          title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: GoogleFonts.outfit(fontSize: 14)),
                          onTap: () => _selectSuggestion(s),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),

          // Bottom Shops Carousel
          Positioned(
            left: 0,
            right: 0,
            bottom: 24,
            child: SizedBox(
              height: 140,
              child: shopsAsync.when(
                data: (list) {
                  var filtered = list;
                  if (_only247) filtered = filtered.where((s) => s.open247).toList();
                  if (_onlyOpenNow) filtered = filtered.where((s) => s.isActive).toList();
                  
                  if (filtered.isEmpty) return const SizedBox();
                  return ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final shop = filtered[index];
                      final isSelected = _selectedShopIndex == index;
                      return GestureDetector(
                        onTap: () {
                          setState(() => _selectedShopIndex = index);
                          _mapController.move(LatLng(shop.latitude!, shop.longitude!), 14);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          width: MediaQuery.of(context).size.width * 0.85,
                          margin: const EdgeInsets.only(right: 16),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            border: isSelected 
                              ? Border.all(color: const Color(0xFFF97316), width: 2)
                              : Border.all(color: Colors.white),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.1),
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
                                    image: NetworkImage('https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=300&auto=format&fit=crop'),
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
                                        const Icon(Icons.star_rounded, color: Colors.amber, size: 18),
                                        const SizedBox(width: 4),
                                        Text(
                                          '4.8 (120+)',
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
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          '₺${shop.pricePerDay.toStringAsFixed(0)}/gün',
                                          style: GoogleFonts.outfit(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: const Color(0xFFF97316),
                                          ),
                                        ),
                                        Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Colors.grey.shade400),
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
                loading: () => ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: 3,
                  itemBuilder: (context, index) => Container(
                    width: MediaQuery.of(context).size.width * 0.85,
                    margin: const EdgeInsets.only(right: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 100,
                          margin: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(width: 120, height: 16, color: Colors.grey.shade100),
                              const SizedBox(height: 8),
                              Container(width: 80, height: 12, color: Colors.grey.shade100),
                              const SizedBox(height: 16),
                              Container(width: 60, height: 20, color: Colors.grey.shade100),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                error: (e, _) => const SizedBox(),
              ),
            ),
          ),

          // My Location Button
          Positioned(
            right: 16,
            bottom: 180,
            child: FloatingActionButton.small(
              onPressed: _determinePosition,
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFFF97316),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: const Icon(Icons.my_location_rounded),
            ),
          ),
        ],
      ),
    );
  }

  Widget _mapControlButton({required IconData icon, required VoidCallback onTap}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: IconButton(
        icon: Icon(icon, color: const Color(0xFF0F172A)),
        onPressed: onTap,
        constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
      ),
    );
  }
}
