import 'dart:convert';
import 'dart:typed_data';

/// Minimal port of the parts of `lib0` encoding that the Yjs / y-websocket wire
/// protocol uses: unsigned LEB128-style var-ints, length-prefixed strings, and
/// length-prefixed byte arrays. Enough to speak the **awareness** sub-protocol
/// (presence) without a full Yjs implementation.

class Lib0Encoder {
  final BytesBuilder _b = BytesBuilder();

  Uint8List toBytes() => _b.toBytes();

  /// Unsigned var-int: 7 bits per byte, high bit = "more bytes follow".
  void writeVarUint(int value) {
    var v = value;
    while (v > 0x7f) {
      _b.addByte(0x80 | (v & 0x7f));
      v >>= 7;
    }
    _b.addByte(v & 0x7f);
  }

  void writeVarUint8Array(Uint8List bytes) {
    writeVarUint(bytes.length);
    _b.add(bytes);
  }

  void writeVarString(String s) {
    writeVarUint8Array(Uint8List.fromList(utf8.encode(s)));
  }
}

class Lib0Decoder {
  Lib0Decoder(this.bytes);

  final Uint8List bytes;
  int _pos = 0;

  bool get hasMore => _pos < bytes.length;

  int readVarUint() {
    var num = 0;
    var shift = 0;
    while (true) {
      final byte = bytes[_pos++];
      num |= (byte & 0x7f) << shift;
      if (byte < 0x80) return num;
      shift += 7;
    }
  }

  Uint8List readVarUint8Array() {
    final len = readVarUint();
    final out = Uint8List.sublistView(bytes, _pos, _pos + len);
    _pos += len;
    return out;
  }

  String readVarString() => utf8.decode(readVarUint8Array());
}
