// Erisilebilirlik guideline testi. Gercek ag cagrisi yapmamak icin
// `pushRepositoryProvider` sahte bir repository ile override edilir.
import 'package:bagajpark/core/repositories/push_repository.dart';
import 'package:bagajpark/core/utils/result.dart';
import 'package:bagajpark/features/security/devices_screen.dart';
import 'package:bagajpark/shared/models/mobile_device.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

class _FakePushRepository extends PushRepository {
  _FakePushRepository(this._items) : super(Dio());
  final List<MobileDeviceDto> _items;

  @override
  Future<Result<List<MobileDeviceDto>>> getDevices() async =>
      Success(List.of(_items));

  @override
  Future<Result<void>> removeDevice(String token) async {
    _items.removeWhere((d) => d.token == token);
    return const Success<void>(null);
  }
}

void main() {
  final device = MobileDeviceDto(
    token: 'abcdef123456',
    tokenSuffix: '123456',
    platform: 'android',
    lastSeenAt: DateTime(2026, 1, 1, 12),
  );

  Future<void> pump(WidgetTester tester, {List<MobileDeviceDto>? items}) =>
      pumpApp(
        tester,
        const DevicesScreen(),
        overrides: [
          pushRepositoryProvider.overrideWith(
            (ref) => _FakePushRepository(items ?? [device]),
          ),
        ],
      );

  testWidgets('DevicesScreen: cihaz listesi gercek ceviriyle ciziliyor', (
    tester,
  ) async {
    await pump(tester);
    expect(find.text('Bildirim Alan Cihazlar'), findsOneWidget);
    expect(find.textContaining('123456'), findsOneWidget);
  });

  testWidgets('DevicesScreen: bos liste mesaji gosterilir', (tester) async {
    await pump(tester, items: []);
    expect(find.text('Kayıtlı cihaz yok.'), findsOneWidget);
  });

  testWidgets('DevicesScreen: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('DevicesScreen: dokunulabilir dugumler etiketli', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('DevicesScreen: metin kontrasti WCAG AA', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    handle.dispose();
  });
}
