import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/router.dart';
import '../auth/auth_controller.dart';

final deepLinkServiceProvider = Provider((ref) {
  final service = DeepLinkService(ref);
  ref.onDispose(service.dispose);
  return service;
});

class DeepLinkService {
  final Ref _ref;
  final _appLinks = AppLinks();
  StreamSubscription? _sub;
  Uri? _pendingLink;
  bool _listening = true;

  DeepLinkService(this._ref);

  void init() {
    _listening = true;
    _sub = _appLinks.uriLinkStream.listen(_queueOrNavigate);

    _appLinks.getInitialLink().then((uri) {
      if (uri != null) _queueOrNavigate(uri);
    });

    // Auth state değiştiğinde bekleyen link'i işle
    _ref.listen(authControllerProvider, (prev, next) {
      if (_pendingLink != null && next.session != null) {
        _navigate(_pendingLink!);
        _pendingLink = null;
      }
    });
  }

  void _queueOrNavigate(Uri uri) {
    if (!_listening) return;
    final auth = _ref.read(authControllerProvider);
    if (auth.session == null && !uri.path.startsWith('/auth')) {
      _pendingLink = uri;
      return;
    }
    _navigate(uri);
  }

  void _navigate(Uri uri) {
    final path = uri.path;
    final router = _ref.read(routerProvider);

    var targetPath = path;
    if (uri.scheme == 'bagajpark') {
      targetPath = '/$path'.replaceAll('//', '/');
    }

    if (targetPath.isNotEmpty && targetPath != '/') {
      router.push(targetPath);
    }
  }

  void dispose() {
    _listening = false;
    _sub?.cancel();
  }
}
