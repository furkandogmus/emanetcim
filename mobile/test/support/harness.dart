import 'package:bagajpark/app/theme.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:network_image_mock/network_image_mock.dart';

/// Test edilecek standart cihaz profilleri (mantiksal boyut).
class DeviceProfile {
  const DeviceProfile(this.label, this.size);
  final String label;
  final Size size;
}

const kSmallPhone = DeviceProfile('kucuk telefon 360x640', Size(360, 640));
const kPhone = DeviceProfile('telefon 393x873', Size(393, 873));
const kTablet = DeviceProfile('tablet 800x1280', Size(800, 1280));

/// Cihaz matrisi: kucuk telefon, normal telefon, tablet.
const List<DeviceProfile> kDeviceMatrix = [kSmallPhone, kPhone, kTablet];

/// Bir widget'i UYGULAMANIN GERCEK baglaminda pump eder: gercek tema, gercek
/// yerellestirme (Turkce cevirilerle), Riverpod kapsami, ag gorseli mock'u ve
/// istege bagli cihaz boyutu + yazi olcegi.
///
/// Onceki testler l10n yuklemedigi icin ekranda ham anahtar ("search.book_now")
/// goruyordu; bu helper gercek metni ("Simdi Rezerve Et") uretir.
Future<void> pumpApp(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const [],
  DeviceProfile? device,
  double textScale = 1.0,
  Locale locale = const Locale('tr'),
}) async {
  if (device != null) {
    tester.view.physicalSize = device.size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
  }

  // Ceviri dosyasi gercek asset yuklemesiyle (async I/O) gelir; pumpAndSettle
  // onu beklemez. Ayni izolattaki ikinci EasyLocalization bu yuzden ilk
  // karede ham anahtar basiyordu. runAsync gercek future'larin bitmesini saglar.
  await mockNetworkImagesFor(() async {
    await tester.runAsync(
      () => tester.pumpWidget(
        ProviderScope(
          overrides: overrides,
          child: EasyLocalization(
            supportedLocales: const [Locale('tr'), Locale('en')],
            path: 'assets/l10n',
            fallbackLocale: const Locale('tr'),
            startLocale: locale,
            child: Builder(
              builder: (context) => MaterialApp(
                debugShowCheckedModeBanner: false,
                theme: buildLightTheme(),
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                builder: (context, w) => MediaQuery(
                  data: MediaQuery.of(
                    context,
                  ).copyWith(textScaler: TextScaler.linear(textScale)),
                  child: w!,
                ),
                home: Scaffold(body: child),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  });
}
