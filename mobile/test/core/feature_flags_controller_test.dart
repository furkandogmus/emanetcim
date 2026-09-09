import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:bagajpark/core/config/feature_flags_controller.dart';
import 'package:bagajpark/core/repositories/feature_flags_repository.dart';
import 'package:bagajpark/core/utils/result.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeTokenStore extends TokenStore {
  @override
  Future<String?> readAccessToken() async => null;
}

class _FakeFeatureFlagsRepository extends FeatureFlagsRepository {
  _FakeFeatureFlagsRepository(this._result) : super(Dio());
  final Result<Map<String, bool>> _result;

  @override
  Future<Result<Map<String, bool>>> getFlags() async => _result;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  ProviderContainer makeContainer(Result<Map<String, bool>> flagsResult) {
    final container = ProviderContainer(
      overrides: [
        tokenStoreProvider.overrideWith((ref) => _FakeTokenStore()),
        dioProvider.overrideWith((ref) => Dio()),
        featureFlagsRepositoryProvider.overrideWith(
          (ref) => _FakeFeatureFlagsRepository(flagsResult),
        ),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  test('basariyla cekilen bayraklar state olur', () async {
    final container = makeContainer(
      const Success({'mobile_security_menu': true}),
    )..read(featureFlagsControllerProvider);
    await Future<void>.delayed(Duration.zero);

    expect(
      container.read(featureFlagsControllerProvider)['mobile_security_menu'],
      true,
    );
  });

  test(
    'ag hatasinda bos harita kalir (her bayrak varsayilan kapali)',
    () async {
      final container = makeContainer(const Failure('network error'))
        ..read(featureFlagsControllerProvider);
      await Future<void>.delayed(Duration.zero);

      expect(container.read(featureFlagsControllerProvider), isEmpty);
      expect(
        container.read(featureFlagsControllerProvider)['mobile_security_menu'],
        isNull,
      );
    },
  );
}
