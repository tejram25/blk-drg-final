import 'dart:typed_data';

import 'lib0.dart';

/// The y-websocket **sync** sub-protocol framing (message type 0), built on the
/// same `lib0` var-int codec as awareness. This is the Dart translation of the
/// transport verified in `tool/verify_collab_engine`* against a real web peer.
///
///   message   = varUint(type) …
///   type 0    = sync:  varUint(subtype) varUint8Array(payload)
///   subtype 0 = step1  (payload = state vector)   → reply with step2
///   subtype 1 = step2  (payload = update)         → apply
///   subtype 2 = update (payload = update)         → apply
///   type 1    = awareness (handled by CollabService)
class SyncProtocol {
  static const int messageSync = 0;
  static const int messageAwareness = 1;

  static const int syncStep1 = 0;
  static const int syncStep2 = 1;
  static const int syncUpdate = 2;

  static Uint8List step1(Uint8List stateVector) =>
      _frame(syncStep1, stateVector);

  static Uint8List step2(Uint8List update) => _frame(syncStep2, update);

  static Uint8List update(Uint8List u) => _frame(syncUpdate, u);

  static Uint8List _frame(int subtype, Uint8List payload) {
    return (Lib0Encoder()
          ..writeVarUint(messageSync)
          ..writeVarUint(subtype)
          ..writeVarUint8Array(payload))
        .toBytes();
  }
}

/// A decoded frame: a sync message (with its subtype + payload) or a
/// non-sync message whose payload we skip.
class SyncMessage {
  SyncMessage({required this.type, required this.subtype, required this.payload});

  final int type;
  final int subtype; // -1 for non-sync
  final Uint8List payload;

  bool get isSync => type == SyncProtocol.messageSync;
}

/// Parse the leading message of a y-websocket frame. Frames usually carry a
/// single message; we read the first (sync/awareness) and stop.
SyncMessage? parseFirstMessage(Uint8List bytes) {
  final d = Lib0Decoder(bytes);
  if (!d.hasMore) return null;
  final type = d.readVarUint();
  if (type == SyncProtocol.messageSync) {
    final subtype = d.readVarUint();
    return SyncMessage(type: type, subtype: subtype, payload: d.readVarUint8Array());
  }
  // Awareness / auth: the rest is a single var-uint8array payload.
  final payload = d.hasMore ? d.readVarUint8Array() : Uint8List(0);
  return SyncMessage(type: type, subtype: -1, payload: payload);
}
