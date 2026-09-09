import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_controller.dart';

final sessionTimeoutProvider = Provider<SessionTimeout>((ref) {
  return SessionTimeout(ref);
});

class SessionTimeout {
  SessionTimeout(this.ref);
  final Ref ref;

  static const _timeoutDuration = Duration(minutes: 30);
  Timer? _timer;
  DateTime _lastActivity = DateTime.now();

  void onUserActivity() {
    _lastActivity = DateTime.now();
    _resetTimer();
  }

  void _resetTimer() {
    _timer?.cancel();
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    _timer = Timer(_timeoutDuration, () {
      if (ref.read(authControllerProvider).session == null) return;
      final elapsed = DateTime.now().difference(_lastActivity);
      if (elapsed >= _timeoutDuration) {
        ref.read(authControllerProvider.notifier).logout();
      }
    });
  }

  void start() {
    _lastActivity = DateTime.now();
    _resetTimer();
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}

class SessionTimeoutWrapper extends ConsumerStatefulWidget {
  const SessionTimeoutWrapper({required this.child, super.key});
  final Widget child;

  @override
  ConsumerState<SessionTimeoutWrapper> createState() =>
      _SessionTimeoutWrapperState();
}

class _SessionTimeoutWrapperState extends ConsumerState<SessionTimeoutWrapper>
    with WidgetsBindingObserver {
  // initState'te bir kere okunur ve saklanir: dispose()'ta ref.read guvensiz
  // (widget unmount edilirken BuildContext'e dayanir).
  late final SessionTimeout _sessionTimeout;

  @override
  void initState() {
    super.initState();
    _sessionTimeout = ref.read(sessionTimeoutProvider);
    WidgetsBinding.instance.addObserver(this);

    ref.listenManual(authControllerProvider, (prev, next) {
      if (next.session != null && prev?.session == null) {
        _sessionTimeout.start();
      } else if (next.session == null && prev?.session != null) {
        _sessionTimeout.stop();
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _sessionTimeout.start();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sessionTimeout.stop();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _sessionTimeout.onUserActivity();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _sessionTimeout.onUserActivity(),
      child: widget.child,
    );
  }
}
