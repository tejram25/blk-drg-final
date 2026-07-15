import 'package:blk_drg_mobile/features/designwin/domain/designwin_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Design-Win models', () {
    test('parses a customer', () {
      final c = DwCustomer.fromJson({
        'customerName': 'Tesla Motors Inc',
        'accountNumber': 'ACCT-1001',
        'billTo': 'BILL-55021',
        'status': 'Active',
      });
      expect(c.customerName, 'Tesla Motors Inc');
      expect(c.billTo, 'BILL-55021');
    });

    test('parses a project and board', () {
      final p = DwProject.fromJson({
        'projectName': 'Model Y — BMS Refresh',
        'projectId': 'PRJ-88213',
        'stage': 'Design In',
        'eau': '120000',
      });
      expect(p.projectId, 'PRJ-88213');
      expect(p.eau, '120000');

      final b = DwBoard.fromJson({
        'boardName': 'BMS Master Controller',
        'boardNum': 'BMS-REV-C',
        'registrationNum': 'REG-4471209',
        'status': 'Registered',
      });
      expect(b.boardNum, 'BMS-REV-C');
    });

    test('converts a customer part to a catalogue Part with quantity', () {
      final part = DwCustPart.fromJson({
        'partNumber': 'LTC6811HG-1',
        'mfrName': 'Analog Devices',
        'description': 'Multicell Battery Stack Monitor, 12-cell',
        'quantity': '12',
      });
      expect(part.quantity, 12);
      final asPart = part.toPart();
      expect(asPart.partNumber, 'LTC6811HG-1');
      expect(asPart.manufacturer, 'Analog Devices');
    });
  });
}
