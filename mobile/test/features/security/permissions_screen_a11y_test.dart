// Erisilebilirlik guideline testi. `permission_handler` platform kanalini
// gercek OS olmadan kullanir; kanali sahte bir yanitla mocklayip HER izni
// "verildi" (PermissionStatus.granted -> value 1) doner.
// Kaynak: permission_handler_platform_interface method_channel_permission_handler.dart
import 'package:bagajpark/features/security/permissions_screen.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

const _channel = MethodChannel('flutter.baseflow.com/permissions/methods');

void main() {
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, (call) async {
          if (call.method == 'checkPermissionStatus') return 1; // granted
          return null;
        });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, null);
  });

  Future<void> pump(WidgetTester tester) =>
      pumpApp(tester, const PermissionsScreen());

  testWidgets('PermissionsScreen: gercek ceviriyle ciziliyor', (tester) async {
    await pump(tester);
    expect(find.text('İzinler'), findsOneWidget);
    expect(find.text('Kamera'), findsOneWidget);
    expect(find.text('Konum'), findsOneWidget);
    expect(find.text('Bildirimler'), findsOneWidget);
  });

  testWidgets('PermissionsScreen: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('PermissionsScreen: dokunulabilir dugumler etiketli', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('PermissionsScreen: metin kontrasti WCAG AA', (tester) async {
    // DEFECT_BACKLOG D10 (2026-09-12): `textButtonTheme` artik acikca
    // `_brandOrangeDark` kullaniyor (soluk seftali zeminde yeterli kontrast)
    // -- ayni kok sebep force_update_screen_a11y_test.dart'ta da duzeltildi.
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    handle.dispose();
  });
}
