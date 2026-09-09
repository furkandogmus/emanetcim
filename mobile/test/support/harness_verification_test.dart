// Harness temel kanit testi: GERCEK cevirileri yukluyor mu?
// (Eski testler l10n yuklemedigi icin ham anahtar goruyordu.)
// `.tr()` build sirasinda cagrilmali (Builder), yoksa localization hazir degil.
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

void main() {
  testWidgets('GERCEK Turkce ceviri yukleniyor (ham anahtar degil)', (
    tester,
  ) async {
    await pumpApp(
      tester,
      Builder(builder: (_) => Text('search.book_now'.tr())),
    );
    expect(find.text('Şimdi Rezerve Et'), findsOneWidget);
    expect(find.text('search.book_now'), findsNothing);
  });

  testWidgets('birden fazla anahtar ayni anda cozuluyor', (tester) async {
    await pumpApp(
      tester,
      Builder(
        builder: (_) => Column(
          children: [Text('search.filter'.tr()), Text('search.book_now'.tr())],
        ),
      ),
    );
    expect(find.text('Filtrele'), findsOneWidget);
    expect(find.text('Şimdi Rezerve Et'), findsOneWidget);
  });
}
