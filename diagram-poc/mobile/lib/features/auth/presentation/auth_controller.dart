import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../domain/user.dart';

/// Holds the current session. `null` data means signed out; a [User] means
/// signed in. The router listens to this to guard routes.
class AuthController extends AsyncNotifier<User?> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  Future<User?> build() async {
    // Restore the session on launch from the persisted cookie.
    return _repo.me();
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _repo.login(email, password));
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    String? inviteCode,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => _repo.register(
        name: name,
        email: email,
        password: password,
        inviteCode: inviteCode,
      ),
    );
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncData(null);
  }

  bool get isSignedIn => state.value != null;
}

final authControllerProvider =
    AsyncNotifierProvider<AuthController, User?>(AuthController.new);
