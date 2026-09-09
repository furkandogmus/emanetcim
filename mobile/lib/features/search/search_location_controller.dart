import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../core/repositories/shop_repository.dart';
import '../../core/services/location_service.dart';
import '../../core/utils/error_handler.dart';
import '../../shared/models/shop.dart';

/// Harita merkezi degistikce (surukleme, arama, "konumumu bul") buraya
/// yazilir; `nearbyShopsProvider` bunu izler. Debounce'un kendisi
/// `search_screen.dart`'ta (`_onMapMoved`) -- bu sadece son deger.
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

  final result = await ref
      .watch(shopRepositoryProvider)
      .getNearby(lat: center.latitude, lng: center.longitude);
  return result.fold((data) => data, (error) => throw Exception(error));
});

enum LocationLookupStatus {
  idle,
  locating,
  success,
  serviceDisabled,
  permissionDenied,
}

class LocationSearchState {
  final LocationLookupStatus status;

  /// Yalnizca `status == success` iken dolu.
  final LatLng? position;

  const LocationSearchState({
    this.status = LocationLookupStatus.idle,
    this.position,
  });
}

final searchLocationControllerProvider =
    NotifierProvider<SearchLocationController, LocationSearchState>(
      SearchLocationController.new,
    );

/// "Konumumu bul" akisi (MM-H3): eskiden `search_screen.dart`'ta
/// `setState` + `bool _isLocating` ile widget `State`'inde yonetiliyordu.
/// Widget artik yalnizca bu state'i izler (`ref.watch` spinner icin,
/// `ref.listen` haritayi tasima / snackbar gibi bir-kerelik yan etkiler
/// icin); GPS okuma ve hata dallanmasi burada.
class SearchLocationController extends Notifier<LocationSearchState> {
  @override
  LocationSearchState build() => const LocationSearchState();

  Future<void> determinePosition() async {
    if (state.status == LocationLookupStatus.locating) return;
    state = const LocationSearchState(status: LocationLookupStatus.locating);
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        state = const LocationSearchState(
          status: LocationLookupStatus.serviceDisabled,
        );
        return;
      }

      final pos = await ref.read(locationServiceProvider).getCurrentPosition();
      if (pos == null) {
        state = const LocationSearchState(
          status: LocationLookupStatus.permissionDenied,
        );
        return;
      }

      state = LocationSearchState(
        status: LocationLookupStatus.success,
        position: LatLng(pos.latitude, pos.longitude),
      );
    } catch (e) {
      // Orijinal davranis: GPS servisi disinda kalan HERHANGI bir hata da
      // ayni "izin reddedildi" mesajini gosteriyordu -- burada da oyle.
      debugPrint('Location error: ${getErrorMessage(e)}');
      state = const LocationSearchState(
        status: LocationLookupStatus.permissionDenied,
      );
    }
  }
}
