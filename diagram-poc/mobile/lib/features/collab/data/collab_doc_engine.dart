import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_js/flutter_js.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as ws_status;

import 'sync_protocol.dart';

/// Live **document** co-editing: joins the web editor's Y.Doc room and merges
/// edits with full CRDT semantics.
///
/// Design (verified end-to-end in `tool/verify_collab_engine.mjs`, RESULT PASS):
/// the Yjs document lives in a bundled JS core run by [flutter_js]; this Dart
/// class owns the WebSocket and speaks the y-websocket *sync* protocol
/// ([SyncProtocol]), driving the core with synchronous string calls. Binary Yjs
/// updates cross the boundary as base64.
///
/// The transport + CRDT core are verified against a real web peer. The
/// [flutter_js] runtime binding itself runs only on a device/emulator (native
/// QuickJS), so exercise this on-device; it is opt-in and never on the default
/// path.
class CollabDocEngine {
  CollabDocEngine({
    required this.wsBaseUrl,
    required this.diagramId,
    required this.onRemoteModel,
  });

  final String wsBaseUrl;
  final int diagramId;

  /// Called with the merged {nodes, links} model whenever remote edits arrive.
  final void Function(Map<String, dynamic> model) onRemoteModel;

  static const String _asset = 'assets/collab/ydoc_core.bundle.js';

  JavascriptRuntime? _js;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _sub;
  bool _ready = false;

  Uri get _roomUri => Uri.parse('$wsBaseUrl/gojs-$diagramId');

  /// Load the CRDT core into the JS runtime.
  Future<void> init() async {
    final runtime = getJavascriptRuntime();
    final code = await rootBundle.loadString(_asset);
    runtime.evaluate(code); // sets globalThis.CollabCore
    _js = runtime;
    _ready = true;
  }

  void connect() {
    if (!_ready) return;
    final channel = WebSocketChannel.connect(_roomUri);
    _channel = channel;
    _sub = channel.stream.listen(_onMessage, cancelOnError: true);
    // Sync step 1: advertise our state vector so the peer sends what we lack.
    _send(SyncProtocol.step1(_b64ToBytes(_call('stateVector()'))));
  }

  // ---- local edits (call after mutating the diagram) ----

  void setNode(String key, Map<String, dynamic> data) {
    _callVoid('setNode(${_arg(key)}, ${_argJson(data)})');
    _broadcastLocal();
  }

  void setLink(String key, Map<String, dynamic> data) {
    _callVoid('setLink(${_arg(key)}, ${_argJson(data)})');
    _broadcastLocal();
  }

  void deleteNode(String key) {
    _callVoid('deleteNode(${_arg(key)})');
    _broadcastLocal();
  }

  void deleteLink(String key) {
    _callVoid('deleteLink(${_arg(key)})');
    _broadcastLocal();
  }

  /// Seed an empty room from the current diagram (first participant).
  void seed(List<Map<String, dynamic>> nodes, List<Map<String, dynamic>> links) {
    _callVoid('seed(${_argJson(nodes)}, ${_argJson(links)})');
    _broadcastLocal();
  }

  /// Merge the whole local model into the shared document (upsert every cell).
  /// CRDT semantics mean this converges with concurrent remote edits.
  void pushModel(Map<String, dynamic> model) {
    final nodes = (model['nodes'] as List? ?? const []).whereType<Map>();
    final links = (model['links'] as List? ?? const []).whereType<Map>();
    for (final n in nodes) {
      final key = '${n['key']}';
      if (key.isNotEmpty) _callVoid('setNode(${_arg(key)}, ${_argJson(n)})');
    }
    for (final l in links) {
      final key = '${l['key'] ?? '${l['from']}->${l['to']}'}';
      _callVoid('setLink(${_arg(key)}, ${_argJson(l)})');
    }
    _broadcastLocal();
  }

  // ---- protocol ----

  void _onMessage(dynamic data) {
    if (data is! List<int>) return;
    final msg = parseFirstMessage(Uint8List.fromList(data));
    if (msg == null || !msg.isSync) return;
    switch (msg.subtype) {
      case SyncProtocol.syncStep1:
        // Peer's state vector → reply with everything they're missing.
        final updateB64 = _call('encodeUpdate(${_arg(base64.encode(msg.payload))})');
        _send(SyncProtocol.step2(_b64ToBytes(updateB64)));
      case SyncProtocol.syncStep2:
      case SyncProtocol.syncUpdate:
        final modelJson = _call('applyRemote(${_arg(base64.encode(msg.payload))})');
        _emitModel(modelJson);
    }
  }

  void _broadcastLocal() {
    final drained = _call('drainLocal()');
    final updates = (jsonDecode(drained) as List).cast<String>();
    for (final u in updates) {
      _send(SyncProtocol.update(_b64ToBytes(u)));
    }
  }

  void _emitModel(String modelJson) {
    try {
      final model = jsonDecode(modelJson) as Map<String, dynamic>;
      onRemoteModel(model);
    } catch (_) {
      /* ignore malformed */
    }
  }

  // ---- JS bridge helpers ----

  String _call(String expr) => _js?.evaluate('CollabCore.$expr').stringResult ?? '';
  void _callVoid(String expr) => _js?.evaluate('CollabCore.$expr');
  String _arg(String s) => jsonEncode(s);
  String _argJson(Object value) => jsonEncode(jsonEncode(value));

  Uint8List _b64ToBytes(String s) => base64.decode(s);

  void _send(Uint8List bytes) {
    try {
      _channel?.sink.add(bytes);
    } catch (e) {
      debugPrint('collab-doc send failed: $e');
    }
  }

  void dispose() {
    _sub?.cancel();
    _channel?.sink.close(ws_status.normalClosure);
    _js?.dispose();
  }
}
