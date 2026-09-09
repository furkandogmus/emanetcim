import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../repositories/feature_flags_repository.dart';

final featureFlagsControllerProvider =
    NotifierProvider<FeatureFlagsController, Map<String, bool>>(
      FeatureFlagsController.new,
    );

/// Uzaktan yapilandirma (backend `FeatureFlag` tablosu). Eksik anahtar =
/// KAPALI (backend ile ayni varsayilan) -- ag hatasinda da bos harita
/// donunce her bayrak guvenli tarafta (kapali) kalir.
///
/// Oturum degisince (giris/cikis) yeniden cekilir: rollout yuzdesi ve izin
/// listesi kullanici kimligine gore degerlendiriliyor, yani ayni bayrak
/// misafirken ve giris yapinca farkli sonuc verebilir.
class FeatureFlagsController extends Notifier<Map<String, bool>> {
  @override
  Map<String, bool> build() {
    Future.microtask(_load);
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.session?.id != next.session?.id) {
        Future.microtask(_load);
      }
    });
    return const {};
  }

  Future<void> _load() async {
    final result = await ref.read(featureFlagsRepositoryProvider).getFlags();
    if (result.isSuccess) state = result.data!;
  }
}
