import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';

final class SslPinning {
  const SslPinning._();

  /// SHA256 fingerprints of trusted certificates (leaf, uppercase hex, no colons).
  /// Run: openssl s_client -connect bagajpark.com:443 -servername bagajpark.com </dev/null | openssl x509 -noout -fingerprint -sha256
  ///
  /// Keep at least two entries so a certificate rotation does not lock the app
  /// out in production: the currently deployed leaf, and a backup (the next
  /// certificate, or the issuing intermediate CA) that will still be trusted
  /// once the leaf rotates.
  static const _pinnedFingerprints = <String>{
    'D862351104CA32663E90B99C8B59B673AE5B63D978FBF01F75E861183531C8F5',
    // TODO(prod-rotasyon): Bu placeholder gerçek bir yedek sertifika/CA SHA256
    // fingerprint'i ile değiştirilmeli - üretimde sertifika rotasyonundan ÖNCE.
    // Şu an tek gerçek pin var; o sertifika süresi dolup rotate edildiğinde ve
    // burada yedek eklenmemişse uygulama TÜM istekleri reddeder (kilitlenme).
    'BACKUP_CERT_FINGERPRINT_PLACEHOLDER_ROTASYONDAN_ONCE_DEGISTIR',
  };

  /// Applies certificate pinning to a Dio instance.
  /// Only enforce in release mode to allow local dev without SSL.
  static void apply(Dio dio) {
    const isRelease = bool.fromEnvironment('dart.vm.product');
    if (!isRelease) return;

    dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () {
        // SecurityContext() (with no trusted-roots source given) starts empty:
        // this client trusts NO certificate authority by default - not even
        // the OS/system trust store that a bare HttpClient() would use. That
        // is deliberate: it guarantees the platform's standard chain
        // validation fails for every single connection, which forces
        // badCertificateCallback below to run every time and become the sole
        // authority on acceptance.
        //
        // Without this, badCertificateCallback only fires when standard
        // validation has ALREADY failed. A certificate issued by any CA the OS
        // trusts (a corporate MITM proxy CA, a compromised intermediate CA)
        // would then pass silently and the pin check below would never even
        // run - which is exactly the real-world MITM scenario pinning exists
        // to catch.
        return HttpClient(context: SecurityContext())
          ..badCertificateCallback = (cert, host, port) {
            final trusted = isPinnedFingerprint(_sha256(cert));
            if (!trusted) {
              throw HandshakeException('Certificate pinning failed for $host');
            }
            return true;
          };
      },
    );
  }

  /// True if [fingerprint] (uppercase hex SHA256, no colons) matches one of
  /// the pinned certificate fingerprints. Exposed for unit testing the pin
  /// comparison logic without needing a real [X509Certificate].
  @visibleForTesting
  static bool isPinnedFingerprint(String fingerprint) {
    return _pinnedFingerprints.contains(fingerprint);
  }

  static String _sha256(X509Certificate cert) {
    final digest = sha256.convert(cert.der);
    return digest.toString().toUpperCase();
  }
}
