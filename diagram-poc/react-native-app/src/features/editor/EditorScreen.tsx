import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { ScreenProps } from '../../navigation';
import { diagramsApi } from '../diagrams/diagramsApi';
import DiagramCanvas from './DiagramCanvas';
import { DiagramGraph, parseModel } from './model';

export default function EditorScreen({ route, navigation }: ScreenProps<'Editor'>) {
  const { id, name } = route.params;
  const q = useQuery({ queryKey: ['diagram', id], queryFn: () => diagramsApi.get(id) });

  const [graph, setGraph] = useState<DiagramGraph | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data) setGraph(parseModel(q.data.contentJson));
  }, [q.data]);

  const moveNode = (key: string, x: number, y: number) => {
    setGraph((g) => {
      if (!g) return g;
      const nodes = g.nodes.map((n) =>
        n.key === key ? { ...n, x, y, raw: { ...n.raw, loc: `${x} ${y}` } } : n,
      );
      return { ...g, nodes };
    });
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const content = JSON.stringify({
        class: 'GraphLinksModel',
        linkFromPortIdProperty: 'fromPort',
        linkToPortIdProperty: 'toPort',
        nodeDataArray: (graph?.nodes ?? []).map((n) => n.raw),
        linkDataArray: (graph?.links ?? []).map((l) => l.raw),
      });
      return diagramsApi.update(id, {
        name: q.data?.name ?? name ?? 'Untitled',
        contentJson: content,
        classification: q.data?.classification ?? 'INTERNAL',
      });
    },
    onSuccess: () => setDirty(false),
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtn}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {q.data?.name ?? name ?? 'Editor'}
        </Text>
        <Pressable hitSlop={10} disabled={!dirty || save.isPending} onPress={() => save.mutate()}>
          <Text style={[styles.headerBtn, { opacity: dirty ? 1 : 0.4 }]}>
            {save.isPending ? '…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.canvasWrap}>
        {q.isLoading || !graph ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : q.isError ? (
          <View style={styles.center}>
            <Text style={{ color: colors.danger }}>{(q.error as Error).message}</Text>
          </View>
        ) : (
          <DiagramCanvas
            graph={graph}
            selectedKey={selected}
            onSelect={setSelected}
            onNodeMove={moveNode}
          />
        )}
      </View>

      <View style={styles.status}>
        <Text style={styles.statusText}>
          {graph ? `${graph.nodes.length} nodes · ${graph.links.length} links` : ''}
        </Text>
        {selected ? (
          <Text style={styles.statusText} numberOfLines={1}>
            {'  ·  Selected: '}
            {graph?.nodes.find((n) => n.key === selected)?.text || selected}
          </Text>
        ) : null}
        {dirty ? <View style={styles.dot} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvasBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.canvasSurface,
  },
  headerBtn: { color: colors.canvasText, fontSize: 15, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.canvasText,
    fontSize: 17,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  canvasWrap: { flex: 1, backgroundColor: colors.canvasBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.canvasSurface,
  },
  statusText: { color: colors.canvasSubtext, fontSize: 12 },
  dot: { marginLeft: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
