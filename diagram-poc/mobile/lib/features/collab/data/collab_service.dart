import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as ws_status;

import 'lib0.dart';

/// A remote participant in the session (from Yjs awareness).
class CollabPeer {
  const CollabPeer({required this.uid, required this.name, required this.color});

  final String uid;
  final String name;
  final String color;
}

/// Live presence for a diagram, interoperating with the web app's
/// **y-websocket** relay via the Yjs *awareness* sub-protocol.
///
/// This deliberately implements presence only (who is in the room, their name
/// and color) — not the CRDT document itself, which would require a full Yjs
/// port. Awareness is a self-contained sub-protocol, so mobile participants
/// show up in the web roster and vice-versa.
///
/// Wire format (matching y-protocols):
///   message        = varUint(messageType) …
///   messageType 1  = awareness: varUint8Array(update)
///   update         = varUint(numClients){ varUint(id) varUint(clock) varString(json) }
///   messageType 3  = queryAwareness (request peers to announce)
class CollabService extends ChangeNotifier {
  CollabService({
    required this.wsBaseUrl,
    required this.diagramId,
    required this.displayName,
    required this.uid,
  }) : clientId = Random().nextInt(0x7fffffff) {
    color = _palette[clientId % _palette.length];
  }

  final String wsBaseUrl;
  final int diagramId;
  final String displayName;
  final String uid;
  final int clientId;
  late final String color;

  static const int _msgAwareness = 1;
  static const int _msgQueryAwareness = 3;
  static const List<String> _palette = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  ];

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _sub;
  Timer? _heartbeat;
  Timer? _reconnect;
  int _clock = 0;
  bool _disposed = false;

  bool connected = false;

  /// Remote peers by their awareness client id (self excluded).
  final Map<int, CollabPeer> _peers = {};
  List<CollabPeer> get peers => _peers.values.toList(growable: false);

  Uri get _roomUri => Uri.parse('$wsBaseUrl/gojs-$diagramId');

  void connect() {
    if (_disposed) return;
    _reconnect?.cancel();
    try {
      final channel = WebSocketChannel.connect(_roomUri);
      _channel = channel;
      _sub = channel.stream.listen(
        _onMessage,
        onDone: _onClosed,
        onError: (_) => _onClosed(),
        cancelOnError: true,
      );
      connected = true;
      _announce(); // tell peers we are here
      _send(_query()); // ask peers to announce themselves
      _heartbeat?.cancel();
      _heartbeat = Timer.periodic(const Duration(seconds: 15), (_) => _announce());
      notifyListeners();
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _onClosed() {
    connected = false;
    _peers.clear();
    notifyListeners();
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_disposed) return;
    _reconnect?.cancel();
    _reconnect = Timer(const Duration(seconds: 3), connect);
  }

  void _onMessage(dynamic data) {
    if (data is! List<int>) return;
    final decoder = Lib0Decoder(Uint8List.fromList(data));
    while (decoder.hasMore) {
      final type = decoder.readVarUint();
      if (type == _msgAwareness) {
        _applyAwareness(decoder.readVarUint8Array());
      } else if (type == _msgQueryAwareness) {
        _announce();
        break;
      } else {
        // Sync / auth messages: we don't hold the CRDT doc, so ignore the rest
        // of this frame (we can't reliably skip a single sync message).
        break;
      }
    }
  }

  void _applyAwareness(Uint8List update) {
    final d = Lib0Decoder(update);
    final count = d.readVarUint();
    for (var i = 0; i < count; i++) {
      final id = d.readVarUint();
      d.readVarUint(); // clock — peers already de-dupe server-side
      final json = d.readVarString();
      if (id == clientId) continue;
      dynamic state;
      try {
        state = jsonDecode(json);
      } catch (_) {
        continue;
      }
      if (state == null) {
        _peers.remove(id);
        continue;
      }
      final user = (state is Map) ? state['user'] : null;
      if (user is Map) {
        _peers[id] = CollabPeer(
          uid: '${user['uid'] ?? id}',
          name: '${user['name'] ?? 'User'}',
          color: '${user['color'] ?? color}',
        );
      }
    }
    notifyListeners();
  }

  /// Broadcast our presence (name + color) to the room.
  void _announce() {
    if (!connected) return;
    _send(_awarenessMessage(jsonEncode({
      'user': {'name': displayName, 'color': color, 'uid': uid},
    })));
  }

  Uint8List _awarenessMessage(String stateJson) {
    final payload = Lib0Encoder()
      ..writeVarUint(1) // one client (us)
      ..writeVarUint(clientId)
      ..writeVarUint(++_clock)
      ..writeVarString(stateJson);
    final msg = Lib0Encoder()
      ..writeVarUint(_msgAwareness)
      ..writeVarUint8Array(payload.toBytes());
    return msg.toBytes();
  }

  Uint8List _query() =>
      (Lib0Encoder()..writeVarUint(_msgQueryAwareness)).toBytes();

  void _send(Uint8List bytes) {
    try {
      _channel?.sink.add(bytes);
    } catch (_) {
      /* dropped; reconnect logic will recover */
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _heartbeat?.cancel();
    _reconnect?.cancel();
    if (connected) {
      _send(_awarenessMessage('null')); // tombstone: remove us from peers
    }
    _sub?.cancel();
    _channel?.sink.close(ws_status.normalClosure);
    super.dispose();
  }
}
