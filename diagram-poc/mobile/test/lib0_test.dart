import 'dart:typed_data';

import 'package:blk_drg_mobile/features/collab/data/lib0.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('lib0 var-int / var-string', () {
    test('round-trips unsigned var-ints across byte boundaries', () {
      for (final v in [0, 1, 127, 128, 300, 16384, 0x7fffffff]) {
        final enc = Lib0Encoder()..writeVarUint(v);
        final dec = Lib0Decoder(enc.toBytes());
        expect(dec.readVarUint(), v, reason: 'value $v');
      }
    });

    test('round-trips strings and byte arrays', () {
      final enc = Lib0Encoder()
        ..writeVarString('WebPeer ✓')
        ..writeVarUint8Array(Uint8List.fromList([1, 2, 3, 250]));
      final dec = Lib0Decoder(enc.toBytes());
      expect(dec.readVarString(), 'WebPeer ✓');
      expect(dec.readVarUint8Array(), [1, 2, 3, 250]);
    });

    test('decodes an awareness-update payload shape', () {
      // numClients=1, id=42, clock=7, state={"user":{"name":"A"}}
      final enc = Lib0Encoder()
        ..writeVarUint(1)
        ..writeVarUint(42)
        ..writeVarUint(7)
        ..writeVarString('{"user":{"name":"A"}}');
      final dec = Lib0Decoder(enc.toBytes());
      expect(dec.readVarUint(), 1);
      expect(dec.readVarUint(), 42);
      expect(dec.readVarUint(), 7);
      expect(dec.readVarString(), '{"user":{"name":"A"}}');
      expect(dec.hasMore, isFalse);
    });
  });
}
