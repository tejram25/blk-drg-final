import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../diagrams/data/diagram_repository.dart';
import 'diagram_canvas.dart';
import 'editor_controller.dart';

class EditorScreen extends ConsumerStatefulWidget {
  const EditorScreen({super.key, required this.diagramId});

  final int diagramId;

  @override
  ConsumerState<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends ConsumerState<EditorScreen> {
  late final EditorSession _session;
  String? _selectedKey;

  @override
  void initState() {
    super.initState();
    _session = EditorSession(
      ref.read(diagramRepositoryProvider),
      widget.diagramId,
    );
    _session.load();
  }

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _session,
      builder: (context, _) {
        final state = _session.state;
        return Scaffold(
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => context.go('/diagrams'),
            ),
            title: Text(state?.detail.name ?? 'Editor'),
            actions: [
              if (state?.saving == true)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Center(
                    child: SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              else
                IconButton(
                  icon: const Icon(Icons.save_outlined),
                  tooltip: 'Save',
                  onPressed: (state?.dirty ?? false) ? _save : null,
                ),
            ],
          ),
          body: _buildBody(state),
        );
      },
    );
  }

  Widget _buildBody(EditorState? state) {
    if (_session.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_session.error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48),
              const SizedBox(height: 12),
              Text('${_session.error}', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _session.load,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    if (state == null || state.graph.isEmpty) {
      return const Center(
        child: Text('This diagram has no content to display yet.'),
      );
    }
    return Column(
      children: [
        Expanded(
          child: DiagramCanvas(
            graph: state.graph,
            selectedKey: _selectedKey,
            onSelect: (k) => setState(() => _selectedKey = k),
            onNodeMoved: _session.moveNode,
          ),
        ),
        _StatusBar(
          nodeCount: state.graph.nodes.length,
          linkCount: state.graph.links.length,
          selected: _selectedKey == null
              ? null
              : state.graph.nodesByKey[_selectedKey]?.text,
          dirty: state.dirty,
        ),
      ],
    );
  }

  Future<void> _save() async {
    await _session.save();
    if (mounted && _session.error == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved')),
      );
    }
  }
}

class _StatusBar extends StatelessWidget {
  const _StatusBar({
    required this.nodeCount,
    required this.linkCount,
    required this.selected,
    required this.dirty,
  });

  final int nodeCount;
  final int linkCount;
  final String? selected;
  final bool dirty;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: scheme.surface,
      child: Row(
        children: [
          Text('$nodeCount nodes · $linkCount links',
              style: Theme.of(context).textTheme.bodySmall),
          const Spacer(),
          if (selected != null && selected!.isNotEmpty)
            Flexible(
              child: Text('Selected: $selected',
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall),
            ),
          if (dirty)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Icon(Icons.circle, size: 8, color: scheme.primary),
            ),
        ],
      ),
    );
  }
}
