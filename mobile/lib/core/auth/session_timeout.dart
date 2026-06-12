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
  ConsumerState<SessionTimeoutWrapper> createState() => _SessionTimeoutWrapperState();
}

class _SessionTimeoutWrapperState extends ConsumerState<SessionTimeoutWrapper>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    ref.listenManual(authControllerProvider, (prev, next) {
      final timeout = ref.read(sessionTimeoutProvider);
      if (next.session != null && prev?.session == null) {
        timeout.start();
      } else if (next.session == null && prev?.session != null) {
        timeout.stop();
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(sessionTimeoutProvider).start();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    ref.read(sessionTimeoutProvider).stop();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(sessionTimeoutProvider).onUserActivity();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => ref.read(sessionTimeoutProvider).onUserActivity(),
      child: widget.child,
    );
  }
}
