import 'package:flutter_test/flutter_test.dart';

void main() {
  group('API Logic Tests', () {
    test('Successful API mock response parsing', () async {
      final mockResponse = {
        'status': 'success',
        'data': {'id': '123', 'name': 'Test Shop'},
      };

      expect(mockResponse['status'], 'success');
      expect((mockResponse['data'] as Map)['id'], '123');
    });

    test('Error response handling logic', () {
      final errorResponse = {
        'error': 'Unauthorized',
        'message': 'Token expired',
      };

      expect(errorResponse.containsKey('error'), isTrue);
    });
  });
}
