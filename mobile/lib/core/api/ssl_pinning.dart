import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';

final class SslPinning {
  const SslPinning._();

  /// SHA256 fingerprints of trusted certificates.
  /// Run: openssl s_client -connect bagajpark.com:443 -servername bagajpark.com </dev/null | openssl x509 -noout -fingerprint -sha256
  static const _pinnedFingerprints = <String>{
    'D862351104CA32663E90B99C8B59B673AE5B63D978FBF01F75E861183531C8F5',
  };

  /// Applies certificate pinning to a Dio instance.
  /// Only enforce in release mode to allow local dev without SSL.
  static void apply(Dio dio) {
    const isRelease = bool.fromEnvironment('dart.vm.product');
    if (!isRelease) return;

    dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () {
        final client = HttpClient();
        client.badCertificateCallback = (cert, host, port) {
          final fingerprint = _sha256(cert);
          final trusted = _pinnedFingerprints.contains(fingerprint);
          if (!trusted) {
            throw HandshakeException(
              'Certificate pinning failed for $host',
            );
          }
          return true;
        };
        return client;
      },
    );
  }

  static String _sha256(X509Certificate cert) {
    final digest = sha256.convert(cert.der);
    return digest.toString().toUpperCase();
  }
}
