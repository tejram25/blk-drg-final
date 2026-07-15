import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/catalog_repository.dart';
import '../domain/block_type.dart';

/// Bottom sheet listing the palette (blocks, shapes, electrical symbols),
/// grouped by category. Returns the chosen [BlockType] via [Navigator.pop].
class PaletteSheet extends ConsumerWidget {
  const PaletteSheet({super.key});

  static Future<BlockType?> show(BuildContext context) {
    return showModalBottomSheet<BlockType>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const PaletteSheet(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ref.watch(blockTypesProvider);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.92,
      builder: (context, scrollController) {
        return palette.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('$e')),
          data: (items) => _PaletteList(
            items: items,
            controller: scrollController,
          ),
        );
      },
    );
  }
}

class _PaletteList extends StatelessWidget {
  const _PaletteList({required this.items, required this.controller});

  final List<BlockType> items;
  final ScrollController controller;

  @override
  Widget build(BuildContext context) {
    // Preserve server order of categories but group entries under each.
    final categories = <String>[];
    final byCategory = <String, List<BlockType>>{};
    for (final b in items) {
      byCategory.putIfAbsent(b.category, () {
        categories.add(b.category);
        return [];
      }).add(b);
    }

    return CustomScrollView(
      controller: controller,
      slivers: [
        for (final cat in categories) ...[
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            sliver: SliverToBoxAdapter(
              child: Text(
                cat.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      letterSpacing: 0.8,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            sliver: SliverGrid(
              gridDelegate:
                  const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 180,
                mainAxisExtent: 52,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, i) => _PaletteChip(block: byCategory[cat]![i]),
                childCount: byCategory[cat]!.length,
              ),
            ),
          ),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: 24)),
      ],
    );
  }
}

class _PaletteChip extends StatelessWidget {
  const _PaletteChip({required this.block});

  final BlockType block;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => Navigator.pop(context, block),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: block.color ?? scheme.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: scheme.outlineVariant),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  block.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
