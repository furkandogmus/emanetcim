import 'package:bagajpark/shared/widgets/skeleton.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Color decorationColor(WidgetTester tester) {
    final container = tester.widget<Container>(find.byType(Container));
    final decoration = container.decoration! as BoxDecoration;
    return decoration.color!;
  }

  testWidgets('Skeleton karanlık temada sabit beyaz kullanmaz', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.orange,
            brightness: Brightness.dark,
          ),
        ),
        home: const Scaffold(body: Skeleton(height: 40, width: 100)),
      ),
    );

    final color = decorationColor(tester);
    expect(color, isNot(Colors.white));
  });

  testWidgets(
    'Skeleton aydınlık temada ColorScheme.surface kullanır (sabit beyaz değil)',
    (tester) async {
      late ColorScheme scheme;
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: Colors.orange),
          ),
          home: Builder(
            builder: (context) {
              scheme = Theme.of(context).colorScheme;
              return const Scaffold(body: Skeleton(height: 40, width: 100));
            },
          ),
        ),
      );

      final color = decorationColor(tester);
      expect(color, scheme.surface);
    },
  );
}
