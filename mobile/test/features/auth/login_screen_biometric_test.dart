// Regresyon: _tryBiometricLogin (login_screen.dart) DioException disinda bir
// hatayi (ornegin beklenmeyen yanit govdesinden dogan TypeError/CastError)
// yakalamiyordu; _busy sonsuza kadar true kaliyor ve kullaniciya hicbir hata
// gosterilmiyordu. Bu test, /auth/refresh 200 dondugu ama govdesinde
// beklenen 'accessToken' alanini tasimadigi senaryoyu simule eder.
import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/biometric_service.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:bagajpark/features/auth/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:network_image_mock/network_image_mock.dart';

import '../support/pump_app.dart';

/// Gercek guvenli depoya (flutter_secure_storage) dokunmadan tek bir
/// biyometrik hesap dondurur.
class _FakeTokenStore extends TokenStore {
  @override
  Future<List<Map<String, String>>> getBiometricAccounts() async => [
    {'email': 'ayse@example.com', 'refreshToken': 'refresh-1'},
  ];

  @override
  Future<void> save({required String access, required String refresh}) async {}

  @override
  Future<void> saveBiometricAccount(String email, String refreshToken) async {}
}

/// local_auth platform kanalina dokunmadan dogrudan basarili doner.
class _FakeBiometricService extends BiometricService {
  @override
  Future<bool> authenticate({required String reason}) async => true;
}

void main() {
  testWidgets(
    "DioException olmayan bir hata _busy'yi sonsuza kadar true birakmiyor "
    've kullaniciya hata gosteriliyor',
    (tester) async {
      // Varsayilan test penceresi (800x600) formun tamamini sigdirmiyor ve
      // biyometrik dugme ekran disina tasiyor; gercekci bir telefon boyutu
      // veriyoruz ki dugme hit-test edilebilsin.
      tester.view.physicalSize = const Size(393, 873);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await mockNetworkImagesFor(() async {
        await pumpApp(
          tester,
          child: const LoginScreen(),
          overrides: [
            tokenStoreProvider.overrideWith((ref) => _FakeTokenStore()),
            biometricServiceProvider.overrideWith(
              (ref) => _FakeBiometricService(),
            ),
            dioProvider.overrideWith(
              (ref) => fakeDio((options) {
                // /auth/refresh 200 doner ama beklenen 'accessToken' alanini
                // tasimaz (ornegin ters proxy'den donen bozuk govde) — bu
                // `res.data['accessToken'] as String` satirinda bir
                // TypeError'a yol acar; DioException DEGILDIR.
                return {'refreshToken': 'new-refresh'};
              }),
            ),
          ],
        );
        await tester.pump();

        expect(find.byIcon(Icons.fingerprint_rounded), findsOneWidget);
        await tester.ensureVisible(find.byIcon(Icons.fingerprint_rounded));
        await tester.pump();
        await tester.tap(find.byIcon(Icons.fingerprint_rounded));
        await tester.pumpAndSettle();

        // Kullaniciya hata gosterildi.
        expect(find.byType(SnackBar), findsOneWidget);

        // _busy sonsuza kadar true kalmadi: ana "Giris Yap" dugmesi tekrar
        // metnini gosteriyor (donen spinner degil) ve tekrar tiklanabilir.
        final signInButton = tester.widget<FilledButton>(
          find.byType(FilledButton),
        );
        expect(signInButton.onPressed, isNotNull);
        expect(find.byType(CircularProgressIndicator), findsNothing);
      });
    },
  );
}
