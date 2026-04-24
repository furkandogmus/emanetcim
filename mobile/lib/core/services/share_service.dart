import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:easy_localization/easy_localization.dart';

final shareServiceProvider = Provider((ref) => ShareService());

class ShareService {
  Future<void> shareShop({
    required String id,
    required String name,
    required String address,
  }) async {
    final url = 'https://bagajpark.com/shop/$id';
    final text = 'share.shop_message'.tr(args: [name, address, url]);

    await SharePlus.instance.share(
      ShareParams(
        text: text,
        subject: 'share.shop_subject'.tr(args: [name]),
      ),
    );
  }

  Future<void> shareApp() async {
    final text = 'share.app_message'.tr(args: ['https://bagajpark.com']);
    await SharePlus.instance.share(ShareParams(text: text));
  }
}
