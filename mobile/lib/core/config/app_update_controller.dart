import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../repositories/app_config_repository.dart';
import '../services/app_update_service.dart';

enum AppUpdateStatus { checking, ok, forceUpdate }

class AppUpdateState {
  final AppUpdateStatus status;
  final String? currentVersion;

  /// Yalnızca opsiyonel (kapatılabilir) güncelleme mevcutsa dolu.
  final String? latestAppVersion;

  const AppUpdateState({
    this.status = AppUpdateStatus.checking,
    this.currentVersion,
    this.latestAppVersion,
  });
}

final appUpdateControllerProvider =
    NotifierProvider<AppUpdateController, AppUpdateState>(
      AppUpdateController.new,
    );

/// Açılışta bir kez sürüm kapısını kontrol eder. `AuthController` ile aynı
/// kalıp (`Future.microtask` + senkron başlangıç durumu): `router.dart`'ın
/// `redirect` callback'i SENKRON, bu yüzden state async build DEĞİL.
class AppUpdateController extends Notifier<AppUpdateState> {
  @override
  AppUpdateState build() {
    Future.microtask(_check);
    return const AppUpdateState();
  }

  Future<void> _check() async {
    const service = AppUpdateService();
    String currentVersion;
    try {
      currentVersion = (await PackageInfo.fromPlatform()).version;
    } catch (_) {
      state = const AppUpdateState(status: AppUpdateStatus.ok);
      return;
    }

    final result = await ref.read(appConfigRepositoryProvider).getConfig();
    final config = result.data;
    // Ag hatasi / sunucu hatasi -> kilitleme, sessizce "guncel" say.
    if (config == null) {
      state = AppUpdateState(
        status: AppUpdateStatus.ok,
        currentVersion: currentVersion,
      );
      return;
    }

    final forceUpdate = service.isBelow(currentVersion, config.minAppVersion);
    final softUpdate =
        !forceUpdate &&
        service.isBelow(currentVersion, config.latestAppVersion);

    state = AppUpdateState(
      status: forceUpdate ? AppUpdateStatus.forceUpdate : AppUpdateStatus.ok,
      currentVersion: currentVersion,
      latestAppVersion: softUpdate ? config.latestAppVersion : null,
    );
  }
}
