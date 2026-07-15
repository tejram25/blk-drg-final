@Tags(['screenshots'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:blk_drg_mobile/app/theme.dart';
import 'package:blk_drg_mobile/features/auth/data/auth_repository.dart';
import 'package:blk_drg_mobile/features/auth/domain/user.dart';
import 'package:blk_drg_mobile/features/auth/presentation/login_screen.dart';
import 'package:blk_drg_mobile/features/diagrams/data/diagram_repository.dart';
import 'package:blk_drg_mobile/features/diagrams/domain/diagram_detail.dart';
import 'package:blk_drg_mobile/features/diagrams/domain/diagram_summary.dart';
import 'package:blk_drg_mobile/features/diagrams/presentation/diagram_list_screen.dart';
import 'package:blk_drg_mobile/features/editor/presentation/editor_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

// ---- fakes (no network) ----

class FakeAuthRepo implements AuthRepository {
  FakeAuthRepo({this.user});
  final User? user;
  @override
  Future<bool> inviteRequired() async => false;
  @override
  Future<User> login(String email, String password) async => user ?? const User(email: 'a@b.c', name: 'Ada Lovelace');
  @override
  Future<User> register({required String name, required String email, required String password, String? inviteCode}) async =>
      const User(email: 'a@b.c', name: 'Ada Lovelace');
  @override
  Future<User?> me() async => user;
  @override
  Future<void> logout() async {}
}

class FakeDiagramRepo implements DiagramRepository {
  @override
  Future<List<DiagramSummary>> list() async => [
        DiagramSummary(id: 1, name: '555 Timer Astable', classification: 'INTERNAL', ownerEmail: 'ada@corp.com', updatedAt: DateTime(2026, 7, 14)),
        DiagramSummary(id: 2, name: 'AMR Robot (FAST)', classification: 'CONFIDENTIAL', ownerEmail: 'ada@corp.com', updatedAt: DateTime(2026, 7, 12)),
        DiagramSummary(id: 3, name: 'BMS Master Controller', classification: 'INTERNAL', ownerEmail: 'marco@corp.com', updatedAt: DateTime(2026, 7, 9)),
      ];
  @override
  Future<DiagramDetail> get(int id) async => DiagramDetail(
        id: id, name: '555 Timer Astable', contentJson: _sampleModel,
        classification: 'INTERNAL', ownerEmail: 'ada@corp.com', updatedAt: DateTime(2026, 7, 14));
  @override
  Future<DiagramDetail> create({required String name, String contentJson = '', String classification = 'INTERNAL'}) async =>
      DiagramDetail(id: 9, name: name, contentJson: '', classification: classification, ownerEmail: 'ada@corp.com', updatedAt: DateTime.now());
  @override
  Future<DiagramDetail> update({required int id, required String name, required String contentJson, required String classification}) async =>
      DiagramDetail(id: id, name: name, contentJson: contentJson, classification: classification, ownerEmail: 'ada@corp.com', updatedAt: DateTime.now());
  @override
  Future<void> delete(int id) async {}
}

final _sampleModel = jsonEncode({
  'class': 'GraphLinksModel',
  'nodeDataArray': [
    {'key': 'U1', 'category': 'symbol', 'shape': 'elec-ic555', 'text': 'U1', 'size': '120 140', 'loc': '260 60'},
    {'key': 'R1', 'category': 'symbol', 'shape': 'elec-resistor', 'text': 'R1', 'size': '100 40', 'loc': '80 40'},
    {'key': 'R2', 'category': 'symbol', 'shape': 'elec-resistor', 'text': 'R2', 'size': '100 40', 'loc': '80 130'},
    {'key': 'C1', 'category': 'symbol', 'shape': 'elec-capacitor', 'text': 'C1', 'size': '100 40', 'loc': '80 240'},
    {'key': 'B1', 'category': 'block', 'text': 'Power 5V', 'color': '#1d4ed8', 'size': '150 64', 'loc': '60 360'},
    {'key': 'B2', 'category': 'block', 'text': 'LED Load', 'color': '#15803d', 'size': '150 64', 'loc': '470 360'},
  ],
  'linkDataArray': [
    {'from': 'R1', 'to': 'U1', 'wire': true},
    {'from': 'R2', 'to': 'U1', 'wire': true},
    {'from': 'C1', 'to': 'U1', 'wire': true},
    {'from': 'B1', 'to': 'U1'},
    {'from': 'U1', 'to': 'B2'},
  ],
});

Future<void> _loadFonts() async {
  const dir = '/opt/flutter/bin/cache/artifacts/material_fonts';
  Future<ByteData> bytes(String p) async =>
      ByteData.view(Uint8List.fromList(File(p).readAsBytesSync()).buffer);
  final roboto = FontLoader('Roboto')
    ..addFont(bytes('$dir/Roboto-Regular.ttf'))
    ..addFont(bytes('$dir/Roboto-Medium.ttf'))
    ..addFont(bytes('$dir/Roboto-Bold.ttf'));
  await roboto.load();
  final icons = FontLoader('MaterialIcons')..addFont(bytes('$dir/MaterialIcons-Regular.otf'));
  await icons.load();
}

ThemeData _themed(ThemeData base) =>
    base.copyWith(textTheme: base.textTheme.apply(fontFamily: 'Roboto'));

MaterialApp _app(Widget child, {ThemeData? theme}) => MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: _themed(theme ?? AppTheme.light),
      home: child,
    );

void main() {
  setUpAll(_loadFonts);

  void sizePhone(WidgetTester tester) {
    tester.view.physicalSize = const Size(1080, 2280);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('login screen', (tester) async {
    sizePhone(tester);
    await tester.pumpWidget(ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(FakeAuthRepo())],
      child: _app(const LoginScreen()),
    ));
    await tester.pumpAndSettle();
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('screenshots/01_login.png'));
  });

  testWidgets('diagram list', (tester) async {
    sizePhone(tester);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(FakeAuthRepo(user: const User(email: 'ada@corp.com', name: 'Ada Lovelace'))),
        diagramRepositoryProvider.overrideWithValue(FakeDiagramRepo()),
      ],
      child: _app(const DiagramListScreen()),
    ));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('screenshots/02_diagrams.png'));
  });

  testWidgets('editor with schematic', (tester) async {
    sizePhone(tester);
    // Null user → no live-presence WebSocket is created in the editor.
    await tester.pumpWidget(ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(FakeAuthRepo()),
        diagramRepositoryProvider.overrideWithValue(FakeDiagramRepo()),
      ],
      child: _app(const EditorScreen(diagramId: 1), theme: AppTheme.dark),
    ));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('screenshots/03_editor.png'));
  });
}
