import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/features/onboarding/onboarding_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:network_image_mock/network_image_mock.dart';

import '../support/pump_app.dart';

void main() {
  Future<void> pumpOnboarding(
    WidgetTester tester, {
    required FakeAuthController controller,
  }) async {
    await mockNetworkImagesFor(
      () => pumpApp(
        tester,
        child: const OnboardingScreen(),
        overrides: [authControllerProvider.overrideWith(() => controller)],
        extraRoutes: {
          '/auth/login': (context) =>
              const Scaffold(body: Text('giris-ekrani-stub')),
        },
      ),
    );
  }

  testWidgets('ilk sayfa basligini ve Atla butonunu gosterir', (tester) async {
    await mockNetworkImagesFor(() async {
      await pumpOnboarding(
        tester,
        controller: FakeAuthController(const AuthState()),
      );

      expect(find.text('Bul & Rezerve Et'), findsOneWidget);
      expect(find.text('Atla'), findsOneWidget);
      // Son sayfa degiliz; "Bitti" butonu degil ileri oku gorunmeli.
      expect(find.text('Bitti'), findsNothing);
      expect(find.byIcon(Icons.arrow_forward_rounded), findsOneWidget);
    });
  });

  testWidgets('ileri oku ile son sayfaya gelince Bitti butonu onboarding'
      ' tamamlanmis olarak isaretleyip giris ekranina yonlendirir', (
    tester,
  ) async {
    await mockNetworkImagesFor(() async {
      final controller = FakeAuthController(const AuthState());
      await pumpOnboarding(tester, controller: controller);

      // 4 sayfa var (step1..step4); son sayfaya varana kadar ileri oku tikla.
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byIcon(Icons.arrow_forward_rounded));
        await tester.pumpAndSettle();
      }

      expect(find.text('Özgürce Keşfet'), findsOneWidget);
      expect(find.text('Bitti'), findsOneWidget);

      await tester.tap(find.text('Bitti'));
      await tester.pumpAndSettle();

      expect(controller.state.onboardingDone, isTrue);
      expect(find.text('giris-ekrani-stub'), findsOneWidget);
    });
  });

  testWidgets('Atla butonu dogrudan giris ekranina yonlendirir', (
    tester,
  ) async {
    await mockNetworkImagesFor(() async {
      final controller = FakeAuthController(const AuthState());
      await pumpOnboarding(tester, controller: controller);

      await tester.tap(find.text('Atla'));
      await tester.pumpAndSettle();

      expect(controller.state.onboardingDone, isTrue);
      expect(find.text('giris-ekrani-stub'), findsOneWidget);
    });
  });
}
