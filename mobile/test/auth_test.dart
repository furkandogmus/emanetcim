import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Auth Controller Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test(
      'Initial state is unauthenticated',
      () {
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
      },
      skip: 'Google Sign In fails in tests without mock',
    );
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
