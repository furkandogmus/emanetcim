import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/repositories/geocoding_repository.dart';
import '../../core/utils/error_handler.dart';
import '../../core/utils/result.dart';

final searchSuggestionsControllerProvider =
    NotifierProvider<SearchSuggestionsController, List<dynamic>>(
      SearchSuggestionsController.new,
    );

/// Arama kutusundaki adres/yer onerileri (Photon geocoding, debounce 500ms).
///
/// MM-H3: eskiden `search_screen.dart`'ta `Timer` + `setState` ile widget
/// `State`'inde tutuluyordu. Widget artik yalnizca `onQueryChanged` cagirir
/// ve state'i izler.
class SearchSuggestionsController extends Notifier<List<dynamic>> {
  Timer? _debounce;

  // MM-H3-2: debounce yalnizca BEKLEYEN bir Timer'i iptal edebilir -- 500ms
  // dolup `_fetch` bir kez baslattiktan sonra kullanicinin yazmaya devam
  // etmesiyle tetiklenen sonraki bir `_fetch` ile ayni anda havada kalabilir.
  // Her cagriya bir siralama numarasi vererek, yalnizca EN SON baslatilan
  // istegin yaniti `state`'e yazilir -- yavasca donen eski bir yanit, daha
  // yeni (ve daha hizli donen) bir sorgunun sonucunu sessizce ezemez.
  int _requestId = 0;

  @override
  List<dynamic> build() {
    ref.onDispose(() => _debounce?.cancel());
    return const [];
  }

  void onQueryChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () => _fetch(query));
  }

  Future<void> _fetch(String query) async {
    final myRequestId = ++_requestId;
    if (query.length < 3) {
      state = const [];
      return;
    }
    final result = await ref
        .read(geocodingRepositoryProvider)
        .searchPlaces(query);
    if (myRequestId != _requestId) {
      // Bu arada daha yeni bir sorgu baslatildi; bu yanit artik gecersiz.
      return;
    }
    if (result is Success<List<dynamic>>) {
      state = result.value;
    } else if (result is Failure<List<dynamic>>) {
      // Orijinal davranis: oneri aramasi basarisiz olunca kullaniciya
      // gosterilmez (sessiz kalir, eski oneriler ekranda kalir) -- sadece
      // hata gelistirici log'una duser. MM-H2: artik standart
      // `getErrorMessage` ile formatlaniyor.
      debugPrint(
        'Suggestions error: '
        '${getErrorMessage(result.exception, fallback: result.message)}',
      );
    }
  }

  void clear() {
    _debounce?.cancel();
    state = const [];
  }
}
