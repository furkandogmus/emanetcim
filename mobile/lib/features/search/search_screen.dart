import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../core/services/analytics_service.dart';
import '../../shared/models/shop.dart';
import '../../shared/utils/app_colors.dart';
import 'search_filters_controller.dart';
import 'search_location_controller.dart';
import 'search_suggestions_controller.dart';
import 'widgets/search_map.dart';
import 'widgets/shop_preview_card.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  static const _istanbul = LatLng(41.0082, 28.9784);
  LatLng _center = _istanbul;
  bool _centerInitialized = false;
  LatLng? _userLocation;
  LatLng? _customLocation;
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  String? _selectedShopId;
  bool _didLogScreen = false;
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
    ref.read(searchLocationControllerProvider.notifier).determinePosition();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _onMapMoved(_center);
    });
  }

  @override
  void dispose() {
    _locationDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
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
      _customLocation = newCenter;
      _searchController.text = displayName;
    });
    ref.read(searchSuggestionsControllerProvider.notifier).clear();

    _mapController.move(newCenter, 14);
    ref.read(debouncedLocationProvider.notifier).updateLocation(newCenter);
    FocusScope.of(context).unfocus();
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final filters = ref.read(searchFiltersProvider);
          void updateFilters(SearchFilters Function(SearchFilters) updater) {
            ref.read(searchFiltersProvider.notifier).update(updater);
            setSheetState(() {});
          }

          return Padding(
            padding: EdgeInsets.only(
              top: 24,
              left: 24,
              right: 24,
              bottom: MediaQuery.of(context).viewInsets.bottom + 24,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'search.filter'.tr(),
                    style: Theme.of(context).textTheme.titleLarge!.copyWith(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),

                  SwitchListTile(
                    title: Text(
                      'search.open_now'.tr(),
                      style: Theme.of(context).textTheme.bodyMedium!,
                    ),
                    subtitle: Text(
                      'search.open_now_hint'.tr(),
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall!.copyWith(fontSize: 12),
                    ),
                    value: filters.onlyOpenNow,
                    onChanged: (v) =>
                        updateFilters((f) => f.copyWith(onlyOpenNow: v)),
                    activeThumbColor: AppColors.brandOrange,
                  ),
                  SwitchListTile(
                    title: Text(
                      'search.open_247'.tr(),
                      style: Theme.of(context).textTheme.bodyMedium!,
                    ),
                    subtitle: Text(
                      'search.open_247_hint'.tr(),
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall!.copyWith(fontSize: 12),
                    ),
                    value: filters.only247,
                    onChanged: (v) =>
                        updateFilters((f) => f.copyWith(only247: v)),
                    activeThumbColor: AppColors.brandOrange,
                  ),

                  const SizedBox(height: 8),
                  Text(
                    'search.sort_by'.tr(),
                    style: Theme.of(context).textTheme.titleSmall!.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _filterChip(
                        'search.sort_distance'.tr(),
                        filters.sortBy == 'distance',
                        () => updateFilters(
                          (f) => f.copyWith(sortBy: 'distance'),
                        ),
                      ),
                      _filterChip(
                        'search.sort_price'.tr(),
                        filters.sortBy == 'price',
                        () => updateFilters((f) => f.copyWith(sortBy: 'price')),
                      ),
                      _filterChip(
                        'search.sort_rating'.tr(),
                        filters.sortBy == 'rating',
                        () =>
                            updateFilters((f) => f.copyWith(sortBy: 'rating')),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),
                  Text(
                    'search.amenities'.tr(),
                    style: Theme.of(context).textTheme.titleSmall!.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _filterChip(
                        'search.restroom'.tr(),
                        filters.hasRestroom,
                        () => updateFilters(
                          (f) => f.copyWith(hasRestroom: !f.hasRestroom),
                        ),
                      ),
                      _filterChip(
                        'search.camera'.tr(),
                        filters.hasCctv,
                        () => updateFilters(
                          (f) => f.copyWith(hasCctv: !f.hasCctv),
                        ),
                      ),
                      _filterChip(
                        'search.climate'.tr(),
                        filters.hasClimate,
                        () => updateFilters(
                          (f) => f.copyWith(hasClimate: !f.hasClimate),
                        ),
                      ),
                      _filterChip(
                        'search.large_items'.tr(),
                        filters.acceptsLarge,
                        () => updateFilters(
                          (f) => f.copyWith(acceptsLarge: !f.acceptsLarge),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),
                  Text(
                    'search.min_rating'.tr(),
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium!.copyWith(fontSize: 14),
                  ),
                  Row(
                    children: List.generate(
                      5,
                      (i) => IconButton(
                        icon: Icon(
                          i < filters.minRating
                              ? Icons.star_rounded
                              : Icons.star_outline_rounded,
                          color: Colors.amber,
                        ),
                        onPressed: () => updateFilters(
                          (f) => f.copyWith(
                            minRating: i + 1 == f.minRating ? i : i + 1,
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),
                  Text(
                    'search.max_price'.tr(),
                    style: Theme.of(context).textTheme.titleSmall!.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    initialValue: filters.maxPrice > 0
                        ? filters.maxPrice.toString()
                        : '',
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      hintText: 'search.max_price'.tr(),
                      prefixText: '₺ ',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                    onChanged: (v) => updateFilters(
                      (f) => f.copyWith(maxPrice: double.tryParse(v) ?? 0),
                    ),
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
          );
        },
      ),
    );
  }

  Widget _filterChip(String label, bool selected, VoidCallback onTap) {
    return FilterChip(
      label: Text(
        label,
        style: Theme.of(context).textTheme.bodyMedium!.copyWith(fontSize: 13),
      ),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.brandOrange.withValues(alpha: 0.15),
      checkmarkColor: AppColors.brandOrange,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    );
  }

  void _showAllShopsSheet(BuildContext context, List<ShopDto> shops) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) => DecoratedBox(
          decoration: const BoxDecoration(
            color: Color(0xFFF8FAFC),
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Row(
                  children: [
                    Text(
                      'search.show_results'.tr(),
                      style: Theme.of(context).textTheme.titleLarge!.copyWith(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textDark,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.brandOrange.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${shops.length} Nokta',
                        style: Theme.of(context).textTheme.labelMedium!
                            .copyWith(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppColors.brandOrange,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  itemCount: shops.length,
                  itemBuilder: (context, index) {
                    final shop = shops[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      child: ShopPreviewCard(
                        shop: shop,
                        isSelected: shop.id == _selectedShopId,
                        isFullWidth: true,
                        userLocation: _customLocation ?? _userLocation,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_centerInitialized) {
      _centerInitialized = true;
      final extra = GoRouterState.of(context).extra;
      if (extra is LatLng) {
        _center = extra;
        _onMapMoved(_center);
      }
    }
    if (!_didLogScreen) {
      _didLogScreen = true;
      ref.read(analyticsServiceProvider).logScreenView('Search');
    }

    // "Konumumu bul" (GPS) akisinin sonucu -- bir-kerelik yan etkiler
    // (harita tasima, snackbar) burada; spinner icin `ref.watch` asagida.
    ref.listen<LocationSearchState>(searchLocationControllerProvider, (
      previous,
      next,
    ) {
      if (next.status == LocationLookupStatus.serviceDisabled) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('search.location_disabled'.tr())),
        );
      } else if (next.status == LocationLookupStatus.permissionDenied) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('search.location_denied'.tr())));
      } else if (next.status == LocationLookupStatus.success) {
        final newCenter = next.position;
        if (newCenter == null) return;
        setState(() {
          _center = newCenter;
          _userLocation = newCenter;
          _customLocation = null;
        });
        _mapController.move(newCenter, 15);
        ref.read(debouncedLocationProvider.notifier).updateLocation(newCenter);
      }
    });

    final shopsAsync = ref.watch(filteredShopsProvider);
    final suggestions = ref.watch(searchSuggestionsControllerProvider);
    final isLocating =
        ref.watch(searchLocationControllerProvider).status ==
        LocationLookupStatus.locating;
    final hasActiveFilters = ref.watch(
      searchFiltersProvider.select((f) => f.hasActiveFilters),
    );

    return Scaffold(
      body: Stack(
        children: [
          Builder(
            builder: (context) {
              final filtered = shopsAsync.maybeWhen(
                data: (d) => d,
                orElse: () => <ShopDto>[],
              );

              return SearchMap(
                mapController: _mapController,
                shops: filtered,
                selectedShopIndex: filtered.indexWhere(
                  (s) => s.id == _selectedShopId,
                ),
                center: _center,
                userPosition: _userLocation,
                customPosition: _customLocation,
                onShopSelected: (index) {
                  if (index >= 0 && index < filtered.length) {
                    setState(() => _selectedShopId = filtered[index].id);
                  }
                },
                onPositionChanged: _onMapMoved,
                onTap: (latLng) {
                  setState(() {
                    _customLocation = latLng;
                  });
                  ref
                      .read(debouncedLocationProvider.notifier)
                      .updateLocation(latLng);
                },
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
                      onChanged: (v) => ref
                          .read(searchSuggestionsControllerProvider.notifier)
                          .onQueryChanged(v),
                      decoration: InputDecoration(
                        hintText: 'search.hint'.tr(),
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _SearchSuffixIcon(
                          controller: _searchController,
                          hasActiveFilter: hasActiveFilters,
                          onClear: () {
                            _searchController.clear();
                            ref
                                .read(
                                  searchSuggestionsControllerProvider.notifier,
                                )
                                .clear();
                          },
                          onFilter: _showFilterSheet,
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
                if (suggestions.isNotEmpty)
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
                      itemCount: suggestions.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final s = suggestions[index];
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
                            style: Theme.of(
                              context,
                            ).textTheme.bodyMedium!.copyWith(fontSize: 14),
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
            bottom: 104,
            child: SizedBox(
              height: 180,
              child: shopsAsync.maybeWhen(
                data: (filtered) {
                  if (filtered.isEmpty) return const SizedBox();

                  return GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onVerticalDragEnd: (details) {
                      if (details.primaryVelocity != null &&
                          details.primaryVelocity! < -200) {
                        _showAllShopsSheet(context, filtered);
                      }
                    },
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Drag handle visual indicator
                        GestureDetector(
                          onTap: () => _showAllShopsSheet(context, filtered),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 6,
                            ),
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: const [
                                BoxShadow(
                                  color: Colors.black12,
                                  blurRadius: 8,
                                  offset: Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Container(
                              width: 36,
                              height: 4,
                              decoration: BoxDecoration(
                                color: Colors.grey.shade400,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                        ),
                        // Horizontal List
                        Expanded(
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: filtered.length,
                            itemBuilder: (context, index) {
                              final shop = filtered[index];
                              final isSelected = shop.id == _selectedShopId;
                              return ShopPreviewCard(
                                shop: shop,
                                isSelected: isSelected,
                                userLocation: _customLocation ?? _userLocation,
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  );
                },
                orElse: () => const SizedBox(),
              ),
            ),
          ),

          Positioned(
            right: 16,
            bottom: 290,
            child: FloatingActionButton.small(
              onPressed: () => ref
                  .read(searchLocationControllerProvider.notifier)
                  .determinePosition(),
              backgroundColor: Colors.white,
              foregroundColor: AppColors.brandOrange,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              child: isLocating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.brandOrange,
                        ),
                      ),
                    )
                  : const Icon(Icons.my_location_rounded),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchSuffixIcon extends StatelessWidget {
  const _SearchSuffixIcon({
    required this.controller,
    required this.hasActiveFilter,
    required this.onClear,
    required this.onFilter,
  });

  final TextEditingController controller;
  final bool hasActiveFilter;
  final VoidCallback onClear;
  final VoidCallback onFilter;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        if (controller.text.isNotEmpty) {
          return IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: onClear,
          );
        }
        return Semantics(
          label: 'Filtrele',
          child: GestureDetector(
            onTap: onFilter,
            child: Container(
              margin: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: hasActiveFilter
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
        );
      },
    );
  }
}
