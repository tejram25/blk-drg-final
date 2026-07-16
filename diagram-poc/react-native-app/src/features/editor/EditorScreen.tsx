import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../../theme';
import { ScreenProps } from '../../navigation';
import { diagramsApi } from '../diagrams/diagramsApi';
import { Part } from '../parts/partsApi';
import PartSearchModal from '../parts/PartSearchModal';
import DesignWinModal from '../designwin/DesignWinModal';
import CommentsModal from '../collab/CommentsModal';
import ReviewsModal from '../collab/ReviewsModal';
import VersionsModal from '../collab/VersionsModal';
import { BlockType } from './catalogApi';
import DiagramCanvas from './DiagramCanvas';
import { addLink, addNode, attachPart, deleteNode } from './editorOps';
import { contentBounds, DiagramGraph, parseModel } from './model';
import PaletteSheet from './PaletteSheet';

export default function EditorScreen({ route, navigation }: ScreenProps<'Editor'>) {
  const { id, name: initialName } = route.params;
  const q = useQuery({ queryKey: ['diagram', id], queryFn: () => diagramsApi.get(id) });

  const [graph, setGraph] = useState<DiagramGraph | null>(null);
  const [name, setName] = useState(initialName ?? 'Editor');
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [partOpen, setPartOpen] = useState(false);
  const [dwOpen, setDwOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<null | 'comments' | 'reviews' | 'versions'>(null);
  const placeCount = useRef(0);

  const serialize = () =>
    JSON.stringify({
      class: 'GraphLinksModel',
      linkFromPortIdProperty: 'fromPort',
      linkToPortIdProperty: 'toPort',
      nodeDataArray: (graph?.nodes ?? []).map((n) => n.raw),
      linkDataArray: (graph?.links ?? []).map((l) => l.raw),
    });

  useEffect(() => {
    if (q.data) {
      setGraph(parseModel(q.data.contentJson));
      setName(q.data.name);
    }
  }, [q.data]);

  const moveNode = (key: string, x: number, y: number) => {
    setGraph((g) =>
      !g ? g : { ...g, nodes: g.nodes.map((n) => (n.key === key ? { ...n, x, y, raw: { ...n.raw, loc: `${x} ${y}` } } : n)) },
    );
    setDirty(true);
  };

  const onSelect = (key: string | null) => {
    if (!connectMode) {
      setSelected(key);
      return;
    }
    if (!key) return;
    if (!connectFrom) {
      setConnectFrom(key);
    } else if (connectFrom !== key) {
      setGraph((g) => (g ? addLink(g, connectFrom, key) : g));
      setDirty(true);
      setConnectFrom(null);
      setConnectMode(false);
    }
  };

  const onPick = (block: BlockType) => {
    setGraph((g) => {
      if (!g) return g;
      const b = contentBounds(g);
      const off = 24 * (placeCount.current % 6);
      placeCount.current += 1;
      const { graph: ng, key } = addNode(g, block, b.x + b.w / 2 + off, b.y + b.h / 2 + off);
      setSelected(key);
      return ng;
    });
    setDirty(true);
  };

  const removeSelected = () => {
    if (!selected) return;
    setGraph((g) => (g ? deleteNode(g, selected) : g));
    setSelected(null);
    setDirty(true);
  };

  const onAttach = (part: Part, quantity = 1) => {
    if (!selected) return;
    setGraph((g) => (g ? attachPart(g, selected, part, quantity) : g));
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: () =>
      diagramsApi.update(id, {
        name,
        contentJson: serialize(),
        classification: q.data?.classification ?? 'INTERNAL',
      }),
    onSuccess: () => setDirty(false),
  });

  const restoreContent = (contentJson: string) => {
    setGraph(parseModel(contentJson));
    setSelected(null);
    setDirty(true);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtn}>‹ Back</Text>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => setRenaming(true)}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
        <Pressable hitSlop={10} disabled={!dirty || save.isPending} onPress={() => save.mutate()}>
          <Text style={[styles.headerBtn, { opacity: dirty ? 1 : 0.4 }]}>
            {save.isPending ? '…' : 'Save'}
          </Text>
        </Pressable>
        <Pressable hitSlop={10} onPress={() => setMenuOpen(true)} style={{ marginLeft: 14 }}>
          <Text style={styles.headerBtn}>⋯</Text>
        </Pressable>
      </View>

      {connectMode ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            {connectFrom ? 'Tap the second component to connect' : 'Connect: tap the first component'}
          </Text>
        </View>
      ) : null}

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
            selectedKey={connectMode ? connectFrom : selected}
            onSelect={onSelect}
            onNodeMove={connectMode ? () => {} : moveNode}
          />
        )}
      </View>

      <View style={styles.status}>
        <Text style={styles.statusText}>
          {graph ? `${graph.nodes.length} nodes · ${graph.links.length} links` : ''}
        </Text>
        {dirty ? <View style={styles.dot} /> : null}
      </View>

      <View style={styles.toolbar}>
        <ToolBtn label="＋ Add" onPress={() => setPaletteOpen(true)} />
        <ToolBtn
          label="🔗 Connect"
          active={connectMode}
          onPress={() => {
            setConnectMode((v) => !v);
            setConnectFrom(null);
          }}
        />
        <ToolBtn label="🔩 Part" disabled={!selected} onPress={() => setPartOpen(true)} />
        <ToolBtn label="🏷 DW" disabled={!selected} onPress={() => setDwOpen(true)} />
        <View style={{ flex: 1 }} />
        <ToolBtn label="🗑 Delete" disabled={!selected} onPress={removeSelected} />
      </View>

      <PaletteSheet visible={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={onPick} />
      <PartSearchModal visible={partOpen} onClose={() => setPartOpen(false)} onPick={(p) => onAttach(p)} />
      <DesignWinModal visible={dwOpen} onClose={() => setDwOpen(false)} onPick={(p, qty) => onAttach(p, qty)} />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            {(['comments', 'reviews', 'versions'] as const).map((p) => (
              <Pressable
                key={p}
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  setPanel(p);
                }}
              >
                <Text style={styles.menuText}>
                  {p === 'comments' ? '💬  Comments' : p === 'reviews' ? '★  Reviews & ratings' : '🕘  Version history'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <CommentsModal visible={panel === 'comments'} onClose={() => setPanel(null)} diagramId={id} />
      <ReviewsModal visible={panel === 'reviews'} onClose={() => setPanel(null)} diagramId={id} />
      <VersionsModal
        visible={panel === 'versions'}
        onClose={() => setPanel(null)}
        diagramId={id}
        currentContent={serialize}
        onRestore={restoreContent}
      />

      <RenameModal
        visible={renaming}
        value={name}
        onCancel={() => setRenaming(false)}
        onSave={(v) => {
          setRenaming(false);
          if (v.trim() && v.trim() !== name) {
            setName(v.trim());
            setDirty(true);
          }
        }}
      />
    </SafeAreaView>
  );
}

function ToolBtn({
  label,
  onPress,
  active,
  disabled,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.toolBtn, active && styles.toolBtnActive, { opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[styles.toolBtnText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function RenameModal({
  visible,
  value,
  onCancel,
  onSave,
}: {
  visible: boolean;
  value: string;
  onCancel: () => void;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value, visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Rename diagram</Text>
          <TextInput value={text} onChangeText={setText} style={styles.modalInput} autoFocus />
          <View style={styles.modalRow}>
            <Pressable onPress={onCancel}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onSave(text)}>
              <Text style={styles.modalSave}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  headerTitle: { textAlign: 'center', color: colors.canvasText, fontSize: 17, fontWeight: '700', marginHorizontal: 8 },
  hint: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 16 },
  hintText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  canvasWrap: { flex: 1, backgroundColor: colors.canvasBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.canvasSurface },
  statusText: { color: colors.canvasSubtext, fontSize: 12 },
  dot: { marginLeft: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.canvasSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2c2f36',
  },
  toolBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: '#22252b' },
  toolBtnActive: { backgroundColor: colors.primary },
  toolBtnText: { color: colors.canvasText, fontSize: 13, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, height: 46, fontSize: 16, color: colors.text },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 16 },
  modalCancel: { color: colors.subtext, fontSize: 15, fontWeight: '600' },
  modalSave: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', paddingTop: 56, alignItems: 'flex-end', paddingRight: 12 },
  menu: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 6, minWidth: 220, elevation: 6 },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuText: { fontSize: 15, color: colors.text },
});
