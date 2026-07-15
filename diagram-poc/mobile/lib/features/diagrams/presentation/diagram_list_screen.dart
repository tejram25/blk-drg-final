import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/presentation/auth_controller.dart';
import '../domain/diagram_summary.dart';
import 'diagram_list_controller.dart';

class DiagramListScreen extends ConsumerWidget {
  const DiagramListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final diagrams = ref.watch(diagramListControllerProvider);
    final user = ref.watch(authControllerProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Diagrams'),
        actions: [
          if (user != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: PopupMenuButton<String>(
                onSelected: (v) async {
                  if (v == 'logout') {
                    await ref.read(authControllerProvider.notifier).logout();
                    if (context.mounted) context.go('/login');
                  }
                },
                itemBuilder: (_) => [
                  PopupMenuItem(
                    enabled: false,
                    child: Text(user.name.isEmpty ? user.email : user.name),
                  ),
                  const PopupMenuItem(value: 'logout', child: Text('Sign out')),
                ],
                child: CircleAvatar(
                  radius: 16,
                  child: Text(user.initials,
                      style: const TextStyle(fontSize: 12)),
                ),
              ),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _createDiagram(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New'),
      ),
      body: diagrams.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(
          message: '$e',
          onRetry: () => ref.read(diagramListControllerProvider.notifier).refresh(),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const _EmptyState();
          }
          return RefreshIndicator(
            onRefresh: () =>
                ref.read(diagramListControllerProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) =>
                  _DiagramTile(summary: items[i]),
            ),
          );
        },
      ),
    );
  }

  Future<void> _createDiagram(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController(text: 'Untitled diagram');
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New diagram'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Name'),
          onSubmitted: (v) => Navigator.pop(ctx, v),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text),
              child: const Text('Create')),
        ],
      ),
    );
    if (name == null || name.trim().isEmpty) return;
    final id = await ref
        .read(diagramListControllerProvider.notifier)
        .createBlank(name.trim());
    if (id != null && context.mounted) context.go('/editor/$id');
  }
}

class _DiagramTile extends ConsumerWidget {
  const _DiagramTile({required this.summary});

  final DiagramSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.schema_outlined),
        title: Text(summary.name),
        subtitle: Text(_subtitle()),
        onTap: () => context.go('/editor/${summary.id}'),
        trailing: IconButton(
          icon: const Icon(Icons.delete_outline),
          onPressed: () => _confirmDelete(context, ref),
        ),
      ),
    );
  }

  String _subtitle() {
    final owner = summary.ownerEmail;
    final when = summary.updatedAt;
    final whenStr = when == null
        ? ''
        : ' · ${when.year}-${when.month.toString().padLeft(2, '0')}-${when.day.toString().padLeft(2, '0')}';
    return '${summary.classification}${owner.isEmpty ? '' : ' · $owner'}$whenStr';
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete diagram?'),
        content: Text('“${summary.name}” will be permanently removed.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(diagramListControllerProvider.notifier).delete(summary.id);
    }
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.schema_outlined, size: 64),
          const SizedBox(height: 12),
          Text('No diagrams yet',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          const Text('Tap “New” to create your first one.'),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
