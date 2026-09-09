import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/features/profile/profile_screen.dart';
import 'package:bagajpark/shared/models/user.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:network_image_mock/network_image_mock.dart';

import '../support/pump_app.dart';

void main() {
  const guest = UserDto(
    id: 'user-1',
    role: UserRole.guest,
    name: 'Ayse Yilmaz',
    email: 'ayse@example.com',
  );

  const partner = UserDto(
    id: 'user-2',
    role: UserRole.partner,
    name: 'Mehmet Esnaf',
    email: 'mehmet@example.com',
  );

  Future<void> pumpProfile(
    WidgetTester tester, {
    required FakeAuthController controller,
  }) async {
    await mockNetworkImagesFor(
      () => pumpApp(
        tester,
        child: const ProfileScreen(),
        overrides: [
          authControllerProvider.overrideWith(() => controller),
          dioProvider.overrideWith(
            (ref) => fakeDio((options) {
              expect(options.path, '/profile/stats');
              return {
                'totalBookings': 5,
                'totalSavings': 120,
                'completedBookings': 3,
              };
            }),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('misafir kullanici bilgilerini ve istatistiklerini gosterir', (
    tester,
  ) async {
    await mockNetworkImagesFor(() async {
      await pumpProfile(
        tester,
        controller: FakeAuthController(const AuthState(session: guest)),
      );

      expect(find.text('Hesabım'), findsOneWidget);
      expect(find.text('Ayse Yilmaz'), findsOneWidget);
      expect(find.text('ayse@example.com'), findsOneWidget);
      expect(find.text('5'), findsOneWidget); // totalBookings
      expect(find.text('3'), findsOneWidget); // completedBookings
      expect(find.text('₺120'), findsOneWidget); // totalSavings

      // Misafir icin davet karti gorunur, esnaf-only menuler gorunmez.
      expect(find.text('Arkadaşlarını Davet Et'), findsOneWidget);
      expect(find.text('Kazançlarım'), findsNothing);
      expect(find.text('Dükkan Ayarları'), findsNothing);
    });
  });

  testWidgets('esnaf kullanicida esnaf yonetimi menusu gorunur', (
    tester,
  ) async {
    await mockNetworkImagesFor(() async {
      await pumpProfile(
        tester,
        controller: FakeAuthController(const AuthState(session: partner)),
      );

      expect(find.text('Mehmet Esnaf'), findsOneWidget);
      expect(find.text('Kazançlarım'), findsOneWidget);
      expect(find.text('Dükkan Ayarları'), findsOneWidget);
      // Esnaf icin davet karti gizli.
      expect(find.text('Arkadaşlarını Davet Et'), findsNothing);
    });
  });

  testWidgets('cikis yap onayi oturumu kapatir, vazgec onayi oturumu korur', (
    tester,
  ) async {
    await mockNetworkImagesFor(() async {
      final controller = FakeAuthController(const AuthState(session: guest));
      await pumpProfile(tester, controller: controller);

      // `dragUntilVisible` sadece widget'i agaca ekliyor, tam viewport
      // icine ortalamiyor — ekstra bir kaydirma ile gercekten dokunulabilir
      // hale getiriyoruz.
      await tester.dragUntilVisible(
        find.text('Çıkış Yap'),
        find.byType(Scrollable).first,
        const Offset(0, -200),
      );
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -150));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Çıkış Yap').first);
      await tester.pumpAndSettle();

      // Onay yuzeyi (widget tipinden bagimsiz — ConfirmDialog'a
      // tasinmasi ihtimaline karsi metne gore dogruluyoruz).
      expect(
        find.text('Hesabınızdan çıkış yapmak istediğinize emin misiniz?'),
        findsOneWidget,
      );

      // Once vazgec: oturum hala acik kalmali.
      await tester.tap(find.text('İptal'));
      await tester.pumpAndSettle();
      expect(controller.state.session, isNotNull);

      // Simdi gercekten cikis yap.
      await tester.tap(find.text('Çıkış Yap').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Çıkış Yap').last);
      await tester.pumpAndSettle();

      expect(controller.state.session, isNull);
    });
  });
}
