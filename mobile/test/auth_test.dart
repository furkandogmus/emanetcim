import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

@GenerateMocks([TokenStore])
void main() {
  group('Auth Controller Tests', () {
    test('Initial state is unauthenticated', () {
      final container = ProviderContainer();
      final state = container.read(authControllerProvider);
      
      expect(state.session, isNull);
      expect(state.isLoading, false);
    });

    test('isDeveloperMode toggle works', () {
      final container = ProviderContainer();
      final controller = container.read(authControllerProvider.notifier);
      
      expect(container.read(authControllerProvider).isDeveloperMode, false);
      controller.toggleDeveloperMode();
      expect(container.read(authControllerProvider).isDeveloperMode, true);
    });
  });
}
