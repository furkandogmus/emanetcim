// Regresyon: eski regex (`[\w-\.]+@([\w-]+\.)+[\w-]{2,4}`) '+' etiketleme
// iceren ve 4 karakterden uzun TLD'ye sahip gecerli e-postalari reddediyordu
// (bkz. lib/core/utils/validators.dart basindaki not).
import 'package:bagajpark/core/utils/validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('isValidEmail', () {
    test('artik gmail + etiketlemesini kabul ediyor', () {
      expect(isValidEmail('kullanici+test@gmail.com'), isTrue);
    });

    test('artik 4 karakterden uzun TLD kabul ediyor', () {
      expect(isValidEmail('ad@sirket.email'), isTrue);
      expect(isValidEmail('ad@sirket.technology'), isTrue);
    });

    test('sade gecerli adresleri kabul etmeye devam ediyor', () {
      expect(isValidEmail('ayse@example.com'), isTrue);
      expect(isValidEmail('a.b-c_d@sub.example.co'), isTrue);
    });

    test('gecersiz adresleri hala reddediyor', () {
      expect(isValidEmail(''), isFalse);
      expect(isValidEmail('gecersiz'), isFalse);
      expect(isValidEmail('gecersiz@'), isFalse);
      expect(isValidEmail('@example.com'), isFalse);
      expect(isValidEmail('ad@example'), isFalse);
    });
  });
}
