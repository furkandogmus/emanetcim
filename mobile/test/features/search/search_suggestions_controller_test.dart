import 'dart:async';

import 'package:bagajpark/core/repositories/geocoding_repository.dart';
import 'package:bagajpark/core/utils/result.dart';
import 'package:bagajpark/features/search/search_suggestions_controller.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Sorgu -> o sorgu icin tamamlanmasi beklenen Completer eslemesi. Testte,
/// once baslayip GECIKEN bir istegin, sonra baslayip daha ERKEN biten bir
/// istegin sonucunu sessizce ezip ezmedigini kontrol edebilmek icin.
class _FakeGeocodingRepository extends GeocodingRepository {
  _FakeGeocodingRepository(this._pending) : super(Dio());

  final Map<String, Completer<Result<List<dynamic>>>> _pending;

  @override
  Future<Result<List<dynamic>>> searchPlaces(String query) {
    final completer = _pending[query];
    if (completer == null) {
      throw StateError('Beklenmeyen sorgu: $query');
    }
    return completer.future;
  }
}

/// Debounce'u atlamak icin dogrudan onQueryChanged yerine controller'in
/// dahili _fetch'ine esdeger sekilde art arda cagiriyoruz: gercek widget
/// akisinda debounce her defasinda sifirlanip yalnizca son sorgu icin bir
/// kez ates aliyor, ama her ates alisin kendi ag yaniti farkli surede
/// donebiliyor -- test ettigimiz de tam olarak bu.
Future<void> _triggerQuery(
  SearchSuggestionsController controller,
  String query,
) async {
  controller.onQueryChanged(query);
  await Future<void>.delayed(const Duration(milliseconds: 600));
}

void main() {
  // Regresyon: search_suggestions_controller.dart _fetch, art arda gelen
  // isteklerde siralama/iptal korumasi tasimiyordu -- yavas bir ag yaniti,
  // daha yeni bir sorgunun sonucunu eskisiyle sessizce eziyordu. Bkz. rapor
  // "medium/state-management" bulgusu.
  test('once baslayip GEC donen eski sorgu, sonra baslayip ERKEN donen yeni '
      "sorgunun state'ini ezmez", () async {
    final istanbul = Completer<Result<List<dynamic>>>();
    final istanbulHavalimani = Completer<Result<List<dynamic>>>();

    final container = ProviderContainer(
      overrides: [
        geocodingRepositoryProvider.overrideWith(
          (ref) => _FakeGeocodingRepository({
            'istanbul': istanbul,
            'istanbul havalimani': istanbulHavalimani,
          }),
        ),
      ],
    );
    addTearDown(container.dispose);

    final controller = container.read(
      searchSuggestionsControllerProvider.notifier,
    );

    await _triggerQuery(controller, 'istanbul');
    await _triggerQuery(controller, 'istanbul havalimani');

    // Once yeni (daha spesifik) sorgu hizlica doner.
    istanbulHavalimani.complete(
      const Success([
        {'properties': 'istanbul havalimani sonucu'},
      ]),
    );
    await Future<void>.delayed(Duration.zero);

    expect(container.read(searchSuggestionsControllerProvider), [
      {'properties': 'istanbul havalimani sonucu'},
    ]);

    // Sonra eski, gecikmis sorgu doner -- state'i EZMEMELI.
    istanbul.complete(
      const Success([
        {'properties': 'istanbul sonucu'},
      ]),
    );
    await Future<void>.delayed(Duration.zero);

    expect(
      container.read(searchSuggestionsControllerProvider),
      [
        {'properties': 'istanbul havalimani sonucu'},
      ],
      reason:
          "gec donen eski sorgu, guncel (yeni sorguya ait) state'i "
          'ezmemeli',
    );
  });
}
