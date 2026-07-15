import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../parts/domain/part.dart';
import '../data/designwin_repository.dart';
import '../domain/designwin_models.dart';

/// A drill-down browser of the Arrow Design-Win hierarchy:
/// customers → projects → boards → parts. Returns the chosen [DwCustPart]'s
/// [Part] (with its board quantity) via [Navigator.pop].
class DesignWinSheet extends ConsumerStatefulWidget {
  const DesignWinSheet({super.key});

  static Future<({Part part, int quantity})?> show(BuildContext context) {
    return showModalBottomSheet<({Part part, int quantity})>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const DesignWinSheet(),
    );
  }

  @override
  ConsumerState<DesignWinSheet> createState() => _DesignWinSheetState();
}

enum _Step { customers, projects, boards, parts }

class _DesignWinSheetState extends ConsumerState<DesignWinSheet> {
  _Step _step = _Step.customers;
  DwCustomer? _customer;
  DwProject? _project;
  DwBoard? _board;

  bool _loading = true;
  String? _error;
  List<Object> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(designWinRepositoryProvider);
      final List<Object> items = switch (_step) {
        _Step.customers => await repo.customers(),
        _Step.projects => await repo.projects(_customer!.customerName),
        _Step.boards => await repo.boards(_project!.projectId),
        _Step.parts => await repo.custParts(
            projectId: _project!.projectId,
            boardNum: _board!.boardNum,
          ),
      };
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _drill(_Step next, {DwCustomer? c, DwProject? p, DwBoard? b}) {
    setState(() {
      _step = next;
      if (c != null) _customer = c;
      if (p != null) _project = p;
      if (b != null) _board = b;
    });
    _load();
  }

  void _back() {
    final prev = switch (_step) {
      _Step.parts => _Step.boards,
      _Step.boards => _Step.projects,
      _Step.projects => _Step.customers,
      _Step.customers => _Step.customers,
    };
    if (prev == _step) {
      Navigator.pop(context);
      return;
    }
    setState(() => _step = prev);
    _load();
  }

  String get _title => switch (_step) {
        _Step.customers => 'Design Win — Customers',
        _Step.projects => _customer?.customerName ?? 'Projects',
        _Step.boards => _project?.projectName ?? 'Boards',
        _Step.parts => _board?.boardName ?? 'Parts',
      };

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 16, 4),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(_step == _Step.customers
                        ? Icons.close
                        : Icons.arrow_back),
                    onPressed: _back,
                  ),
                  Expanded(
                    child: Text(_title,
                        style: Theme.of(context).textTheme.titleMedium,
                        overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
            ),
            Expanded(child: _body(scrollController)),
          ],
        );
      },
    );
  }

  Widget _body(ScrollController controller) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(_error!, textAlign: TextAlign.center),
        ),
      );
    }
    if (_items.isEmpty) {
      return const Center(child: Text('Nothing here.'));
    }
    return ListView.separated(
      controller: controller,
      itemCount: _items.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) => _tile(_items[i]),
    );
  }

  Widget _tile(Object item) {
    switch (item) {
      case final DwCustomer c:
        return ListTile(
          leading: const Icon(Icons.business_outlined),
          title: Text(c.customerName),
          subtitle: Text('${c.accountNumber} · ${c.status}'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => _drill(_Step.projects, c: c),
        );
      case final DwProject p:
        return ListTile(
          leading: const Icon(Icons.folder_outlined),
          title: Text(p.projectName),
          subtitle: Text('${p.stage} · EAU ${p.eau}'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => _drill(_Step.boards, p: p),
        );
      case final DwBoard b:
        return ListTile(
          leading: const Icon(Icons.developer_board_outlined),
          title: Text(b.boardName),
          subtitle: Text('${b.boardNum} · ${b.status}'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => _drill(_Step.parts, b: b),
        );
      case final DwCustPart part:
        return ListTile(
          leading: const Icon(Icons.memory),
          title: Text(part.partNumber),
          subtitle: Text(
            [part.mfrName, part.description, 'Qty ${part.quantity}']
                .where((s) => s.isNotEmpty)
                .join(' · '),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: const Icon(Icons.add_link),
          onTap: () => Navigator.pop(
            context,
            (part: part.toPart(), quantity: part.quantity),
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
