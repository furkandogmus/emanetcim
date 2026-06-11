import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../shared/models/user.dart';
import '../api/api_client.dart';
import '../config/env.dart';
import '../push/push_service.dart';
import 'token_store.dart';

class AuthState {
  final UserDto? session;
  final bool loading;
  final bool onboardingDone;
  const AuthState({
    this.session,
    this.loading = false,
    this.onboardingDone = false,
  });

  AuthState copyWith({
    UserDto? session,
    bool? loading,
    bool? onboardingDone,
    bool clearSession = false,
  }) => AuthState(
    session: clearSession ? null : (session ?? this.session),
    loading: loading ?? this.loading,
    onboardingDone: onboardingDone ?? this.onboardingDone,
  );
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    Future.microtask(() => _bootstrap());
    return const AuthState(loading: true);
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final onboardingDone = prefs.getBool('onboarding_done') ?? false;
    state = state.copyWith(onboardingDone: onboardingDone, loading: false);

    try {
      await GoogleSignIn.instance.initialize(
        serverClientId: Env.googleWebClientId,
      );
    } catch (e) {
      debugPrint('GoogleSignIn initialization failed: $e');
    }

    final store = ref.read(tokenStoreProvider);
    final token = await store.readAccessToken();
    if (token == null) return;
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get('/auth/me');
      state = state.copyWith(
        session: UserDto.fromJson(res.data as Map<String, dynamic>),
      );
      try {
        await ref.read(pushServiceProvider).init();
      } catch (e, st) {
        debugPrint('Failed to init push service on bootstrap: $e\n$st');
      }
    } on DioException {
      await store.clear();
    }
  }

  Future<void> setOnboardingDone() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
    state = state.copyWith(onboardingDone: true);
  }

  Future<void> requestOtp(String identity) async {
    state = state.copyWith(loading: true);
    try {
      final dio = ref.read(dioProvider);
      final isEmail = identity.contains('@');
      final data = isEmail
          ? {'email': identity}
          : {'phone': identity.replaceAll(RegExp(r'\D'), '')};

      await dio.post('/auth/otp', data: data);
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> verifyOtp(String identity, String code, {String? name}) async {
    state = state.copyWith(loading: true);
    try {
      final dio = ref.read(dioProvider);
      final isEmail = identity.contains('@');
      final data = isEmail
          ? {'email': identity, 'code': code}
          : {'phone': identity.replaceAll(RegExp(r'\D'), ''), 'code': code};
      if (name != null && name.isNotEmpty) {
        data['name'] = name;
      }

      final res = await dio.post('/auth/session', data: data);
      await _completeSession(res.data as Map<String, dynamic>);
    } catch (e) {
      state = state.copyWith(loading: false);
      rethrow;
    }
  }

  Future<void> loginWithPassword(String identity, String password) async {
    state = state.copyWith(loading: true);
    try {
      final dio = ref.read(dioProvider);
      final isEmail = identity.contains('@');
      final data = isEmail
          ? {'email': identity, 'password': password}
          : {
              'phone': identity.replaceAll(RegExp(r'\D'), ''),
              'password': password,
            };

      final res = await dio.post('/auth/session', data: data);
      await _completeSession(res.data as Map<String, dynamic>);
    } catch (e) {
      state = state.copyWith(loading: false);
      rethrow;
    }
  }

  Future<void> completeSession(Map<String, dynamic> data) async {
    await _completeSession(data);
  }

  Future<void> _completeSession(Map<String, dynamic> data) async {
    await ref
        .read(tokenStoreProvider)
        .save(
          access: data['accessToken'] as String,
          refresh: data['refreshToken'] as String,
        );
    final user = UserDto.fromJson(data['user'] as Map<String, dynamic>);
    state = state.copyWith(session: user, loading: false);
    // Push kayıt: login sonrası FCM token backend'e gönder
    try {
      await ref.read(pushServiceProvider).init();
    } catch (e, st) {
      debugPrint('Failed to init push service after login: $e\n$st');
      // TODO: Log to Crashlytics / Sentry
    }
  }

  Future<void> signInWithGoogle() async {
    state = state.copyWith(loading: true);
    try {
      GoogleSignInAccount account;
      try {
        account = await GoogleSignIn.instance.authenticate(
          scopeHint: ['email', 'profile'],
        );
      } on GoogleSignInException catch (e) {
        debugPrint('GoogleSignInException: ${e.code}');
        if (e.code == GoogleSignInExceptionCode.canceled) {
          state = state.copyWith(loading: false);
          return;
        }
        rethrow;
      } catch (e) {
        debugPrint('GoogleSignIn unexpected error: $e');
        rethrow;
      }

      final auth = account.authentication;
      final idToken = auth.idToken;

      debugPrint('GoogleSignIn idToken present: ${idToken != null}, length: ${idToken?.length ?? 0}');

      if (idToken == null) {
        throw Exception('Google login failed: No ID Token');
      }

      final dio = ref.read(dioProvider);
      final res = await dio.post('/auth/google', data: {'idToken': idToken});
      await _completeSession(res.data as Map<String, dynamic>);
    } catch (e) {
      state = state.copyWith(loading: false);
      rethrow;
    }
  }

  Future<void> signInWithApple() async {
    state = state.copyWith(loading: true);
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final dio = ref.read(dioProvider);
      final res = await dio.post('/auth/apple', data: {
        'identityToken': credential.identityToken,
        'givenName': credential.givenName,
        'familyName': credential.familyName,
      });
      await _completeSession(res.data as Map<String, dynamic>);
    } catch (e) {
      state = state.copyWith(loading: false);
      rethrow;
    }
  }

  Future<void> logout() async {
    await ref.read(tokenStoreProvider).clear();
    ref.invalidate(dioProvider);
    state = state.copyWith(clearSession: true, loading: false);
  }

  Future<bool> requestAccountDeletion() async {
    state = state.copyWith(loading: true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/account/delete');
      await logout();
      state = state.copyWith(loading: false);
      return true;
    } catch (e) {
      state = state.copyWith(loading: false);
      return false;
    }
  }
}
