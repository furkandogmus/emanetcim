import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _secureStorageChannel = MethodChannel(
  'plugins.it_nomads.com/flutter_secure_storage',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Auth Controller Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('Initial state is unauthenticated', () {
      final container = ProviderContainer(
        overrides: [
          tokenStoreProvider.overrideWith((ref) => FakeTokenStore()),
          dioProvider.overrideWith((ref) => Dio()),
        ],
      );
      addTearDown(container.dispose);

      final state = container.read(authControllerProvider);

      expect(state.session, isNull);
      expect(state.loading, false);
    }, skip: 'Google Sign In fails in tests without mock');
  });

  group('TokenStore.clear() dayaniklilik testleri', () {
    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_secureStorageChannel, null);
    });

    test('bir anahtarin silinmesi platform hatasi atarsa diger anahtar yine de '
        'silinir ve clear() reddedilmez', () async {
      final deletedKeys = <String>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_secureStorageChannel, (call) async {
            if (call.method == 'delete') {
              final key = (call.arguments as Map)['key'] as String;
              deletedKeys.add(key);
              if (key == 'access_token') {
                throw PlatformException(
                  code: 'KeyPermanentlyInvalidatedException',
                  message: 'simulated keystore failure',
                );
              }
            }
            return null;
          });

      // Onceden `access_token` silme platform hatasi atarsa
      // `refresh_token` hic silinmiyordu ve clear() future'i
      // reddediliyordu; onu cagiran AuthController.logout() de hic
      // tamamlanmadigi icin oturum state'i temizlenmeden kullanici
      // "giris yapilmis" halde kaliyordu (2026-09-09'da bulundu).
      await expectLater(TokenStore().clear(), completes);

      expect(deletedKeys, containsAll(['access_token', 'refresh_token']));
    });
  });
}

class FakeTokenStore extends TokenStore {
  @override
  Future<String?> readAccessToken() async => null;
  @override
  Future<void> save({required String access, required String refresh}) async {}
  @override
  Future<void> clear() async {}
}
