/// The authenticated user, as returned by `GET /api/auth/me` and the
/// login/register payloads.
class User {
  const User({required this.email, required this.name});

  final String email;
  final String name;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      email: (json['email'] ?? '') as String,
      name: (json['name'] ?? '') as String,
    );
  }

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return email.isNotEmpty ? email[0].toUpperCase() : '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}
