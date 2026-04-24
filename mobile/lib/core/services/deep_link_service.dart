import 'dart:async';
import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_controller.dart';
import '../../app/router.dart';

final deepLinkServiceProvider = Provider((ref) => DeepLinkService(ref));

class DeepLinkService {
  final Ref _ref;
  final _appLinks = AppLinks();
  StreamSubscription? _sub;

  DeepLinkService(this._ref);

  void init() {
    _sub = _appLinks.uriLinkStream.listen((uri) {
      _handleUri(uri);
    });

    // Check for initial link
    _appLinks.getInitialLink().then((uri) {
      if (uri != null) _handleUri(uri);
    });
  }

  void _handleUri(Uri uri) {
    final path = uri.path;

    // Check if user is logged in before navigating to sensitive routes
    final auth = _ref.read(authControllerProvider);
    if (auth.session == null && !path.startsWith('/auth')) {
      return;
    }

    final router = _ref.read(routerProvider);

    // Normalize path (handle bagajpark://scheme)
    String targetPath = path;
    if (uri.scheme == 'bagajpark') {
      targetPath = '/$path'.replaceAll('//', '/');
    }

    if (targetPath.isNotEmpty && targetPath != '/') {
      router.push(targetPath);
    }
  }

  void dispose() {
    _sub?.cancel();
  }
}
