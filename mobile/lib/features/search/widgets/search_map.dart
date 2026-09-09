import 'dart:async' show unawaited;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_vector_tiles/flutter_map_vector_tiles.dart' as vt;
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/map_style.dart';
import '../../../shared/models/shop.dart';
import '../../../shared/utils/app_colors.dart';

class SearchMap extends StatefulWidget {
  const SearchMap({
    required this.mapController,
    required this.shops,
    required this.selectedShopIndex,
    required this.onShopSelected,
    required this.center,
    required this.onPositionChanged,
    this.userPosition,
    this.customPosition,
    this.onTap,
    super.key,
  });

  final MapController mapController;
  final List<ShopDto> shops;
  final int selectedShopIndex;
  final ValueChanged<int> onShopSelected;
  final LatLng center;
  final ValueChanged<LatLng> onPositionChanged;
  final LatLng? userPosition;
  final LatLng? customPosition;
  final ValueChanged<LatLng>? onTap;

  @override
  State<SearchMap> createState() => _SearchMapState();
}

class _SearchMapState extends State<SearchMap> {
  vt.Style? _style;

  @override
  void initState() {
    super.initState();
    unawaited(_loadStyle());
  }

  Future<void> _loadStyle() async {
    final style = await const vt.StyleReader(uri: MapStyle.styleUrl).read();
    if (!mounted) {
      style.dispose();
      return;
    }
    setState(() => _style = style);
  }

  @override
  void dispose() {
    _style?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mapController = widget.mapController;
    final shops = widget.shops;
    final selectedShopIndex = widget.selectedShopIndex;
    final onShopSelected = widget.onShopSelected;
    final center = widget.center;
    final onPositionChanged = widget.onPositionChanged;
    final userPosition = widget.userPosition;
    final customPosition = widget.customPosition;
    final onTap = widget.onTap;
    final style = _style;
    return Semantics(
      label: 'Interactive map showing luggage storage locations',
      child: FlutterMap(
        mapController: mapController,
        options: MapOptions(
          initialCenter: center,
          onPositionChanged: (pos, hasGesture) {
            if (hasGesture) {
              onPositionChanged(pos.center);
            }
          },
          onTap: (tapPosition, latLng) {
            onTap?.call(latLng);
          },
          interactionOptions: const InteractionOptions(
            flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
          ),
        ),
        children: [
          if (style != null)
            vt.VectorTileLayer(
              theme: style.theme,
              tileProviders: style.providers,
              rasterSources: style.rasterSources,
              sprites: style.sprites,
            )
          else
            ColoredBox(color: Colors.grey.shade200),
          MarkerLayer(
            markers: [
              if (userPosition != null)
                Marker(
                  point: userPosition,
                  width: 40,
                  height: 40,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: Colors.blue.withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                      ),
                      Container(
                        width: 14,
                        height: 14,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black26,
                              blurRadius: 4,
                              offset: Offset(0, 2),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: Colors.blue,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ),
                ),
              if (customPosition != null)
                Marker(
                  point: customPosition,
                  width: 50,
                  height: 50,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: Colors.redAccent.withValues(alpha: 0.25),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const Icon(
                        Icons.location_on_rounded,
                        color: Colors.redAccent,
                        size: 36,
                      ),
                    ],
                  ),
                ),
              ...shops
                  .asMap()
                  .entries
                  .where(
                    (entry) =>
                        entry.value.latitude != null &&
                        entry.value.longitude != null,
                  )
                  .map((entry) {
                    final index = entry.key;
                    final s = entry.value;
                    final isSelected = selectedShopIndex == index;

                    return Marker(
                      point: LatLng(s.latitude!, s.longitude!),
                      width: isSelected ? 100 : 50,
                      height: isSelected ? 100 : 50,
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          onShopSelected(index);
                          mapController.move(
                            LatLng(s.latitude!, s.longitude!),
                            14,
                          );
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // Shadow
                              if (isSelected)
                                Container(
                                  width: 60,
                                  height: 60,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppColors.brandOrange.withValues(
                                          alpha: 0.3,
                                        ),
                                        blurRadius: 20,
                                        spreadRadius: 5,
                                      ),
                                    ],
                                  ),
                                ),
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? AppColors.brandOrange
                                          : Colors.white,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: isSelected
                                            ? Colors.white
                                            : AppColors.brandOrange,
                                        width: 2,
                                      ),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Colors.black12,
                                          blurRadius: 10,
                                          offset: Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Icon(
                                      Icons.luggage_rounded,
                                      color: isSelected
                                          ? Colors.white
                                          : AppColors.brandOrange,
                                      size: isSelected ? 28 : 20,
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
                                        color: AppColors.textDark,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        s.name,
                                        style: GoogleFonts.outfit(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
            ],
          ),
          RichAttributionWidget(
            // Kucuk "i" simgesi -- daimi metin cubugu degil. showFlutterMapAttribution
            // kapali: kutuphanenin kendi reklami degil, yalnizca lisans zorunlulugu.
            // Sol alt: search_screen.dart'taki "konumum" FAB'i sag altta, ustune binmesin.
            alignment: AttributionAlignment.bottomLeft,
            showFlutterMapAttribution: false,
            attributions: [
              TextSourceAttribution(
                MapStyle.attributionText,
                onTap: () => launchUrl(Uri.parse(MapStyle.attributionUrl)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
