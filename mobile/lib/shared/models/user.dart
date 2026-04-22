import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';
part 'user.g.dart';

enum UserRole {
  @JsonValue("GUEST")
  guest,
  @JsonValue("PARTNER")
  partner,
  @JsonValue("ADMIN")
  admin,
}

@freezed
abstract class UserDto with _$UserDto {
  const factory UserDto({
    required String id,
    String? email,
    String? name,
    String? phone,
    required UserRole role,
    String? avatarUrl,
    String? referralCode,
  }) = _UserDto;

  factory UserDto.fromJson(Map<String, dynamic> json) =>
      _$UserDtoFromJson(json);
}
