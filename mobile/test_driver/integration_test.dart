// `flutter drive --driver=test_driver/integration_test.dart --target=integration_test/...`
// icin surucu: cihazdan gelen ekran goruntulerini build/screenshots/tour/ altina yazar.
import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  final dir = Directory('build/screenshots/tour')..createSync(recursive: true);
  await integrationDriver(
    onScreenshot: (name, bytes, [args]) async {
      File('${dir.path}/$name.png').writeAsBytesSync(bytes);
      return true;
    },
  );
}
