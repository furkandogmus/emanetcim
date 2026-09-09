import 'dart:async';

import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/features/admin/admin_messages_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/pump_app.dart';

void main() {
  List<dynamic> messages() => [
    {
      'id': 'msg-1',
      'subject': 'Test Konu',
      'from': 'misafir@example.com',
      // UTC (Z sonekli) -- backend'in gercekte gonderdigi format.
      'createdAt': '2026-01-01T11:00:00.000Z',
      'isRead': false,
    },
  ];

  testWidgets('mesaj zaman damgasini yerel saate cevirerek gosterir', (
    tester,
  ) async {
    await pumpApp(
      tester,
      child: const AdminMessagesScreen(),
      overrides: [
        dioProvider.overrideWith((ref) => fakeDio((options) => messages())),
      ],
    );
    await tester.pumpAndSettle();

    // `date.toLocal()` cagrilmadan once UTC '11:00' aynen basiliyordu; bu
    // testin gecmesi icin bulundugu makinenin yerel saat dilimine gore
    // beklenen deger hesaplanir, boylece CI'nin hangi TZ'de calistigindan
    // bagimsiz kalir.
    final expected = DateTime.parse('2026-01-01T11:00:00.000Z').toLocal();
    final expectedText =
        '${expected.day.toString().padLeft(2, '0')}.'
        '${expected.month.toString().padLeft(2, '0')}.'
        '${expected.year} '
        '${expected.hour.toString().padLeft(2, '0')}:'
        '${expected.minute.toString().padLeft(2, '0')}';

    expect(find.text(expectedText), findsOneWidget);
  });

  testWidgets(
    'yenileme sirasinda widget dispose olursa yakalanmamis istisna firlatmaz',
    (tester) async {
      // Istek asktayken widget'i dispose edebilmek icin yaniti elle
      // tetiklenen bir Completer ile geciktiriyoruz (fakeDio senkron cozuyor,
      // bu senaryoyu uretemiyor).
      final completer = Completer<void>();
      final dio = Dio(BaseOptions(baseUrl: 'https://test.local'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) async {
            await completer.future;
            handler.reject(
              DioException(requestOptions: options, message: 'network error'),
            );
          },
        ),
      );

      final hostKey = GlobalKey<_ToggleHostState>();

      await pumpApp(
        tester,
        // Gercek "kullanici geri gider" senaryosunu taklit etmek icin
        // yalnizca ekranin kendisini agactan kaldiriyoruz (butun
        // EasyLocalization/GoRouter/ProviderScope agacini degil) -- bu
        // hem daha gercekci hem de testin sadece ekranin kendi dispose
        // davranisini olcmesini saglar.
        child: _ToggleHost(key: hostKey),
        overrides: [dioProvider.overrideWith((ref) => dio)],
      );

      // Istek hala beklerken ekrani agactan kaldir (dispose).
      hostKey.currentState!.hide();
      await tester.pump();

      // Simdi istek hatayla tamamlansin. `if (!mounted) return;` korumasi
      // olmadan bu, catch blogundaki ikinci `setState` cagrisinda
      // yakalanmamis bir istisnaya donusurdu. Sureyi ilerleten `pump`lar
      // kullaniyoruz ki (fake-time icinde) arka planda kalan zamanlayicilar
      // (orn. daha once gorunur olan bir SnackBar'in kapanma sayaci) test
      // sonundaki "hala bekleyen Timer" denetimini bu senaryoyla alakasiz
      // bir sekilde kirmasin.
      completer.complete();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 5));

      expect(tester.takeException(), isNull);
    },
  );
}

class _ToggleHost extends StatefulWidget {
  const _ToggleHost({super.key});

  @override
  State<_ToggleHost> createState() => _ToggleHostState();
}

class _ToggleHostState extends State<_ToggleHost> {
  bool _visible = true;

  void hide() => setState(() => _visible = false);

  @override
  Widget build(BuildContext context) {
    return _visible ? const AdminMessagesScreen() : const SizedBox.shrink();
  }
}
