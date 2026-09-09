import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/shop.dart';
import 'search_location_controller.dart' show nearbyShopsProvider;

/// Arama ekrani filtre girdileri. Degismez (immutable) -- `==`/`hashCode`
/// alan bazli tanimli, boylece bir filtre `copyWith` ile "degismeden"
/// yeniden atanirsa (`state = state.copyWith()`) Riverpod'un varsayilan
/// `updateShouldNotify` (`previous != next`) kontrolu dinleyicileri
/// tetiklemez -- asagidaki `filteredShopsProvider`'in gereksiz yere yeniden
/// hesaplanmamasinin (PF-H2 memoizasyon) temel dayanagi budur.
class SearchFilters {
  final bool onlyOpenNow;
  final bool only247;
  final int minRating;
  final double maxPrice;
  final bool hasRestroom;
  final bool hasCctv;
  final bool hasClimate;
  final bool acceptsLarge;
  final String sortBy; // distance | price | rating

  const SearchFilters({
    this.onlyOpenNow = false,
    this.only247 = false,
    this.minRating = 0,
    this.maxPrice = 0,
    this.hasRestroom = false,
    this.hasCctv = false,
    this.hasClimate = false,
    this.acceptsLarge = false,
    this.sortBy = 'distance',
  });

  bool get hasActiveFilters =>
      onlyOpenNow ||
      only247 ||
      minRating > 0 ||
      maxPrice > 0 ||
      hasRestroom ||
      hasCctv ||
      hasClimate ||
      acceptsLarge ||
      sortBy != 'distance';

  SearchFilters copyWith({
    bool? onlyOpenNow,
    bool? only247,
    int? minRating,
    double? maxPrice,
    bool? hasRestroom,
    bool? hasCctv,
    bool? hasClimate,
    bool? acceptsLarge,
    String? sortBy,
  }) {
    return SearchFilters(
      onlyOpenNow: onlyOpenNow ?? this.onlyOpenNow,
      only247: only247 ?? this.only247,
      minRating: minRating ?? this.minRating,
      maxPrice: maxPrice ?? this.maxPrice,
      hasRestroom: hasRestroom ?? this.hasRestroom,
      hasCctv: hasCctv ?? this.hasCctv,
      hasClimate: hasClimate ?? this.hasClimate,
      acceptsLarge: acceptsLarge ?? this.acceptsLarge,
      sortBy: sortBy ?? this.sortBy,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SearchFilters &&
          onlyOpenNow == other.onlyOpenNow &&
          only247 == other.only247 &&
          minRating == other.minRating &&
          maxPrice == other.maxPrice &&
          hasRestroom == other.hasRestroom &&
          hasCctv == other.hasCctv &&
          hasClimate == other.hasClimate &&
          acceptsLarge == other.acceptsLarge &&
          sortBy == other.sortBy);

  @override
  int get hashCode => Object.hash(
    onlyOpenNow,
    only247,
    minRating,
    maxPrice,
    hasRestroom,
    hasCctv,
    hasClimate,
    acceptsLarge,
    sortBy,
  );
}

final searchFiltersProvider =
    NotifierProvider<SearchFiltersController, SearchFilters>(
      SearchFiltersController.new,
    );

class SearchFiltersController extends Notifier<SearchFilters> {
  @override
  SearchFilters build() => const SearchFilters();

  void update(SearchFilters Function(SearchFilters current) updater) {
    state = updater(state);
  }

  void reset() => state = const SearchFilters();
}

List<ShopDto> applySearchFilters(List<ShopDto> list, SearchFilters f) {
  // Savunmaci kopya: `list` cogunlukla `nearbyShopsProvider`'in AsyncData
  // icinde onbelleklediği ayni liste nesnesidir (bkz. `filteredShopsProvider`
  // altindaki not). Hicbir where-filtresi aktif degilse asagidaki hicbir
  // `.where().toList()` calismaz ve `filtered` `list` ile ayni referansta
  // kalirdi; sonra `sortBy == 'price'/'rating'` icin cagrilan `..sort(...)`
  // Dart'ta listeyi YERINDE sirali, provider'in onbellekteki listesini
  // kalici olarak bozardi. `List<ShopDto>.of(list)` her zaman yeni bir kopya
  // aciyor, boylece `nearbyShopsProvider`'in state'i asla mutasyona ugramaz.
  var filtered = List<ShopDto>.of(list);
  if (f.only247) filtered = filtered.where((s) => s.open247).toList();
  if (f.onlyOpenNow) filtered = filtered.where((s) => s.isActive).toList();
  if (f.minRating > 0) {
    filtered = filtered.where((s) => (s.rating ?? 0) >= f.minRating).toList();
  }
  if (f.hasRestroom) filtered = filtered.where((s) => s.hasRestroom).toList();
  if (f.hasCctv) filtered = filtered.where((s) => s.hasCctv).toList();
  if (f.hasClimate) {
    filtered = filtered.where((s) => s.hasClimateControl).toList();
  }
  if (f.acceptsLarge) {
    filtered = filtered.where((s) => s.acceptsLargeItems).toList();
  }
  if (f.maxPrice > 0) {
    filtered = filtered.where((s) => s.pricePerDay <= f.maxPrice).toList();
  }
  if (f.sortBy == 'price') {
    filtered = filtered..sort((a, b) => a.pricePerDay.compareTo(b.pricePerDay));
  } else if (f.sortBy == 'rating') {
    filtered = filtered
      ..sort((a, b) => -(a.rating ?? 0).compareTo(b.rating ?? 0));
  }
  return filtered;
}

/// `nearbyShopsProvider` (konum bazli ham liste) + `searchFiltersProvider`
/// (filtre girdileri) uzerinden turetilir. Riverpod bir `Provider`'i yalnizca
/// izledigi kaynaklardan biri GERCEKTEN degistiginde yeniden calistirir --
/// widget'in `_isLocating` / oneri listesi gibi ILGISIZ nedenlerle yeniden
/// build edilmesi burayi TETIKLEMEZ. Eskiden `_applyFilters` widget'in
/// `build()`'i icinde her cagrildiginda `.where().toList()` + `.sort()`
/// calistiriyordu (PF-H2); artik sonuc, girdiler degismedigi surece
/// Riverpod tarafindan onbelleklenir.
final filteredShopsProvider = Provider<AsyncValue<List<ShopDto>>>((ref) {
  final shopsAsync = ref.watch(nearbyShopsProvider);
  final filters = ref.watch(searchFiltersProvider);
  return shopsAsync.whenData((list) => applySearchFilters(list, filters));
});
