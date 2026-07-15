import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/version_repository.dart';
import '../domain/version.dart';

final versionsProvider =
    FutureProvider.family<List<VersionSummary>, int>((ref, diagramId) {
  return ref.watch(versionRepositoryProvider).list(diagramId);
});

/// Version history for a diagram: snapshot the current content, and restore a
/// past version back into the editor.
class VersionsSheet extends ConsumerStatefulWidget {
  const VersionsSheet({
    super.key,
    required this.diagramId,
    required this.currentContent,
    required this.onRestore,
  });

  final int diagramId;

  /// Serializes the editor's current content for a new snapshot.
  final String? Function() currentContent;

  /// Applies a restored version's content back into the editor.
  final void Function(String contentJson) onRestore;

  static Future<void> show(
    BuildContext context, {
    required int diagramId,
    required String? Function() currentContent,
    required void Function(String) onRestore,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => VersionsSheet(
        diagramId: diagramId,
        currentContent: currentContent,
        onRestore: onRestore,
      ),
    );
  }

  @override
  ConsumerState<VersionsSheet> createState() => _VersionsSheetState();
}

class _VersionsSheetState extends ConsumerState<VersionsSheet> {
  bool _busy = false;

  Future<void> _snapshot() async {
    final content = widget.currentContent();
    if (content == null || _busy) return;
    final label = await _askLabel();
    if (label == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(versionRepositoryProvider).snapshot(
            widget.diagramId,
            label.isEmpty ? 'Snapshot' : label,
            content,
          );
      ref.invalidate(versionsProvider(widget.diagramId));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _askLabel() async {
    final controller = TextEditingController(text: 'Snapshot');
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save a version'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Label'),
          onSubmitted: (v) => Navigator.pop(ctx, v),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text),
              child: const Text('Save')),
        ],
      ),
    );
  }

  Future<void> _restore(VersionSummary v) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Restore this version?'),
        content: Text(
          'The canvas will be replaced with “${v.label}”. '
          'You can still save or discard afterwards.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Restore')),
        ],
      ),
    );
    if (confirmed != true) return;
    final detail = await ref.read(versionRepositoryProvider).get(v.id);
    widget.onRestore(detail.contentJson);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final versions = ref.watch(versionsProvider(widget.diagramId));
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 8, 4),
              child: Row(
                children: [
                  const Icon(Icons.history, size: 20),
                  const SizedBox(width: 8),
                  Text('Version history',
                      style: Theme.of(context).textTheme.titleMedium),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: _busy ? null : _snapshot,
                    icon: const Icon(Icons.add),
                    label: const Text('Snapshot'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: versions.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('$e')),
                data: (items) => items.isEmpty
                    ? const Center(child: Text('No versions saved yet.'))
                    : ListView.separated(
                        controller: scrollController,
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final v = items[i];
                          return ListTile(
                            leading: const Icon(Icons.bookmark_outline),
                            title: Text(v.label),
                            subtitle: Text(_subtitle(v)),
                            trailing: TextButton(
                              onPressed: () => _restore(v),
                              child: const Text('Restore'),
                            ),
                          );
                        },
                      ),
              ),
            ),
          ],
        );
      },
    );
  }

  String _subtitle(VersionSummary v) {
    final when = v.createdAt;
    final w = when == null
        ? ''
        : '${when.year}-${when.month.toString().padLeft(2, '0')}-${when.day.toString().padLeft(2, '0')} ${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}';
    return [v.authorName, w].where((s) => s.isNotEmpty).join(' · ');
  }
}
