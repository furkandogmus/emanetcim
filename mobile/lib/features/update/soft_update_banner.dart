import 'dart:io' show Platform;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/app_update_controller.dart';
import '../../core/config/store_links.dart';

const _dismissedKey = 'dismissed_soft_update_version';

/// Kapatılabilir "yeni sürüm var" bandı. Kapatma tercihi SÜRÜME göre
/// hatırlanır — aynı sürüm için tekrar sormaz, ama bir sonraki
/// `latestAppVersion` artışında yeniden görünür.
class SoftUpdateBanner extends ConsumerStatefulWidget {
  const SoftUpdateBanner({super.key});

  @override
  ConsumerState<SoftUpdateBanner> createState() => _SoftUpdateBannerState();
}

class _SoftUpdateBannerState extends ConsumerState<SoftUpdateBanner> {
  String? _dismissedVersion;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;
      setState(() => _dismissedVersion = prefs.getString(_dismissedKey) ?? '');
    });
  }

  Future<void> _dismiss(String version) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dismissedKey, version);
    if (mounted) setState(() => _dismissedVersion = version);
  }

  @override
  Widget build(BuildContext context) {
    final latest = ref.watch(appUpdateControllerProvider).latestAppVersion;
    if (latest == null || latest == _dismissedVersion) {
      return const SizedBox.shrink();
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      color: Theme.of(context).colorScheme.secondaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.system_update_rounded),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'update.soft_title'.tr(),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text('update.soft_desc'.tr()),
                ],
              ),
            ),
            TextButton(
              onPressed: () => _dismiss(latest),
              child: Text('update.later_button'.tr()),
            ),
            FilledButton(
              onPressed: () => InAppReview.instance.openStoreListing(
                appStoreId: Platform.isIOS
                    ? StoreLinks.appStoreId
                    : StoreLinks.androidPackageId,
              ),
              child: Text('update.update_button'.tr()),
            ),
          ],
        ),
      ),
    );
  }
}
