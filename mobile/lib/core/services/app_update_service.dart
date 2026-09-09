/// `x.y.z` bicimli surumleri karsilastirir. Beklenmeyen bicim (bos, harf,
/// eksik parca) HER ZAMAN "guncel" sonucunu dogurur — sunucudan gelen bozuk
/// bir deger kullaniciyi uygulamadan KILITLEMEMELI.
class AppUpdateService {
  const AppUpdateService();

  List<int>? _parse(String version) {
    final core = version.split('+').first;
    final parts = core.split('.');
    if (parts.length != 3) return null;
    final nums = <int>[];
    for (final p in parts) {
      final n = int.tryParse(p);
      if (n == null) return null;
      nums.add(n);
    }
    return nums;
  }

  /// `current < floor` ise `true`. `floor` `null`/geçersizse `false`.
  bool isBelow(String current, String? floor) {
    if (floor == null) return false;
    final a = _parse(current);
    final b = _parse(floor);
    if (a == null || b == null) return false;
    for (var i = 0; i < 3; i++) {
      if (a[i] != b[i]) return a[i] < b[i];
    }
    return false;
  }
}
