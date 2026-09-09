import 'dart:io';

import 'package:bagajpark/main.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce/hive.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_boxes_test');
    Hive.init(tempDir.path);
  });

  tearDown(() async {
    await Hive.close();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('openHiveBoxes', () {
    test(
      'sifreleme anahtari alinamadiginda (secure storage erisilemez) kutular '
      'yine de acilir; oncesinde bu durumda kutular HIC ACILMIYORDU ve '
      'sonraki her senkron Hive.box(...) cagrisi (SyncService, cache '
      'saglayicilari) "Box not found" hatasiyla sessizce patliyordu',
      () async {
        await openHiveBoxes(
          null,
          boxNames: const ['test_pending_sync_actions', 'test_bookings_cache'],
        );

        expect(Hive.isBoxOpen('test_pending_sync_actions'), true);
        expect(Hive.isBoxOpen('test_bookings_cache'), true);

        // Tuketicilerin (SyncService.addAction, BookingRepository) yaptigi
        // gibi senkron Hive.box(...) artik HiveError firlatmiyor.
        final box = Hive.box('test_pending_sync_actions');
        await box.put('k', 'v');
        expect(box.get('k'), 'v');
      },
    );

    test('sifreleme anahtari mevcutken kutular yine acilir', () async {
      final key = Hive.generateSecureKey();

      await openHiveBoxes(key, boxNames: const ['test_encrypted_box']);

      expect(Hive.isBoxOpen('test_encrypted_box'), true);
    });
  });
}
