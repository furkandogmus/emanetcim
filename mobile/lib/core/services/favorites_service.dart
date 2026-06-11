import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final favoritesProvider = NotifierProvider<FavoritesNotifier, Set<String>>(
  FavoritesNotifier.new,
);

class FavoritesNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() {
    _load();
    return {};
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList('favorite_shops') ?? [];
    state = list.toSet();
  }

  Future<void> toggle(String shopId) async {
    final prefs = await SharedPreferences.getInstance();
    final updated = Set<String>.from(state);
    if (updated.contains(shopId)) {
      updated.remove(shopId);
    } else {
      updated.add(shopId);
    }
    state = updated;
    await prefs.setStringList('favorite_shops', updated.toList());
  }

  bool isFavorite(String shopId) => state.contains(shopId);
}
