import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../core/network/api_client.dart';
import '../domain/user.dart';

/// Talks to the `/api/auth/*` endpoints. Session state lives in the JSESSIONID
/// cookie, persisted by [ApiClient], so there is no token to store here.
class AuthRepository {
  AuthRepository(this._api);

  final ApiClient _api;

  /// Whether the register form should ask for an invite code.
  Future<bool> inviteRequired() async {
    final res = await _api.getJson<Map<String, dynamic>>('/auth/config');
    return (res.data?['inviteRequired'] as bool?) ?? false;
  }

  Future<User> login(String email, String password) async {
    final res = await _api.postJson<Map<String, dynamic>>(
      '/auth/login',
      body: {'email': email, 'password': password},
    );
    return User.fromJson(res.data ?? const {});
  }

  Future<User> register({
    required String name,
    required String email,
    required String password,
    String? inviteCode,
  }) async {
    final res = await _api.postJson<Map<String, dynamic>>(
      '/auth/register',
      body: {
        'name': name,
        'email': email,
        'password': password,
        if (inviteCode != null && inviteCode.isNotEmpty)
          'inviteCode': inviteCode,
      },
    );
    return User.fromJson(res.data ?? const {});
  }

  /// Returns the current user, or null if the session is not authenticated.
  Future<User?> me() async {
    final res = await _api.getJson<Map<String, dynamic>>('/auth/me');
    final data = res.data;
    if (data == null || data['email'] == null) return null;
    return User.fromJson(data);
  }

  Future<void> logout() async {
    await _api.postJson<void>('/auth/logout');
    await _api.clearCookies();
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(apiClientProvider));
});
