import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/config/env.dart';
import '../../../shared/models/shop.dart';
import '../../../shared/utils/app_colors.dart';

class SearchMap extends StatelessWidget {
  const SearchMap({
    required this.mapController,
    required this.shops,
    required this.selectedShopIndex,
    required this.onShopSelected,
    required this.center,
    required this.onPositionChanged,
    super.key,
  });

  final MapController mapController;
  final List<ShopDto> shops;
  final int selectedShopIndex;
  final ValueChanged<int> onShopSelected;
  final LatLng center;
  final ValueChanged<LatLng> onPositionChanged;

  @override
  Widget build(BuildContext context) {
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
          interactionOptions: const InteractionOptions(
            flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
          ),
        ),
        children: [
          TileLayer(
            urlTemplate: Env.mapTileUrl,
            subdomains: const ['a', 'b', 'c', 'd'],
            userAgentPackageName: 'com.bagajpark.app',
          ),
          MarkerLayer(
markers: shops
                .asMap()
                .entries
                .where((entry) =>
                    entry.value.latitude != null &&
                    entry.value.longitude != null)
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
                    mapController.move(LatLng(s.latitude!, s.longitude!), 14);
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
            }).toList(),
          ),
        ],
      ),
    );
  }
}
