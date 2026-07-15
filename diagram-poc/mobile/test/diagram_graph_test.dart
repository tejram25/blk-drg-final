import 'dart:convert';

import 'package:blk_drg_mobile/features/editor/domain/diagram_graph.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DiagramGraph.parse', () {
    test('parses a GoJS GraphLinksModel with nodes and links', () {
      final json = jsonEncode({
        'class': 'GraphLinksModel',
        'nodeDataArray': [
          {'key': 'a', 'text': 'MCU', 'loc': '40 60', 'size': '120 60'},
          {'key': 'b', 'text': 'Sensor', 'loc': '300 60', 'color': '#1d4ed8'},
        ],
        'linkDataArray': [
          {'from': 'a', 'to': 'b', 'wire': true},
        ],
      });

      final graph = DiagramGraph.parse(json);

      expect(graph.nodes.length, 2);
      expect(graph.links.length, 1);
      expect(graph.nodesByKey['a']!.text, 'MCU');
      expect(graph.nodesByKey['a']!.position.dx, 40);
      expect(graph.nodesByKey['a']!.size.width, 120);
      expect(graph.nodesByKey['b']!.color, isNotNull);
      expect(graph.links.first.isWire, isTrue);
    });

    test('returns an empty graph on blank or malformed input', () {
      expect(DiagramGraph.parse('').isEmpty, isTrue);
      expect(DiagramGraph.parse('not json').isEmpty, isTrue);
      expect(DiagramGraph.parse('{"foo":1}').isEmpty, isTrue);
    });

    test('contentBounds expands to include every node', () {
      final json = jsonEncode({
        'nodeDataArray': [
          {'key': 'a', 'loc': '0 0', 'size': '100 50'},
          {'key': 'b', 'loc': '200 100', 'size': '100 50'},
        ],
      });
      final bounds = DiagramGraph.parse(json).contentBounds();
      expect(bounds.left, 0);
      expect(bounds.right, 300);
      expect(bounds.bottom, 150);
    });
  });
}
