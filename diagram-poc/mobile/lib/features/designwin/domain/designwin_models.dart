import '../../parts/domain/part.dart';

/// A customer from `/api/designwin/customers`.
class DwCustomer {
  const DwCustomer({
    required this.customerName,
    required this.billTo,
    required this.accountNumber,
    required this.status,
  });

  final String customerName;
  final String billTo;
  final String accountNumber;
  final String status;

  factory DwCustomer.fromJson(Map<String, dynamic> j) => DwCustomer(
        customerName: (j['customerName'] ?? '') as String,
        billTo: (j['billTo'] ?? '') as String,
        accountNumber: (j['accountNumber'] ?? '') as String,
        status: (j['status'] ?? '') as String,
      );
}

/// A design project under a customer.
class DwProject {
  const DwProject({
    required this.projectName,
    required this.projectId,
    required this.stage,
    required this.eau,
  });

  final String projectName;
  final String projectId;
  final String stage;
  final String eau;

  factory DwProject.fromJson(Map<String, dynamic> j) => DwProject(
        projectName: (j['projectName'] ?? '') as String,
        projectId: (j['projectId'] ?? '') as String,
        stage: (j['stage'] ?? '') as String,
        eau: '${j['eau'] ?? ''}',
      );
}

/// A registered board under a project.
class DwBoard {
  const DwBoard({
    required this.boardName,
    required this.boardNum,
    required this.registrationNum,
    required this.status,
  });

  final String boardName;
  final String boardNum;
  final String registrationNum;
  final String status;

  factory DwBoard.fromJson(Map<String, dynamic> j) => DwBoard(
        boardName: (j['boardName'] ?? '') as String,
        boardNum: (j['boardNum'] ?? '') as String,
        registrationNum: (j['registrationNum'] ?? '') as String,
        status: (j['status'] ?? '') as String,
      );
}

/// A customer part on a board — convertible to a catalogue [Part] for attach.
class DwCustPart {
  const DwCustPart({
    required this.partNumber,
    required this.mfrName,
    required this.description,
    required this.quantity,
  });

  final String partNumber;
  final String mfrName;
  final String description;
  final int quantity;

  factory DwCustPart.fromJson(Map<String, dynamic> j) => DwCustPart(
        partNumber: (j['partNumber'] ?? '') as String,
        mfrName: (j['mfrName'] ?? '') as String,
        description: (j['description'] ?? '') as String,
        quantity: int.tryParse('${j['quantity'] ?? 1}') ?? 1,
      );

  Part toPart() => Part(
        partNumber: partNumber,
        manufacturer: mfrName,
        supplier: '',
        description: description,
      );
}
