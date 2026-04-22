import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';

void main() {
  group('Auth Controller Tests', () {
    test('Initial state is unauthenticated', () {
      final container = ProviderContainer();
      final state = container.read(authControllerProvider);
      
      expect(state.session, isNull);
      expect(state.loading, false);
    });

    test('isDemo toggle works', () async {
      final container = ProviderContainer();
      final controller = container.read(authControllerProvider.notifier);
      
      expect(container.read(authControllerProvider).isDemo, false);
      await controller.skipLogin();
      expect(container.read(authControllerProvider).isDemo, true);
    });
  });
}
