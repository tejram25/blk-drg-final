import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../collab/data/collab_service.dart';
import '../../comments/presentation/comments_sheet.dart';
import '../../diagrams/data/diagram_repository.dart';
import '../../parts/presentation/part_search_sheet.dart';
import '../../reviews/presentation/reviews_sheet.dart';
import '../../versions/presentation/versions_sheet.dart';
import 'diagram_canvas.dart';
import 'editor_controller.dart';
import 'palette_sheet.dart';

class EditorScreen extends ConsumerStatefulWidget {
  const EditorScreen({super.key, required this.diagramId});

  final int diagramId;

  @override
  ConsumerState<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends ConsumerState<EditorScreen> {
  late final EditorSession _session;
  CollabService? _collab;
  String? _selectedKey;
  bool _connectMode = false;
  String? _connectFrom;
  int _placeCounter = 0;

  @override
  void initState() {
    super.initState();
    _session = EditorSession(
      ref.read(diagramRepositoryProvider),
      widget.diagramId,
    );
    _session.load();

    // Live presence: join the same y-websocket room the web app uses.
    final user = ref.read(authControllerProvider).value;
    if (user != null) {
      _collab = CollabService(
        wsBaseUrl: AppConfig.collabWsUrl,
        diagramId: widget.diagramId,
        displayName: user.name.isEmpty ? user.email : user.name,
        uid: user.email,
      )..connect();
    }
  }

  @override
  void dispose() {
    _collab?.dispose();
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
              if (_collab != null)
                _PresenceBar(collab: _collab!),
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
              PopupMenuButton<String>(
                onSelected: _onMenu,
                itemBuilder: (_) => const [
                  PopupMenuItem(
                    value: 'comments',
                    child: ListTile(
                      leading: Icon(Icons.forum_outlined),
                      title: Text('Comments'),
                    ),
                  ),
                  PopupMenuItem(
                    value: 'reviews',
                    child: ListTile(
                      leading: Icon(Icons.star_border_rounded),
                      title: Text('Reviews & ratings'),
                    ),
                  ),
                  PopupMenuItem(
                    value: 'versions',
                    child: ListTile(
                      leading: Icon(Icons.history),
                      title: Text('Version history'),
                    ),
                  ),
                ],
              ),
            ],
          ),
          body: _buildBody(state),
          bottomNavigationBar:
              (!_session.loading && _session.error == null && state != null)
                  ? _bottomBar()
                  : null,
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
    if (state == null) {
      return const Center(
        child: Text('This diagram has no content to display yet.'),
      );
    }
    return Column(
      children: [
        if (_connectMode) _ConnectHint(armed: _connectFrom != null),
        Expanded(
          child: DiagramCanvas(
            graph: state.graph,
            selectedKey: _connectMode ? _connectFrom : _selectedKey,
            onSelect: _onCanvasSelect,
            onNodeMoved: _connectMode ? _ignoreMove : _session.moveNode,
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

  void _ignoreMove(String key, Offset _) {}

  void _onCanvasSelect(String? key) {
    if (!_connectMode) {
      setState(() => _selectedKey = key);
      return;
    }
    if (key == null) return;
    if (_connectFrom == null) {
      setState(() => _connectFrom = key);
    } else if (_connectFrom != key) {
      _session.addLink(_connectFrom!, key);
      setState(() {
        _connectFrom = null;
        _connectMode = false;
      });
    }
  }

  Future<void> _addFromPalette() async {
    final block = await PaletteSheet.show(context);
    if (block == null || !mounted) return;
    // Cascade new nodes near the middle of existing content.
    final bounds = _session.state?.graph.contentBounds();
    final base = bounds?.center ?? const Offset(200, 200);
    final pos = base + Offset(24.0 * (_placeCounter % 6), 24.0 * (_placeCounter % 6));
    _placeCounter++;
    final key = _session.addBlock(block, pos);
    setState(() => _selectedKey = key);
  }

  void _deleteSelected() {
    final key = _selectedKey;
    if (key == null) return;
    _session.deleteNode(key);
    setState(() => _selectedKey = null);
  }

  void _onMenu(String value) {
    switch (value) {
      case 'comments':
        CommentsSheet.show(context, widget.diagramId);
      case 'reviews':
        ReviewsSheet.show(context, widget.diagramId);
      case 'versions':
        VersionsSheet.show(
          context,
          diagramId: widget.diagramId,
          currentContent: _session.currentContentJson,
          onRestore: (content) {
            _session.loadContent(content);
            setState(() => _selectedKey = null);
          },
        );
    }
  }

  Future<void> _attachPart() async {
    final key = _selectedKey;
    if (key == null) return;
    final part = await PartSearchSheet.show(context);
    if (part == null || !mounted) return;
    _session.attachPart(key, part);
    final node = _session.state?.graph.nodesByKey[key];
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Attached ${part.partNumber} to "${node?.text ?? 'component'}"',
        ),
      ),
    );
  }

  Widget _bottomBar() {
    final hasSelection = _selectedKey != null;
    return BottomAppBar(
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.add_box_outlined),
            tooltip: 'Add from palette',
            onPressed: _addFromPalette,
          ),
          IconButton(
            isSelected: _connectMode,
            icon: const Icon(Icons.timeline),
            tooltip: 'Connect two components',
            onPressed: () => setState(() {
              _connectMode = !_connectMode;
              _connectFrom = null;
            }),
          ),
          IconButton(
            icon: const Icon(Icons.memory),
            tooltip: 'Attach part to selected',
            onPressed: hasSelection ? _attachPart : null,
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: 'Delete selected',
            onPressed: hasSelection ? _deleteSelected : null,
          ),
        ],
      ),
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

/// A compact avatar stack of the other participants currently in the session,
/// driven by [CollabService] presence.
class _PresenceBar extends StatelessWidget {
  const _PresenceBar({required this.collab});

  final CollabService collab;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: collab,
      builder: (context, _) {
        final peers = collab.peers;
        if (peers.isEmpty) return const SizedBox.shrink();
        const maxShown = 3;
        final shown = peers.take(maxShown).toList();
        final extra = peers.length - shown.length;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < shown.length; i++)
                  Align(
                    widthFactor: 0.7,
                    child: _Avatar(peer: shown[i]),
                  ),
                if (extra > 0)
                  Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: Text('+$extra',
                        style: Theme.of(context).textTheme.labelMedium),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.peer});

  final CollabPeer peer;

  Color get _color {
    final hex = peer.color.replaceFirst('#', '');
    final v = int.tryParse(hex.length == 6 ? 'FF$hex' : hex, radix: 16);
    return v == null ? Colors.blueGrey : Color(v);
  }

  @override
  Widget build(BuildContext context) {
    final initials = peer.name.trim().isEmpty
        ? '?'
        : peer.name
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((w) => w[0].toUpperCase())
            .join();
    return Tooltip(
      message: peer.name,
      child: CircleAvatar(
        radius: 14,
        backgroundColor: _color,
        child: Text(
          initials,
          style: const TextStyle(fontSize: 11, color: Colors.white),
        ),
      ),
    );
  }
}

class _ConnectHint extends StatelessWidget {
  const _ConnectHint({required this.armed});

  final bool armed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      color: scheme.primaryContainer,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(
        armed
            ? 'Tap the second component to connect'
            : 'Connect mode: tap the first component',
        style: TextStyle(color: scheme.onPrimaryContainer),
        textAlign: TextAlign.center,
      ),
    );
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
