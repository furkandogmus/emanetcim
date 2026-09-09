import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// Yükleme durumu için tema/dark-mode duyarlı shimmer plasderi.
///
/// Renkler `Theme.of(context).colorScheme`'den türetilir; önceden
/// `Colors.grey.shade200` / `Colors.white` sabitleri kullanılıyordu ve
/// karanlık temada arka plan üzerinde beyaz parlıyordu (UX-H1).
///
/// M3'te "container" tonları karanlıkta surface'ten daha AÇIK, aydınlıkta
/// ise surface'e (biz onu saf beyaza sabitliyoruz) göre biraz daha KOYU
/// üretilir; bu yüzden base/highlight rolleri parlaklığa göre yer değiştirir.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height, this.width, this.borderRadius = 8});

  final double? height;
  final double? width;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final surface = colorScheme.surface;
    final container = colorScheme.surfaceContainerHighest;
    final baseColor = isDark ? surface : container;
    final highlightColor = isDark ? container : surface;

    return Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: Container(
        height: height,
        width: width,
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: highlightColor,
          borderRadius: BorderRadius.all(Radius.circular(borderRadius)),
        ),
      ),
    );
  }
}
