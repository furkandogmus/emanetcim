class SealScanResult {
  final String type;
  final String id;
  final String? bookingId;
  final String? status;
  final String? message;

  SealScanResult({
    required this.type,
    required this.id,
    this.bookingId,
    this.status,
    this.message,
  });

  factory SealScanResult.fromJson(Map<String, dynamic> json) {
    return SealScanResult(
      type: json['type'] as String? ?? '',
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String?,
      status: json['status'] as String?,
      message: json['message'] as String?,
    );
  }
}
