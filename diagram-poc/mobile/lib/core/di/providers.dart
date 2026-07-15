import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

/// The shared [ApiClient]. Because construction is async (it opens the
/// persistent cookie store), the real instance is created in `main()` and this
/// provider is overridden with it at app start.
final apiClientProvider = Provider<ApiClient>((ref) {
  throw UnimplementedError(
    'apiClientProvider must be overridden in ProviderScope',
  );
});
