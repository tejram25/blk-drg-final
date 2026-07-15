import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/diagrams/presentation/diagram_list_screen.dart';
import '../features/editor/presentation/editor_screen.dart';

/// App router with an authentication guard.
///
/// While the session is being restored (`/api/auth/me`), we show a splash. Once
/// resolved, unauthenticated users are sent to `/login` and authenticated users
/// away from the auth screens.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh();
  ref.onDispose(refresh.dispose);
  ref.listen(authControllerProvider, (_, _) => refresh.notify());

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;
      final onSplash = loc == '/';
      final onAuthScreen = loc == '/login' || loc == '/register';

      if (auth.isLoading) return onSplash ? null : '/';

      final signedIn = auth.value != null;
      if (!signedIn) return onAuthScreen ? null : '/login';
      if (onSplash || onAuthScreen) return '/diagrams';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const _SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(
        path: '/diagrams',
        builder: (_, _) => const DiagramListScreen(),
      ),
      GoRoute(
        path: '/editor/:id',
        builder: (_, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '') ?? 0;
          return EditorScreen(diagramId: id);
        },
      ),
    ],
  );
});

/// Bridges Riverpod auth changes to go_router's Listenable.
class _RouterRefresh extends ChangeNotifier {
  void notify() => notifyListeners();
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
