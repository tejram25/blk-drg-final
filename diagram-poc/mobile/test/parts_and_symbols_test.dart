import 'package:blk_drg_mobile/features/editor/domain/electrical_symbols.g.dart';
import 'package:blk_drg_mobile/features/editor/presentation/symbol_painter.dart';
import 'package:blk_drg_mobile/features/parts/domain/part.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('electrical symbols', () {
    test('the symbol set is populated and keyed by shape id', () {
      expect(kElectricalSymbols.length, greaterThan(50));
      expect(kElectricalSymbols.containsKey('elec-resistor'), isTrue);
      expect(kElectricalSymbols['elec-resistor']!.pins.length, 2);
    });

    test('symbolFor resolves elec shapes and rejects others', () {
      expect(symbolFor('elec-npn'), isNotNull);
      expect(symbolFor('block'), isNull);
      expect(symbolFor(null), isNull);
    });

    test('every symbol has a meta entry', () {
      for (final key in kElectricalSymbols.keys) {
        expect(kElectricalMeta.containsKey(key), isTrue, reason: key);
      }
    });
  });

  group('Part.fromArrow', () {
    test('flattens the Arrow-shaped part payload', () {
      final part = Part.fromArrow({
        'arwPartNum': {'name': 'INA228AIDGSR'},
        'mfr': {'name': 'Texas Instruments'},
        'supp': {'name': 'Arrow'},
        'invOrgs': [
          {'desc': 'Current/Power Monitor'},
        ],
      });
      expect(part.partNumber, 'INA228AIDGSR');
      expect(part.manufacturer, 'Texas Instruments');
      expect(part.supplier, 'Arrow');
      expect(part.description, 'Current/Power Monitor');
    });

    test('falls back through supplier PN and partKey', () {
      final part = Part.fromArrow({'partKey': 'XYZ123'});
      expect(part.partNumber, 'XYZ123');
    });

    test('round-trips through the attachedParts json shape', () {
      const part = Part(
        partNumber: 'LM317',
        manufacturer: 'TI',
        supplier: 'Arrow',
        description: 'LDO',
      );
      final restored = Part.fromJson(part.toJson());
      expect(restored.partNumber, 'LM317');
      expect(restored.description, 'LDO');
    });
  });
}
