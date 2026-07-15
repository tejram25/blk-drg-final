import 'dart:typed_data';

import 'package:blk_drg_mobile/features/collab/data/sync_protocol.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SyncProtocol framing', () {
    test('step1 encodes type=sync, subtype=step1, payload', () {
      final sv = Uint8List.fromList([9, 8, 7]);
      final frame = SyncProtocol.step1(sv);
      final msg = parseFirstMessage(frame)!;
      expect(msg.type, SyncProtocol.messageSync);
      expect(msg.isSync, isTrue);
      expect(msg.subtype, SyncProtocol.syncStep1);
      expect(msg.payload, [9, 8, 7]);
    });

    test('step2 and update round-trip their payloads', () {
      final u = Uint8List.fromList(List.generate(200, (i) => i % 256));
      expect(parseFirstMessage(SyncProtocol.step2(u))!.subtype,
          SyncProtocol.syncStep2);
      expect(parseFirstMessage(SyncProtocol.update(u))!.payload, u);
    });

    test('a non-sync (awareness) message is flagged and payload skipped', () {
      // type=1 (awareness) + a var-uint8array payload.
      final frame = Uint8List.fromList([1, 2, 42, 43]); // type=1,len=2,[42,43]
      final msg = parseFirstMessage(frame)!;
      expect(msg.isSync, isFalse);
      expect(msg.subtype, -1);
      expect(msg.payload, [42, 43]);
    });
  });
}
