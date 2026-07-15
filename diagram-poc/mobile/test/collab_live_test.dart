@Tags(['live'])
library;

import 'package:blk_drg_mobile/features/collab/data/collab_service.dart';
import 'package:flutter_test/flutter_test.dart';

/// Live interop test against a running y-websocket relay + a Node "web" peer.
/// Skipped by default; run explicitly with:
///   flutter test --tags live test/collab_live_test.dart
/// after starting the relay on 127.0.0.1:1234 and the web_peer.mjs peer.
void main() {
  test('sees a web peer over the awareness protocol', () async {
    final svc = CollabService(
      wsBaseUrl: 'ws://127.0.0.1:1234',
      diagramId: 42,
      displayName: 'DartUser',
      uid: 'dart-1',
    );
    addTearDown(svc.dispose);
    svc.connect();

    // Poll for up to ~12s for the web peer to appear.
    var seen = false;
    for (var i = 0; i < 60; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 200));
      if (svc.peers.any((p) => p.name == 'WebPeer')) {
        seen = true;
        break;
      }
    }
    expect(seen, isTrue, reason: 'Dart client should see the web peer');
  }, timeout: const Timeout(Duration(seconds: 20)));
}
