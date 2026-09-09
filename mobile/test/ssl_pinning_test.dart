import 'package:bagajpark/core/api/ssl_pinning.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SslPinning.isPinnedFingerprint', () {
    test('matches the pinned production fingerprint', () {
      expect(
        SslPinning.isPinnedFingerprint(
          'D862351104CA32663E90B99C8B59B673AE5B63D978FBF01F75E861183531C8F5',
        ),
        isTrue,
      );
    });

    test('rejects a fingerprint that is not pinned (MITM certificate)', () {
      // Simulates a certificate issued by an untrusted or rogue CA - even one
      // that would pass standard chain validation - which must never be
      // accepted just because it is well-formed.
      expect(
        SslPinning.isPinnedFingerprint(
          '0000000000000000000000000000000000000000000000000000000000000000',
        ),
        isFalse,
      );
    });

    test('rejects an empty fingerprint', () {
      expect(SslPinning.isPinnedFingerprint(''), isFalse);
    });

    test('comparison is case-sensitive against the stored uppercase hex', () {
      // _sha256() always produces uppercase hex; a lowercase match must not
      // silently pass, since it would never occur from the real code path.
      expect(
        SslPinning.isPinnedFingerprint(
          'd862351104ca32663e90b99c8b59b673ae5b63d978fbf01f75e861183531c8f5',
        ),
        isFalse,
      );
    });
  });
}
