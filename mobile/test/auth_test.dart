import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:bagajpark/core/api/api_client.dart';
import 'package:dio/dio.dart';

void main() {
  group('Auth Controller Tests', () {
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
    });

    test('isDemo toggle works', () async {
      final container = ProviderContainer(
        overrides: [
          tokenStoreProvider.overrideWith((ref) => FakeTokenStore()),
          dioProvider.overrideWith((ref) => Dio()),
        ],
      );
      addTearDown(container.dispose);
      
      final controller = container.read(authControllerProvider.notifier);

      expect(container.read(authControllerProvider).isDemo, false);
      await controller.skipLogin();
      expect(container.read(authControllerProvider).isDemo, true);
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
