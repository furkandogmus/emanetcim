import 'dart:io' show Platform;
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../push/push_service.dart';
import '../../shared/models/user.dart';
import 'token_store.dart';

class AuthState {
  final UserDto? session;
  final bool loading;
  final bool isDemo;
  const AuthState({this.session, this.loading = false, this.isDemo = false});

  AuthState copyWith({UserDto? session, bool? loading, bool? isDemo, bool clearSession = false}) => AuthState(
        session: clearSession ? null : (session ?? this.session),
        loading: loading ?? this.loading,
        isDemo: isDemo ?? this.isDemo,
      );
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    _bootstrap();
    return const AuthState();
  }

  Future<void> _bootstrap() async {
    final store = ref.read(tokenStoreProvider);
    final token = await store.readAccessToken();
    if (token == null) return;
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get('/auth/me');
      state = state.copyWith(session: UserDto.fromJson(res.data as Map<String, dynamic>));
      // Push init on bootstrap
      try {
        await ref.read(pushServiceProvider).init();
      } catch (_) {}
    } on DioException {
      await store.clear();
    }
  }

  Future<void> requestOtp(String identity) async {
    state = state.copyWith(loading: true);
    final dio = ref.read(dioProvider);
    // Determine if identity is email or phone
    final isEmail = identity.contains('@');
    final data = isEmail ? {'email': identity} : {'phone': identity.replaceAll(RegExp(r'\D'), '')};
    
    await dio.post('/auth/otp', data: data);
    state = state.copyWith(loading: false);
  }

  Future<void> verifyOtp(String identity, String code) async {
    state = state.copyWith(loading: true);
    final dio = ref.read(dioProvider);
    final isEmail = identity.contains('@');
    final data = isEmail 
      ? {'email': identity, 'code': code} 
      : {'phone': identity.replaceAll(RegExp(r'\D'), ''), 'code': code};
      
    final res = await dio.post('/auth/session', data: data);
    await _completeSession(res.data as Map<String, dynamic>);
  }

  Future<void> _completeSession(Map<String, dynamic> data) async {
    await ref.read(tokenStoreProvider).save(
          access: data['accessToken'] as String,
          refresh: data['refreshToken'] as String,
        );
    final user = UserDto.fromJson(data['user'] as Map<String, dynamic>);
    state = state.copyWith(session: user, loading: false);
    // Push kayıt: login sonrası FCM token backend'e gönder
    try {
      await ref.read(pushServiceProvider).init();
    } catch (_) {}
  }

  Future<void> signInWithGoogle() async {
    throw UnsupportedError('Google login macOS üzerinde şu an devre dışı.');
  }

  Future<void> signInWithApple() async {
    throw UnsupportedError('Apple login macOS üzerinde şu an devre dışı.');
  }

  Future<void> skipLogin() async {
    state = state.copyWith(
      isDemo: true,
      session: const UserDto(
        id: 'demo-user',
        email: 'demo@bagajpark.com',
        name: 'Demo Kullanıcı',
        role: UserRole.GUEST,
      ),
    );
  }

  Future<void> skipLoginAsPartner() async {
    state = state.copyWith(
      isDemo: true,
      session: const UserDto(
        id: 'demo-partner',
        email: 'esnaf@bagajpark.com',
        name: 'Galata Esnafı',
        role: UserRole.PARTNER,
      ),
    );
  }

  Future<void> logout() async {
    await ref.read(tokenStoreProvider).clear();
    state = state.copyWith(clearSession: true);
  }
}
